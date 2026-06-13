/**
 * ExecutionPage — Phase 5
 *
 * Shareable deep-link route: /executions/:runId
 *
 * Hydrates execution detail from GET /api/executions/:runId,
 * merges with live WebSocket state if the run is still active,
 * and renders the full ExecutionDetailDrawer inline.
 *
 * Supports:
 * - Direct URL sharing: /executions/42
 * - Execution context restoration from backend
 * - AI summary auto-fetch for terminal runs
 * - Back-navigation to Workflows
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion }  from "framer-motion";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { executionsAPI } from "../lib/api";
import { useExecutionStream, formatDuration } from "../hooks/useExecutionStream";
import { PageTransition } from "../components/PageTransition";
import { ExecutionSummaryPanel } from "../components/ExecutionSummaryPanel";
import { WorkflowIntelligencePanel } from "../components/OrchestrationIntelligence";
import { RecommendationList } from "../components/PredictiveInsightsPanel";

const PHASE_COLOR: Record<string, string> = {
  completed: "#00C896",
  failed:    "#FB7185",
  cancelled: "#FBBF24",
  running:   "#A78BFA",
  unknown:   "#94A3B8",
};

interface BackendRun {
  id: number;
  workflow_id: number;
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
  ai_model: string | null;
}

export default function ExecutionPage({ runId }: { runId: string }) {
  const [, nav]  = useLocation();
  const [run,    setRun]    = useState<BackendRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,  setError]  = useState<string | null>(null);

  const { execution } = useExecutionStream(run ? String(run.workflow_id) : undefined);

  useEffect(() => {
    setLoading(true);
    setError(null);
    executionsAPI.get(runId)
      .then(d => { setRun(d.run); setLoading(false); })
      .catch(e => { setError(e?.message || "Execution not found"); setLoading(false); });
  }, [runId]);

  /* Merge live state if execution is active */
  const isLive    = execution.phase === "running" || execution.phase === "starting";
  const livePhase = isLive ? execution.phase : null;
  const phase     = livePhase ?? run?.status ?? "unknown";
  const color     = PHASE_COLOR[phase] ?? "#94A3B8";

  const durationMs = isLive
    ? execution.elapsedMs
    : execution.durationMs ?? run?.duration_ms ?? null;

  if (loading) return (
    <PageTransition>
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#04060F",
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw size={22} color="#A78BFA" />
        </motion.div>
      </div>
    </PageTransition>
  );

  if (error || !run) return (
    <PageTransition>
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#04060F", gap: 16,
      }}>
        <div style={{
          fontSize: 15, color: "#FB7185",
          fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
        }}>
          {error || "Execution not found"}
        </div>
        <button
          onClick={() => nav("/workflows")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 10, padding: "9px 16px",
            color: "rgba(232,238,255,0.6)", fontSize: 13,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
          }}
        >
          <ArrowLeft size={14} /> Back to Workflows
        </button>
      </div>
    </PageTransition>
  );

  return (
    <PageTransition variant="slide">
      <div style={{ minHeight: "100vh", background: "#04060F", padding: "32px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* Back nav */}
          <button
            onClick={() => nav("/workflows")}
            style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 28,
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(232,238,255,0.35)", fontSize: 12,
              fontFamily: "'DM Sans',sans-serif",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(232,238,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(232,238,255,0.35)")}
          >
            <ArrowLeft size={13} /> Back to Workflows
          </button>

          {/* Header */}
          <div className="af-glass" style={{
            borderRadius: 18, padding: "24px",
            border: `1px solid ${color}18`,
            marginBottom: 20, position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${color}66, transparent)`,
            }} />

            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Phase badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: color, flexShrink: 0,
                    animation: isLive ? "glw 2s ease infinite" : "none",
                    boxShadow: isLive ? `0 0 8px ${color}` : "none",
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 800, color,
                    fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>
                    {phase}
                  </span>
                  {durationMs !== null && (
                    <span style={{
                      fontSize: 10, color: "rgba(232,238,255,0.35)",
                      fontFamily: "'DM Mono',monospace",
                    }}>
                      {formatDuration(durationMs)}
                    </span>
                  )}
                </div>

                <h1 style={{
                  fontSize: 22, fontWeight: 900,
                  fontFamily: "'Syne',sans-serif",
                  color: "#E8EEFF", marginBottom: 6, lineHeight: 1.2,
                }}>
                  {run.workflow_name}
                </h1>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    ["Run ID",   `#${run.id}`],
                    ["Trigger",  run.trigger_type || "manual"],
                    ["Steps",    `${run.steps_completed}/${run.steps_total}`],
                    ["Started",  new Date(run.started_at).toLocaleString()],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <span style={{
                        fontSize: 10, color: "rgba(232,238,255,0.3)",
                        fontFamily: "'DM Mono',monospace",
                      }}>{k}:</span>
                      <span style={{
                        fontSize: 10, color: "rgba(232,238,255,0.65)",
                        fontFamily: "'DM Mono',monospace", fontWeight: 700,
                      }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Share link */}
              <button
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
                title="Copy shareable link"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 9, padding: "8px 12px",
                  color: "rgba(232,238,255,0.4)", fontSize: 11,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                  flexShrink: 0,
                }}
              >
                <ExternalLink size={11} /> Copy link
              </button>
            </div>

            {run.error && (
              <div style={{
                marginTop: 14, padding: "8px 12px",
                background: "rgba(251,113,133,0.07)",
                border: "1px solid rgba(251,113,133,0.2)",
                borderRadius: 8,
                fontSize: 12, color: "#FB7185",
                fontFamily: "'DM Sans',sans-serif",
              }}>
                {run.error}
              </div>
            )}
          </div>

          {/* AI Summary */}
          <div style={{ marginBottom: 16 }}>
            <ExecutionSummaryPanel
              runId={String(run.id)}
              phase={phase}
              autoFetch
            />
          </div>

          {/* Intelligence panel */}
          <div style={{ marginBottom: 16 }}>
            <WorkflowIntelligencePanel workflowId={String(run.workflow_id)} />
          </div>

          {/* Recommendations */}
          <div style={{ marginBottom: 16 }}>
            <RecommendationList workflowId={String(run.workflow_id)} />
          </div>

          {/* Live log (if still running) */}
          {isLive && execution.logs.length > 0 && (
            <div className="af-glass" style={{
              borderRadius: 18, padding: "18px 20px",
              border: "1px solid rgba(167,139,250,0.15)",
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: "#A78BFA",
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em",
                textTransform: "uppercase", marginBottom: 10,
              }}>
                Live Log
              </div>
              {[...execution.logs].reverse().slice(0, 15).map(entry => (
                <div key={entry.id} style={{
                  padding: "6px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  fontSize: 12, color: "rgba(232,238,255,0.65)",
                  fontFamily: "'DM Sans',sans-serif",
                }}>
                  {entry.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
