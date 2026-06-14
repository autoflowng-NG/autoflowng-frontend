import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  to?: string;
  label?: string;
}

export function BackButton({ to = "/", label = "Back" }: BackButtonProps) {
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav(to)}
      style={{
        position: "fixed",
        top: 20,
        left: 20,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: "8px 14px",
        color: "rgba(232,238,255,0.7)",
        fontSize: 13,
        fontFamily: "'DM Sans',sans-serif",
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
    >
      ← {label}
    </button>
  );
}
