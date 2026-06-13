import { useEffect, useRef } from "react";

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div style={{ position:"fixed",top:0,left:0,right:0,height:2,zIndex:9997,pointerEvents:"none" }}>
      <div ref={ref} style={{ height:"100%",background:"linear-gradient(90deg,#00C896,#38BDF8,#A78BFA)",transformOrigin:"0 50%",transform:"scaleX(0)",transition:"transform 0.08s linear" }}/>
    </div>
  );
}
