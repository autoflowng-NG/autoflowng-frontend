import { useEffect, useRef } from "react";

interface ParticlesProps {
  opacity?: number;
  count?: number;
  colors?: string[];
}

export function Particles({ opacity = 0.55, count = 50, colors = ["#00C896", "#38BDF8"] }: ParticlesProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W: number, H: number, raf: number;
    let pts: Array<{ x: number; y: number; vx: number; vy: number; r: number; a: number; c: string }>;

    const init = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      pts = Array.from({ length: Math.min(count, Math.floor(W / 20)) }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.4 + 0.08,
        c: colors[Math.floor(Math.random() * colors.length)],
      }));
    };

    init();
    const ro = new ResizeObserver(init);
    ro.observe(canvas);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      if (!pts) { raf = requestAnimationFrame(draw); return; }
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c + Math.round(p.a * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(0,200,150,${0.045 * (1 - d / 110)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [count, colors]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, pointerEvents: "none" }}
    />
  );
}
