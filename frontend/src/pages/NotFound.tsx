import { useLocation } from "wouter";
import { GradientMesh } from "../components/GradientMesh";
import { PageTransition } from "../components/PageTransition";
import { Logo } from "../components/Logo";
import { Home } from "lucide-react";

export default function NotFound() {
  const [, nav] = useLocation();
  return (
    <PageTransition variant="fade">
    <div style={{ minHeight: "100vh", background: "#04060F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", textAlign: "center", padding: 24 }}>
      <GradientMesh />
      <div style={{ position: "relative", zIndex: 1 }}>
        <Logo size="md" onClick={() => nav("/")} />
        <div style={{ fontSize: "8rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.06em", lineHeight: 1, marginTop: 32, marginBottom: 8, background: "linear-gradient(135deg, #00C896, #38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>404</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF", marginBottom: 12 }}>Page not found</h2>
        <p style={{ fontSize: 15, color: "rgba(232,238,255,0.45)", marginBottom: 36 }}>The page you're looking for doesn't exist or has been moved.</p>
        <button onClick={() => nav("/")} data-testid="button-home" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#00C896", border: "none", borderRadius: 12, padding: "12px 28px", color: "#04060F", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", boxShadow: "0 0 30px rgba(0,200,150,0.3)" }}>
          <Home size={16} /> Back to home
        </button>
      </div>
    </div>
    </PageTransition>
  );
}
