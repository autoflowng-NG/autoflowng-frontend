/**
 * PredictiveInsightsPanel — Phase 5
 *
 * Visual surface for predictive orchestration signals and
 * operational recommendations. Sourced entirely from
 * usePredictiveIntelligence (real telemetry only).
 *
 * Components exported:
 * - PredictiveInsightsPanel    — full dashboard card
 * - WorkflowPredictionBadge    — compact per-card risk indicator
 * - RecommendationList         — standalone rec list for drawer
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, Brain,
  Lightbulb, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Info, Zap,
} from "lucide-react";
import {
  usePredictiveIntelligence, useWorkflowPrediction,
  type OperationalRecommendation, type PredictiveSignals,
} from "../hooks/usePredictiveIntelligence";

/* ── Helpers ─────────────────────────────────────────────────────────── */
const SEVERITY_COLOR = {
  critical: "#FB7185",
  warning:  "#FBBF24",
  info:     "#38BDF8",
};

const SEVERITY_ICON = {
  critical: AlertTriangle,
  warning:  AlertTriangle,
  info:     Info,
};

function TrendIcon({ trend }: { trend: PredictiveSignals["trend"] }) {
  if (trend === "improving")  return <TrendingDown size={11} color="#00C896" />;
  if (trend === "worsening")  return <TrendingUp   size={11} color="#FB7185" />;
  if (trend === "stable")     return <Minus        size={11} color="#94A3B8" />;
  return null;
}

function ConfidencePips({ confidence }: { confidence: PredictiveSignals["confidence"] }) {
  const levels = { low: 1, medium: 2, high: 3 };
  const filled = levels[confidence];
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1,2,3].map(i => (
        <div key={i} style={{
          width: 4, height: 4, borderRadius: "50%",
          background: i <= filled ? "#A78BFA" : "rgba(167,139,250,0.2)",
        }} />
      ))}
    </div>
  );
}

