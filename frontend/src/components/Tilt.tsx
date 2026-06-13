import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

interface TiltProps {
  children: ReactNode;
  max?: number;
  style?: CSSProperties;
}

export function Tilt({ children, max = 10, style = {} }: TiltProps) {
  const ref = useRef<HTMLDivElement>(null);

  const on = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(0)`;
  };

  const off = () => {
    if (ref.current) ref.current.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={on}
      onMouseLeave={off}
      style={{ transition: "transform 0.25s ease", transformStyle: "preserve-3d", ...style }}
    >
      {children}
    </div>
  );
}
