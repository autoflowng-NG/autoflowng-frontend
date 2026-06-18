import { useId } from "react";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  onClick?: () => void;
  white?: boolean;
}

export function Logo({ size = "md", onClick, white }: LogoProps) {
  const uid = useId().replace(/:/g, "");
  const sz = { xs: 28, sm: 32, md: 38, lg: 56, xl: 80 }[size] ?? 38;
  const fs = { xs: 14, sm: 16, md: 18, lg: 28, xl: 42 }[size] ?? 18;

  return (
    <div
      onClick={onClick}
      data-testid="logo"
      style={{
        display: "flex", alignItems: "center",
        gap: sz * 0.28, cursor: onClick ? "pointer" : "default", userSelect: "none",
      }}
    >
      <svg width={sz} height={sz} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <radialGradient id={uid + "_bg"} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0D1F1A" />
            <stop offset="100%" stopColor="#060E0B" />
          </radialGradient>
          <radialGradient id={uid + "_hub"} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#2AFFC8" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#009A6F" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="44" height="44" rx="10" fill={`url(#${uid}_bg)`} />
        <circle cx="22" cy="22" r="13" stroke="rgba(0,200,150,0.45)" strokeWidth="1.1" strokeDasharray="3.2 2.4" />
        <line x1="22" y1="9" x2="22" y2="17" stroke="rgba(0,200,150,0.55)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="22" y1="27" x2="22" y2="35" stroke="rgba(130,120,200,0.45)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="9" y1="22" x2="17" y2="22" stroke="rgba(0,200,150,0.45)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="27" y1="22" x2="35" y2="22" stroke="rgba(56,189,248,0.55)" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="22" cy="22" r="7" fill="#00C896" />
        <circle cx="22" cy="22" r="7" fill={`url(#${uid}_hub)`} />
        <text x="22" y="25.5" textAnchor="middle" fontSize="6.5" fontWeight="900" fontFamily="Arial,sans-serif" fill="white" letterSpacing="-0.3">AF</text>
        <circle cx="22" cy="22" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="0.9" fill="none" />
        <circle cx="22" cy="9" r="2.4" fill="#00C896" />
        <circle cx="35" cy="22" r="2.4" fill="#38BDF8" />
        <circle cx="22" cy="35" r="2.4" fill="#A78BFA" />
        <circle cx="9" cy="22" r="2.4" fill="#00C896" opacity="0.8" />
        <circle cx="22" cy="9" r="1" fill="white" />
        <circle cx="35" cy="22" r="1" fill="white" />
        <circle cx="22" cy="35" r="1" fill="white" />
        <circle cx="9" cy="22" r="1" fill="white" />
      </svg>
      <div style={{ display: "flex", alignItems: "baseline", gap: 0, lineHeight: 1 }}>
        <span style={{ fontSize: fs, fontWeight: 900, letterSpacing: "-0.045em", fontFamily: "'Syne', sans-serif", color: white ? "white" : "#E8EEFF" }}>Auto</span>
        <span style={{ fontSize: fs, fontWeight: 900, letterSpacing: "-0.045em", fontFamily: "'Syne', sans-serif", color: "#00C896" }}>Flow</span>
        <span style={{ fontSize: fs * 0.72, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "'Syne', sans-serif", color: "rgba(232,238,255,0.45)", marginLeft: 2 }}>NG</span>
      </div>
    </div>
  );
}