/* ── RecommendationCard ──────────────────────────────────────────────── */
function RecommendationCard({ rec }: { rec: OperationalRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const color = SEVERITY_COLOR[rec.severity];
  const Icon  = rec.severity === "info" ? Lightbulb : SEVERITY_ICON[rec.severity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background:   `${color}06`,
        border:       `1px solid ${color}1e`,
        borderRadius: 10,
        overflow:     "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: "100%", background: "none", border: "none",
          cursor: "pointer", padding: "10px 12px",
          display: "flex", alignItems: "flex-start", gap: 9, textAlign: "left",
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0, marginTop: 1,
          background: `${color}12`, border: `1px solid ${color}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={12} color={color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "#E8EEFF",
            fontFamily: "'DM Sans',sans-serif",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {rec.title}
          </div>
          <div style={{
            fontSize: 10, color: "rgba(232,238,255,0.35)",
            fontFamily: "'DM Sans',sans-serif", marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {rec.workflowName}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, color,
            background: `${color}12`, border: `1px solid ${color}25`,
            borderRadius: 100, padding: "1px 6px",
            fontFamily: "'DM Mono',monospace", textTransform: "uppercase",
          }}>
            {rec.severity}
          </span>
          {expanded
            ? <ChevronUp size={11} color="rgba(232,238,255,0.25)" />
            : <ChevronDown size={11} color="rgba(232,238,255,0.25)" />
          }
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              borderTop: `1px solid ${color}12`,
              padding: "10px 12px 12px",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <p style={{
                fontSize: 12, lineHeight: 1.55,
                color: "rgba(232,238,255,0.6)",
                fontFamily: "'DM Sans',sans-serif", margin: 0,
              }}>
                {rec.detail}
              </p>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: 7,
              }}>
                <Zap size={9} color="rgba(232,238,255,0.25)" />
                <span style={{
                  fontSize: 10, color: "rgba(232,238,255,0.35)",
                  fontFamily: "'DM Mono',monospace",
                }}>
                  Evidence: {rec.evidence}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PredictiveInsightsPanel — dashboard card
   ══════════════════════════════════════════════════════════════════════ */
export function PredictiveInsightsPanel() {
  const {
    recommendations, criticalRecommendations,
    highestRiskWorkflow, hasRecommendations,
    hasCritical, totalTracked,
  } = usePredictiveIntelligence();

  const [tab, setTab]       = useState<"recs" | "signals">("recs");
  const [expanded, setExpanded] = useState(false);

  const headerColor = hasCritical ? "#FB7185"
    : hasRecommendations ? "#FBBF24"
    : "#00C896";

  const headerLabel = hasCritical
    ? `${criticalRecommendations.length} critical recommendation${criticalRecommendations.length !== 1 ? "s" : ""}`
    : hasRecommendations
    ? `${recommendations.length} recommendation${recommendations.length !== 1 ? "s" : ""}`
    : "No issues detected";

  if (totalTracked === 0) return null;

  return (
    <div className="af-glass" style={{
      borderRadius: 18, overflow: "hidden",
      border: `1px solid ${headerColor}15`,
      position: "relative",
    }}>
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${headerColor}55, transparent)`,
      }} />

      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: "100%", background: "none", border: "none",
          cursor: "pointer", padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${headerColor}10`, border: `1px solid ${headerColor}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: hasCritical ? "brain-ambient 3s ease infinite" : "none",
        }}>
          <Brain size={16} color={headerColor} />
        </div>

        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "#E8EEFF",
            fontFamily: "'Syne',sans-serif", marginBottom: 2,
          }}>
            Predictive Intelligence
          </div>
          <div style={{
            fontSize: 11, color: headerColor,
            fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
          }}>
            {headerLabel}
          </div>
        </div>

        {/* Risk pill for highest-risk workflow */}
        {highestRiskWorkflow && highestRiskWorkflow.degradationRisk > 0.3 && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 800,
              color: highestRiskWorkflow.degradationRisk > 0.7 ? "#FB7185" : "#FBBF24",
              fontFamily: "'DM Mono',monospace",
            }}>
              {Math.round(highestRiskWorkflow.degradationRisk * 100)}% risk
            </span>
            <span style={{
              fontSize: 9, color: "rgba(232,238,255,0.3)",
              fontFamily: "'DM Mono',monospace",
              maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {highestRiskWorkflow.workflowName}
            </span>
          </div>
        )}

        <span style={{ color: "rgba(232,238,255,0.25)", flexShrink: 0 }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {/* Tab strip */}
              <div style={{
                display: "flex", gap: 0,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                {(["recs", "signals"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      flex: 1, padding: "9px 12px",
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 10, fontWeight: 700,
                      fontFamily: "'DM Mono',monospace",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      color: tab === t ? "#E8EEFF" : "rgba(232,238,255,0.3)",
                      borderBottom: tab === t
                        ? `2px solid ${headerColor}` : "2px solid transparent",
                      transition: "color 0.15s",
                    }}
                  >
                    {t === "recs" ? `Recommendations (${recommendations.length})` : "Signals"}
                  </button>
                ))}
              </div>

              <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {tab === "recs" && (
                  recommendations.length === 0 ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "12px", background: "rgba(0,200,150,0.04)",
                      border: "1px solid rgba(0,200,150,0.12)", borderRadius: 8,
                    }}>
                      <CheckCircle2 size={13} color="#00C896" />
                      <span style={{
                        fontSize: 12, color: "rgba(232,238,255,0.5)",
                        fontFamily: "'DM Sans',sans-serif",
                      }}>
                        All tracked workflows operating within normal parameters
                      </span>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {recommendations.slice(0, 6).map(rec => (
                        <RecommendationCard key={rec.id} rec={rec} />
                      ))}
                    </AnimatePresence>
                  )
                )}

                {tab === "signals" && (
                  <SignalsGrid />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── SignalsGrid — tabular predictive metrics ────────────────────────── */
function SignalsGrid() {
  const { signals } = usePredictiveIntelligence();
  const entries = Object.values(signals).filter(s => s.confidence !== "low");

  if (entries.length === 0) {
    return (
      <div style={{
        fontSize: 12, color: "rgba(232,238,255,0.25)",
        fontFamily: "'DM Sans',sans-serif", textAlign: "center",
        padding: "16px 0",
      }}>
        Signals appear after sufficient execution history
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map(s => {
        const riskColor = s.degradationRisk > 0.7 ? "#FB7185"
          : s.degradationRisk > 0.4 ? "#FBBF24" : "#00C896";
        return (
          <motion.div
            key={s.workflowId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
            }}
          >
            <TrendIcon trend={s.trend} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: "rgba(232,238,255,0.75)",
                fontFamily: "'DM Sans',sans-serif",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {s.workflowName}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <ConfidencePips confidence={s.confidence} />
              <span style={{
                fontSize: 10, fontWeight: 800, color: riskColor,
                fontFamily: "'DM Mono',monospace",
              }}>
                {Math.round(s.failureProbability * 100)}% fail
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   WorkflowPredictionBadge — compact per-card risk indicator
   ══════════════════════════════════════════════════════════════════════ */
export function WorkflowPredictionBadge({ workflowId }: { workflowId: string }) {
  const { signals } = useWorkflowPrediction(workflowId);
  if (!signals || signals.confidence === "low" || signals.degradationRisk < 0.25) return null;

  const color = signals.degradationRisk > 0.7 ? "#FB7185"
    : signals.degradationRisk > 0.45 ? "#FBBF24" : "#38BDF8";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      title={`Degradation risk: ${Math.round(signals.degradationRisk * 100)}%`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: `${color}10`, border: `1px solid ${color}25`,
        borderRadius: 100, padding: "2px 7px",
      }}
    >
      <Brain size={8} color={color} />
      <span style={{
        fontSize: 9, fontWeight: 800, color,
        fontFamily: "'DM Mono',monospace",
      }}>
        {Math.round(signals.degradationRisk * 100)}%
      </span>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   RecommendationList — standalone list for ExecutionDetailDrawer
   ══════════════════════════════════════════════════════════════════════ */
export function RecommendationList({ workflowId }: { workflowId: string }) {
  const { recommendations } = useWorkflowPrediction(workflowId);
  if (recommendations.length === 0) return null;

  return (
    <div>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
        color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace",
        textTransform: "uppercase", marginBottom: 8,
      }}>
        Recommendations
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {recommendations.map(rec => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
      </div>
    </div>
  );
}
