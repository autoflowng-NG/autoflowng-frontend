/**
 * SharedExecutionPage — Phase 6.5
 *
 * Public route: /share/execution/:token
 * No authentication required — reads from GET /api/share/:token
 *
 * Shows a read-only cinematic execution report suitable for sharing
 * in Slack, email, or with external stakeholders.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Clock, GitBranch, Zap, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { formatDuration } from "../hooks/useExecutionStream";

const API_BASE = (import.meta.env?.VITE_API_URL || "https://autoflowng-backend-production.up.railway.app")
  .replace(/\/$/, "");

const STATUS_COLOR: Record<string, string> = {
  completed: "#00C896",
  failed:    "#FB7185",
  cancelled: "#FBBF24",
  running:   "#A78BFA",
};

const STATUS_ICON: Record<string, any> = {
  completed: CheckCircle2,
  failed:    XCircle,
  cancelled: AlertCircle,
};

interface SharedRun {
  id: number;
  workflow_name: string;
  status: string;
  trigger_type: string | null;
  error: string | null;
  duration_ms: number | null;
  steps_completed: number;
  steps_total: number;
  started_at: string;
  completed_at: string | null;
  ai_summary: string | null;
}

export default function SharedExecutionPage({ token }: { token: string }) {
  const [run,      setRun]      = useState<SharedRun | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [expires,  setExpires]  = useState<string | null>(null);
  const [viewCount, setViewCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/share/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); }
        else { setRun(d.run); setExpires(d.expires_at); setViewCount(d.view_count); }
      })
      .catch(() => setError("Could not load execution report"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{
      minHeight: "100vh", background: "#04060F",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <RefreshCw size={22} color="#A78BFA" />
      </motion.div>
    </div>
  );

  if (error || !run) return (
    <div style={{
      minHeight: "100vh", background: "#04060F",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
    }}>
      <XCircle size={32} color="#FB7185" />
      <div style={{ fontSize: 16, color: "#FB7185", fontFamily: "'DM Sans',sans-serif" }}>
        {error || "Execution report not found"}
      </div>
      <div style={{ fontSize: 12, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
        This link may have expired or been revoked.
      </div>
    </div>
  );

  const color    = STATUS_COLOR[run.status]  ?? "#94A3B8";
  const Icon     = STATUS_ICON[run.status]   ?? AlertCircle;

  return (
    <div style={{ minHeight: "100vh", background: "#04060F", padding: "40px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* AUTOFLOWNG watermark */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 32,
          fontSize: 12, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Mono',monospace",
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: 5,
            background: "linear-gradient(135deg, #00C896, #A78BFA)",
          }} />
          AUTOFLOWNG · Execution Report
        </div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(8,11,22,0.95)",
            border: `1px solid ${color}20`,
            borderRadius: 20, padding: "28px",
            backdropFilter: "blur(20px)",
            boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px ${color}12`,
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Top accent */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${color}88, transparent)`,
          }} />

          {/* Status + workflow name */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Icon size={20} color={color} />
            <div>
              <div style={{
                fontSize: 9, fontWeight: 800, color,
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", textTransform: "uppercase",
                marginBottom: 4,
              }}>
                {run.status}
              </div>
              <h1 style={{
                fontSize: 22, fontWeight: 900, color: "#E8EEFF",
                fontFamily: "'Syne',sans-serif", lineHeight: 1.1, margin: 0,
              }}>
                {run.workflow_name}
              </h1>
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            {[
              { icon: Clock,     label: "Duration",  value: formatDuration(run.duration_ms) },
              { icon: Zap,       label: "Trigger",   value: run.trigger_type || "manual" },
              { icon: GitBranch, label: "Steps",     value: `${run.steps_completed}/${run.steps_total}` },
              { icon: Clock,     label: "Started",   value: new Date(run.started_at).toLocaleString() },
            ].map(({ icon: MetaIcon, label, value }) => (
              <div key={label}>
                <div style={{
                  fontSize: 9, color: "rgba(232,238,255,0.3)",
                  fontFamily: "'DM Mono',monospace", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 3,
                }}>
                  {label}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 12, fontWeight: 700, color: "rgba(232,238,255,0.75)",
                  fontFamily: "'DM Mono',monospace",
                }}>
                  <MetaIcon size={10} color="rgba(232,238,255,0.3)" />
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {run.error && (
            <div style={{
              padding: "10px 14px", marginBottom: 16,
              background: "rgba(251,113,133,0.07)",
              border: "1px solid rgba(251,113,133,0.2)",
              borderRadius: 10,
              fontSize: 12, color: "#FB7185",
              fontFamily: "'DM Sans',sans-serif",
            }}>
              {run.error}
            </div>
          )}

          {/* AI Summary */}
          {run.ai_summary && (
            <div style={{
              padding: "12px 14px",
              background: "rgba(167,139,250,0.05)",
              border: "1px solid rgba(167,139,250,0.15)",
              borderRadius: 10,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: "#A78BFA",
                fontFamily: "'DM Mono',monospace', letterSpacing: '0.08em",
                marginBottom: 6, textTransform: "uppercase",
              }}>
                AI Summary
              </div>
              <p style={{
                fontSize: 13, lineHeight: 1.6,
                color: "rgba(232,238,255,0.7)",
                fontFamily: "'DM Sans',sans-serif",
                margin: 0, fontStyle: "italic",
              }}>
                "{run.ai_summary}"
              </p>
              <div style={{
                marginTop: 8, fontSize: 9,
                color: "rgba(232,238,255,0.2)",
                fontFamily: "'DM Mono',monospace",
              }}>
                AI-generated · verify independently
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <div style={{
          marginTop: 24, textAlign: "center",
          fontSize: 10, color: "rgba(232,238,255,0.2)",
          fontFamily: "'DM Mono',monospace",
        }}>
          {viewCount !== null && `Viewed ${viewCount} time${viewCount !== 1 ? "s" : ""} · `}
          {expires && `Expires ${new Date(expires).toLocaleString()}`}
        </div>
      </div>
    </div>
  );
}
