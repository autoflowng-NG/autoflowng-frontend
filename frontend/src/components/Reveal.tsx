import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  style?: CSSProperties;
}

export function Reveal({ children, delay = 0, y = 24, style = {} }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.forEach(e => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }),
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : `translateY(${y}px)`,
        transition: `opacity 0.9s ${delay}ms cubic-bezier(.2,.7,.2,1), transform 0.9s ${delay}ms cubic-bezier(.2,.7,.2,1)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
