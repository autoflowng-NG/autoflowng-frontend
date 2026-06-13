/**
 * UnsubscribePage — Phase 9A
 *
 * Public route: /unsubscribe?token=<token>
 * No authentication required.
 * Calls POST /api/unsubscribe with the token.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader } from "lucide-react";

const API_BASE = (import.meta.env?.VITE_API_URL || "https://autoflowng-backend-production.up.railway.app")
  .replace(/\/$/, "");

const CATEGORY_LABELS: Record<string, string> = {
  all:             "all AutoFlowNG emails",
  marketing:       "marketing emails",
  digest:          "digest emails",
  alerts:          "alert notification emails",
  product_updates: "product update emails",
};

export default function UnsubscribePage() {
  const token    = new URLSearchParams(window.location.search).get("token");
  const [state,    setState]    = useState<"loading" | "success" | "error">("loading");
  const [category, setCategory] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Invalid unsubscribe link."); setState("error"); return; }
    fetch(`${API_BASE}/api/unsubscribe`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setState("error"); }
        else { setCategory(d.category); setState("success"); }
      })
      .catch(() => { setError("Something went wrong. Please try again."); setState("error"); });
  }, [token]);

  return (
    <div style={{
      minHeight: "100vh", background: "#04060F",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          maxWidth: 440, width: "100%",
          background: "rgba(8,11,22,0.97)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 20, padding: "36px 32px",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Logo mark */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, margin: "0 auto 24px",
          background: "linear-gradient(135deg, #00C896, #A78BFA)",
        }} />

        {state === "loading" && (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ display: "inline-block", marginBottom: 16 }}>
              <Loader size={28} color="#A78BFA" />
            </motion.div>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Sans',sans-serif" }}>
              Processing your request…
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 size={36} color="#00C896" style={{ margin: "0 auto 16px", display: "block" }} />
            <h1 style={{
              fontSize: 20, fontWeight: 900, color: "#E8EEFF",
              fontFamily: "'Syne',sans-serif", marginBottom: 10,
            }}>
              Unsubscribed
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.55)", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6 }}>
              You've been unsubscribed from{" "}
              <strong style={{ color: "#E8EEFF" }}>
                {CATEGORY_LABELS[category ?? "all"] ?? "selected emails"}
              </strong>
              .
            </p>
            <p style={{ fontSize: 12, color: "rgba(232,238,255,0.3)", marginTop: 12, fontFamily: "'DM Mono',monospace" }}>
              Security and account emails will continue to be delivered.
            </p>
            <p style={{ marginTop: 20, fontSize: 12, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Sans',sans-serif" }}>
              Changed your mind?{" "}
              <a href={`${import.meta.env?.VITE_FRONTEND_URL || ""}/settings`} style={{ color: "#A78BFA" }}>
                Update preferences
              </a>
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle size={36} color="#FB7185" style={{ margin: "0 auto 16px", display: "block" }} />
            <h1 style={{
              fontSize: 20, fontWeight: 900, color: "#E8EEFF",
              fontFamily: "'Syne',sans-serif", marginBottom: 10,
            }}>
              Link expired
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.55)", fontFamily: "'DM Sans',sans-serif" }}>
              {error || "This unsubscribe link is invalid or has already been used."}
            </p>
            <a
              href={`${import.meta.env?.VITE_FRONTEND_URL || ""}/settings`}
              style={{
                display: "inline-block", marginTop: 20,
                background: "#A78BFA", color: "#04060F",
                fontWeight: 700, fontSize: 13, borderRadius: 10,
                padding: "10px 24px", textDecoration: "none",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Manage preferences
            </a>
          </>
        )}
      </motion.div>
    </div>
  );
}
