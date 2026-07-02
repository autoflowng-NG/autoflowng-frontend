
import { useEffect, useState, useRef } from "react";

const capabilities = [
  {
    title: "Workflow automation",
    description: "Build and run multi-step workflows across your connected tools.",
  },
  {
    title: "Creative Agents",
    description: "AI-generated thumbnails, SEO metadata, video, style conversion, animation, and image edits.",
  },
  {
    title: "Media Cloud",
    description: "Governed asset library with brand rules, review, and approval before anything publishes.",
  },
];

function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);
      const gridSize = 60;
      const time = timeRef.current;
      for (let x = 0; x < width; x += gridSize) {
        for (let y = 0; y < height; y += gridSize) {
          const wave = Math.sin(x * 0.01 + y * 0.01 + time) * 0.5 + 0.5;
          const size = 1 + wave * 2;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
          ctx.fill();
        }
      }
      const pulseY = (time * 30) % height;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pulseY);
      ctx.lineTo(width, pulseY);
      ctx.stroke();
      timeRef.current += 0.02;
      frameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export function MetricsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Real local-time clock: reads the visitor's own device/browser timezone
  // (Intl.DateTimeFormat().resolvedOptions().timeZone) — no IP lookup needed,
  // this is the same mechanism every OS already uses to know what time it is
  // where the visitor actually is. Updates every second, always tied to the
  // visitor's real current timezone rather than a hardcoded one.
  const [now, setNow] = useState<Date | null>(null);
  const timeZone = typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeLabel = now
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone,
      }).format(now)
    : "";

  // Human-readable city/region label from the IANA zone name, e.g.
  // "Africa/Lagos" -> "Lagos", "America/New_York" -> "New York".
  const zoneLabel = timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-32 lg:py-40 overflow-hidden">
      <GridBackground />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="grid lg:grid-cols-12 gap-8 mb-20 lg:mb-32">
          <div className="lg:col-span-8 lg:col-start-1">
            {now && (
              <div className={`inline-flex items-center gap-2 mb-6 px-3 py-1.5 border border-white/15 rounded-full transition-opacity duration-700 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C896] animate-pulse" />
                <span className="text-xs font-mono text-white/70">
                  {zoneLabel} · {timeLabel}
                </span>
              </div>
            )}
            <h2 className={`text-6xl md:text-7xl lg:text-[140px] font-display tracking-tight leading-[0.95] text-white transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              Built for
              <br />
              <span className="text-white/70">real workflows.</span>
            </h2>
          </div>
        </div>

        {/* Organic graph image */}
        <div className={`w-full mb-16 transition-all duration-1000 delay-200 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}>
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/real-time-graph-INFmn3u0MlUwvNPynoIhwxtPaPjxM5.png"
            alt=""
            aria-hidden="true"
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Capabilities grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {capabilities.map((item, index) => (
            <div
              key={item.title}
              className={`bg-foreground/[0.02] border border-foreground/10 p-8 lg:p-10 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="text-2xl md:text-3xl font-display tracking-tight mb-4 text-white">
                {item.title}
              </div>
              <div className="text-base text-white/70 leading-relaxed">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
