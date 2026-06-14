import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useAuth } from "../contexts/AuthContext";
import { PageTransition } from "../components/PageTransition";
import { BackButton } from '../components/BackButton';
import { Logo } from "../components/Logo";
import { GradientMesh } from "../components/GradientMesh";
import { MagneticCursor } from "../components/MagneticCursor";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";

interface LoginForm { email: string; password: string; }


export default function Login() {
  const [, nav] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true); setError("");
    try {
      await login(data.email, data.password);
      toast({ title: "Welcome back!", description: "Logged in successfully." });
      nav("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Login failed. Please check your credentials.");
    } finally { setLoading(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 12, padding: "13px 16px", color: "#E8EEFF", fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", outline: "none", transition: "border-color 0.18s, box-shadow 0.18s",
    boxSizing: "border-box",
  };

  return (
    <PageTransition variant="bloom">
      <BackButton />
    <div style={{ minHeight: "100vh", background: "#04060F", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "24px" }}>
      <MagneticCursor />
      <GradientMesh />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
              <button onClick={() => nav("/")} style={{ position: "absolute", top: 20, left: 20, display: "flex", alignItems: "center", gap: 6, color: "rgba(232,238,255,0.6)", fontSize: 13, fontFamily: "'DM Sans',sans-serif", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", zIndex: 10 }}>← Back</button>
          <Logo size="md" onClick={() => nav("/")} />
          <p style={{ marginTop: 16, fontSize: 14, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Sans',sans-serif" }}>Sign in to your workspace</p>
        </div>
        <div className="af-glass" style={{ borderRadius: 24, padding: "36px 32px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #00C896, transparent)" }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", marginBottom: 28, color: "#E8EEFF" }}>Welcome back</h1>

          {error && (
            <div style={{ display: "flex", gap: 8, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: "#FB7185", fontSize: 13 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(232,238,255,0.6)", marginBottom: 8, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
              <input data-testid="input-email" type="email" placeholder="you@example.com" style={{ ...inp, borderColor: errors.email ? "rgba(251,113,133,0.5)" : undefined }} {...register("email", { required: true })} onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.5)"} onBlur={e => e.target.style.borderColor = ""} />
              {errors.email && <p style={{ fontSize: 11, color: "#FB7185", marginTop: 4 }}>Email is required</p>}
            </div>
            <div style={{ marginBottom: 24, position: "relative" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(232,238,255,0.6)", marginBottom: 8, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
              <input data-testid="input-password" type={showPw ? "text" : "password"} placeholder="••••••••" style={{ ...inp, paddingRight: 44, borderColor: errors.password ? "rgba(251,113,133,0.5)" : undefined }} {...register("password", { required: true })} onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.5)"} onBlur={e => e.target.style.borderColor = ""} />
              <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: "absolute", right: 12, bottom: 13, background: "none", border: "none", cursor: "pointer", color: "rgba(232,238,255,0.4)", padding: 0 }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {errors.password && <p style={{ fontSize: 11, color: "#FB7185", marginTop: 4 }}>Password is required</p>}
            </div>
            <button type="submit" data-testid="button-submit" disabled={loading} style={{ width: "100%", background: loading ? "rgba(0,200,150,0.5)" : "#00C896", border: "none", borderRadius: 12, padding: "14px", color: "#04060F", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.18s", boxShadow: "0 0 30px rgba(0,200,150,0.3)" }}>
              {loading ? <><div className="af-loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Sans',sans-serif" }}>
            Don't have an account?{" "}
            <button onClick={() => nav("/register")} data-testid="link-register" style={{ background: "none", border: "none", color: "#00C896", fontWeight: 700, cursor: "pointer", fontSize: 13, padding: 0 }}>
              Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
