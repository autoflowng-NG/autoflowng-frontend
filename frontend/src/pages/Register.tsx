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
import { Eye, EyeOff, ArrowRight, AlertCircle, Check } from "lucide-react";

interface RegForm { name: string; email: string; password: string; referralCode?: string; }

export default function Register() {
  const [, nav] = useLocation();
  const { register: authRegister } = useAuth();
  const { toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegForm>();
  const pw = watch("password", "");

  const strength = pw.length === 0 ? 0 : pw.length < 6 ? 1 : pw.length < 10 ? 2 : /[A-Z]/.test(pw) && /[0-9]/.test(pw) ? 4 : 3;
  const strengthColors = ["", "#FB7185", "#FBBF24", "#38BDF8", "#00C896"];
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 12, padding: "13px 16px", color: "#E8EEFF", fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", outline: "none", transition: "border-color 0.18s",
    boxSizing: "border-box",
  };

  const onSubmit = async (data: RegForm) => {
    setLoading(true); setError("");
    try {
      await authRegister(data);
      toast({ title: "Account created!", description: "Welcome to AUTOFLOWNG." });
      nav("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <PageTransition variant="bloom">
      <BackButton />
    <div style={{ minHeight: "100vh", background: "#04060F", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "24px" }}>
      <MagneticCursor />
      <GradientMesh />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <button onClick={() => nav("/")} style={{ position: "absolute", top: 24, left: 24, display: "flex", alignItems: "center", gap: 6, color: "rgba(232,238,255,0.5)", fontSize: 13, fontFamily: "'DM Sans',sans-serif", background: "none", border: "none", cursor: "pointer" }}>
            ← Back
          </button>
          <Logo size="md" onClick={() => nav("/")} />
          <p style={{ marginTop: 12, fontSize: 14, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Sans',sans-serif" }}>Start your 3-day free trial</p>
        </div>
        <div className="af-glass" style={{ borderRadius: 24, padding: "36px 32px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #38BDF8, #A78BFA, transparent)" }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", marginBottom: 28, color: "#E8EEFF" }}>Create your account</h1>

          {error && (
            <div style={{ display: "flex", gap: 8, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: "#FB7185", fontSize: 13 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(232,238,255,0.6)", marginBottom: 8, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Full name</label>
              <input data-testid="input-name" type="text" placeholder="Your name" style={{ ...inp, borderColor: errors.name ? "rgba(251,113,133,0.5)" : undefined }} {...register("name", { required: true, minLength: 2 })} onFocus={e => e.target.style.borderColor = "rgba(56,189,248,0.5)"} onBlur={e => e.target.style.borderColor = ""} />
              {errors.name && <p style={{ fontSize: 11, color: "#FB7185", marginTop: 4 }}>Name is required (min 2 chars)</p>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(232,238,255,0.6)", marginBottom: 8, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
              <input data-testid="input-email" type="email" placeholder="you@example.com" style={{ ...inp, borderColor: errors.email ? "rgba(251,113,133,0.5)" : undefined }} {...register("email", { required: true })} onFocus={e => e.target.style.borderColor = "rgba(56,189,248,0.5)"} onBlur={e => e.target.style.borderColor = ""} />
              {errors.email && <p style={{ fontSize: 11, color: "#FB7185", marginTop: 4 }}>Valid email is required</p>}
            </div>
            <div style={{ marginBottom: 16, position: "relative" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(232,238,255,0.6)", marginBottom: 8, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
              <input data-testid="input-password" type={showPw ? "text" : "password"} placeholder="Min 6 characters" style={{ ...inp, paddingRight: 44, borderColor: errors.password ? "rgba(251,113,133,0.5)" : undefined }} {...register("password", { required: true, minLength: 6 })} onFocus={e => e.target.style.borderColor = "rgba(56,189,248,0.5)"} onBlur={e => e.target.style.borderColor = ""} />
              <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: "absolute", right: 12, bottom: 13, background: "none", border: "none", cursor: "pointer", color: "rgba(232,238,255,0.4)", padding: 0 }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {pw && (
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? strengthColors[strength] : "rgba(255,255,255,0.07)", transition: "background 0.3s" }} />)}
                  <span style={{ fontSize: 10, color: strengthColors[strength], fontFamily: "'DM Mono',monospace", marginLeft: 4 }}>{strengthLabels[strength]}</span>
                </div>
              )}
              {errors.password && <p style={{ fontSize: 11, color: "#FB7185", marginTop: 4 }}>Min 6 characters required</p>}
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(232,238,255,0.6)", marginBottom: 8, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Referral code <span style={{ color: "rgba(232,238,255,0.25)", fontWeight: 400 }}>(optional)</span></label>
              <input data-testid="input-referral" type="text" placeholder="e.g. AF-XXXX" style={inp} {...register("referralCode")} onFocus={e => e.target.style.borderColor = "rgba(167,139,250,0.5)"} onBlur={e => e.target.style.borderColor = ""} />
            </div>
            <button type="submit" data-testid="button-submit" disabled={loading} style={{ width: "100%", background: loading ? "rgba(56,189,248,0.4)" : "linear-gradient(135deg,#38BDF8,#A78BFA)", border: "none", borderRadius: 12, padding: "14px", color: "white", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.18s", boxShadow: "0 0 30px rgba(56,189,248,0.25)" }}>
              {loading ? <><div className="af-loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Creating account…</> : <>Create account <ArrowRight size={16} /></>}
            </button>
          </form>

          <div style={{ display: "flex", gap: 6, marginTop: 20, padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {["3-day free trial", "No credit card required", "Cancel anytime"].map(t => (
              <div key={t} style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Sans',sans-serif" }}>
                <Check size={10} color="#00C896" /> {t}
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Sans',sans-serif" }}>
            Already have an account?{" "}
            <button onClick={() => nav("/login")} data-testid="link-login" style={{ background: "none", border: "none", color: "#38BDF8", fontWeight: 700, cursor: "pointer", fontSize: 13, padding: 0 }}>
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
