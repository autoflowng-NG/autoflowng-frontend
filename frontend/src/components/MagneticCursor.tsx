import { useEffect, useRef, useState } from "react";

export function MagneticCursor() {
  const dot  = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    setEnabled(true);
    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my;
    let target: Element | null = null;

    const move = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      target = (e.target as Element)?.closest?.("[data-magnet]") || null;
    };
    window.addEventListener("mousemove", move);

    let raf = 0;
    const loop = () => {
      let tx = mx, ty = my, scale = 1;
      if (target) {
        const r = target.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        tx = cx + (mx - cx) * 0.25; ty = cy + (my - cy) * 0.25; scale = 2.2;
      }
      rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;
      if (dot.current)  dot.current.style.transform  = `translate3d(${mx - 4}px,${my - 4}px,0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx - 18}px,${ry - 18}px,0) scale(${scale})`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("mousemove", move); };
  }, []);

  if (!enabled) return null;
  return (
    <>
      <div ref={dot}  style={{ position:"fixed",top:0,left:0,width:8,height:8,borderRadius:"50%",background:"#00C896",pointerEvents:"none",zIndex:9999,mixBlendMode:"screen" }}/>
      <div ref={ring} style={{ position:"fixed",top:0,left:0,width:36,height:36,borderRadius:"50%",border:"1.5px solid rgba(0,200,150,0.7)",pointerEvents:"none",zIndex:9998,mixBlendMode:"screen",transition:"transform 0.05s linear" }}/>
    </>
  );
}
