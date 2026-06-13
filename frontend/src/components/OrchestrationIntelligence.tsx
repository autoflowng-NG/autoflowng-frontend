/**
 * OrchestrationIntelligence — Phase 4
 *
 * Visual intelligence surfaces for workflow health, anomaly flags,
 * and runtime insights. All data sourced from ExecutionHistoryContext.
 *
 * Components:
 * - WorkflowHealthBadge     — compact per-card score indicator
 * - WorkflowHealthBar       — inline reliability bar
 * - AnomalyFlagList         — list of detected anomaly flags
 * - OrchestrationInsightCard — full insight card for dashboard
 * - GlobalHealthSummary     — cross-workflow health overview
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Activity,
  Clock, Zap, ChevronDown, ChevronUp, Brain,
} from "lucide-react";
import {
  useWorkflowHealth, useOrchestrationIntelligence,
  HEALTH_TIER_COLOR, HEALTH_TIER_LABEL,
  type WorkflowHealth, type AnomalyFlag, type HealthTier,
} from "../contexts/ExecutionHistoryContext";
import { formatDuration } from "../hooks/useExecutionStream";

/* ── Tier icon ───────────────────────────────────────────────────────── */
function TierIcon({ tier, size = 12 }: { tier: HealthTier; size?: number }) {
  const color = HEALTH_TIER_COLOR[tier];
  if (tier === "healthy")  return <ShieldCheck  size={size} color={color} />;
  if (tier === "warning")  return <Shield       size={size} color={color} />;
  if (tier === "degraded") return <ShieldAlert  size={size} color={color} />;
  if (tier === "critical") return <ShieldAlert  size={size} color={color} />;
  return <Shield size={size} color={color} />;
}

/* ── Trend icon ──────────────────────────────────────────────────────── */
function TrendIcon({ trend }: { trend: WorkflowHealth["durationTrend"] }) {
  if (trend === "increasing") return <TrendingUp  size={10} color="#FB923C" />;
  if (trend === "improving")  return <TrendingDown size={10} color="#00C896" />;
  if (trend === "stable")     return <Minus        size={10} color="#94A3B8" />;
  return null;
}

/* ── Anomaly severity dot ────────────────────────────────────────────── */
function SeverityDot({ severity }: { severity: AnomalyFlag["severity"] }) {
  const color = severity === "high" ? "#FB7185" : severity === "medium" ? "#FBBF24" : "#94A3B8";
  return (
    <div style={{
      width: 5, height: 5, borderRadius: "50%",
      background: color, flexShrink: 0,
      boxShadow: severity === "high" ? `0 0 5px ${color}` : "none",
    }} />
  );
}

/* ══════════════════════════════════════════════════════════════════════
   WorkflowHealthBadge — compact inline badge for WorkflowCard
   ══════════════════════════════════════════════════════════════════════ */
export function WorkflowHealthBadge({ workflowId }: { workflowId: string }) {
  const health = useWorkflowHealth(workflowId);
  if (!health || health.tier === "unknown") return null;

  const color = HEALTH_TIER_COLOR[health.tier];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      title={`Health: ${health.score}/100 — ${HEALTH_TIER_LABEL[health.tier]}`}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          4,
        background:   `${color}10`,
        border:       `1px solid ${color}25`,
        borderRadius: 100,
        padding:      "2px 7px",
        cursor:       "default",
      }}
    >
      <TierIcon tier={health.tier} size={9} />
      <span style={{
        fontSize: 9, fontWeight: 800, color,
        fontFamily: "'DM Mono',monospace", letterSpacing: "0.05em",
      }}>
        {health.score}
      </span>
      {health.anomalies.length > 0 && (
        <SeverityDot severity={health.anomalies[0].severity} />
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   WorkflowHealthBar — reliability progress bar
   ══════════════════════════════════════════════════════════════════════ */
export function WorkflowHealthBar({ workflowId, showLabel = true }: { workflowId: string; showLabel?: boolean }) {
  const health = useWorkflowHealth(workflowId);
  if (!health || health.totalRuns < 2) return null;

  const color = HEALTH_TIER_COLOR[health.tier];
  const pct   = health.successRate * 100;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 3, background: "rgba(255,255,255,0.06)",
        borderRadius: 2, overflow: "hidden",
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.3 }}
          style={{ height: "100%", background: color, borderRadius: 2 }}
        />
      </div>
      {showLabel && (
        <span style={{
          fontSize: 9, fontWeight: 700, color,
          fontFamily: "'DM Mono',monospace", flexShrink: 0,
        }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   AnomalyFlagList — collapsible anomaly list for ExecutionDetailDrawer
   ══════════════════════════════════════════════════════════════════════ */
export function AnomalyFlagList({ workflowId }: { workflowId: string }) {
  const health = useWorkflowHealth(workflowId);
  if (!health || health.anomalies.length === 0) return null;

  const [expanded, setExpanded] = useState(false);
  const topAnomaly = health.anomalies[0];

  return (
    <div style={{
      background:   `${HEALTH_TIER_COLOR[health.tier]}08`,
      border:       `1px solid ${HEALTH_TIER_COLOR[health.tier]}20`,
      borderRadius: 10,
      overflow:     "hidden",
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: "100%", background: "none", border: "none",
          cursor: "pointer", padding: "9px 12px",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <AlertTriangle size={11} color={HEALTH_TIER_COLOR[health.tier]} />
        <span style={{
          flex: 1, textAlign: "left",
          fontSize: 11, fontWeight: 700,
          color: HEALTH_TIER_COLOR[health.tier],
          fontFamily: "'DM Sans',sans-serif",
        }}>
          {topAnomaly.message}
        </span>
        {health.anomalies.length > 1 && (
          <span style={{
            fontSize: 9, color: HEALTH_TIER_COLOR[health.tier],
            fontFamily: "'DM Mono',monospace",
          }}>
            +{health.anomalies.length - 1} more
          </span>
        )}
        {expanded ? <ChevronUp size={11} color={HEALTH_TIER_COLOR[health.tier]} /> : <ChevronDown size={11} color={HEALTH_TIER_COLOR[health.tier]} />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && health.anomalies.length > 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              borderTop: `1px solid ${HEALTH_TIER_COLOR[health.tier]}15`,
              padding: "8px 12px",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              {health.anomalies.slice(1).map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <SeverityDot severity={a.severity} />
                  <span style={{
                    fontSize: 11, color: "rgba(232,238,255,0.55)",
                    fontFamily: "'DM Sans',sans-serif",
                  }}>
                    {a.message}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   WorkflowIntelligencePanel — detailed health view for a single workflow
   ══════════════════════════════════════════════════════════════════════ */
export function WorkflowIntelligencePanel({ workflowId }: { workflowId: string }) {
  const health = useWorkflowHealth(workflowId);
  if (!health || health.totalRuns === 0) return null;

  const color = HEALTH_TIER_COLOR[health.tier];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Score row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px",
        background: `${color}08`,
        border: `1px solid ${color}18`,
        borderRadius: 10,
      }}>
        <TierIcon tier={health.tier} size={16} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color,
            fontFamily: "'DM Sans',sans-serif", marginBottom: 2,
          }}>
            {HEALTH_TIER_LABEL[health.tier]}
          </div>
          <div style={{
            fontSize: 9, color: "rgba(232,238,255,0.3)",
            fontFamily: "'DM Mono',monospace",
          }}>
            {health.totalRuns} runs · {Math.round(health.successRate * 100)}% success
          </div>
        </div>
        <div style={{
          fontSize: 22, fontWeight: 900, color,
          fontFamily: "'Syne',sans-serif", lineHeight: 1,
        }}>
          {health.score}
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {[
          { icon: Activity, label: "Success rate",   value: `${Math.round(health.successRate * 100)}%` },
          { icon: Clock,    label: "Median duration", value: formatDuration(health.p50DurationMs) },
          { icon: Zap,      label: "Last run",        value: health.lastOutcome },
          { icon: TrendIcon as any, label: "Duration trend", value: health.durationTrend.replace("_", " ") },
        ].map(({ icon: Icon, label, value }, i) => (
          <div key={i} style={{
            padding: "8px 10px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: 9, color: "rgba(232,238,255,0.3)",
              fontFamily: "'DM Mono',monospace", marginBottom: 3,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "rgba(232,238,255,0.8)",
              fontFamily: "'DM Mono',monospace",
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Anomaly flags */}
      <AnomalyFlagList workflowId={workflowId} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   OrchestrationInsightCard — dashboard intelligence surface
   ══════════════════════════════════════════════════════════════════════ */
export function OrchestrationInsightCard() {
  const { unhealthyWorkflows, globalAnomalies, totalTracked, hasIntelligence } = useOrchestrationIntelligence();
  const [expanded, setExpanded] = useState(false);

  if (!hasIntelligence) {
    return (
      <div className="af-glass" style={{
        borderRadius: 18, padding: "20px",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: "rgba(167,139,250,0.08)",
          border: "1px solid rgba(167,139,250,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Brain size={16} color="rgba(167,139,250,0.4)" />
        </div>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "rgba(232,238,255,0.5)",
            fontFamily: "'Syne',sans-serif", marginBottom: 2,
          }}>
            Orchestration Intelligence
          </div>
          <div style={{
            fontSize: 11, color: "rgba(232,238,255,0.25)",
            fontFamily: "'DM Sans',sans-serif",
          }}>
            Insights appear as executions run
          </div>
        </div>
      </div>
    );
  }

  const criticalCount = unhealthyWorkflows.filter(h => h.tier === "critical").length;
  const highAnomalies = globalAnomalies.filter(a => a.severity === "high").length;
  const overallColor  = criticalCount > 0 ? "#FB7185" : unhealthyWorkflows.length > 0 ? "#FBBF24" : "#00C896";
  const overallLabel  = criticalCount > 0 ? "Critical issues detected"
    : unhealthyWorkflows.length > 0 ? "Degradation detected"
    : "Orchestration healthy";

  return (
    <div className="af-glass" style={{
      borderRadius: 18, overflow: "hidden",
      border: `1px solid ${overallColor}18`,
      position: "relative",
    }}>
      {/* Top accent */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${overallColor}55, transparent)`,
      }} />

      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: "100%", background: "none", border: "none",
          cursor: "pointer", padding: "18px 20px",
          display: "flex", alignItems: "center", gap: 12, textAlign: "left",
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${overallColor}12`,
          border: `1px solid ${overallColor}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Brain size={16} color={overallColor} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "#E8EEFF",
            fontFamily: "'Syne',sans-serif", marginBottom: 3,
          }}>
            Orchestration Intelligence
          </div>
          <div style={{
            fontSize: 11, color: overallColor,
            fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
          }}>
            {overallLabel}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {criticalCount > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: "#FB7185",
              background: "rgba(251,113,133,0.1)",
              border: "1px solid rgba(251,113,133,0.25)",
              borderRadius: 100, padding: "2px 6px",
              fontFamily: "'DM Mono',monospace",
            }}>
              {criticalCount} CRITICAL
            </span>
          )}
          <span style={{ color: "rgba(232,238,255,0.25)" }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              borderTop: `1px solid rgba(255,255,255,0.05)`,
              padding: "14px 20px 18px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Tracked",  value: totalTracked,             color: "#94A3B8" },
                  { label: "Issues",   value: unhealthyWorkflows.length, color: overallColor },
                  { label: "Alerts",   value: highAnomalies,            color: highAnomalies > 0 ? "#FB7185" : "#94A3B8" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 8, textAlign: "center",
                  }}>
                    <div style={{
                      fontSize: 18, fontWeight: 900, color,
                      fontFamily: "'Syne',sans-serif", lineHeight: 1,
                    }}>
                      {value}
                    </div>
                    <div style={{
                      fontSize: 9, color: "rgba(232,238,255,0.3)",
                      fontFamily: "'DM Mono',monospace", marginTop: 3,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Unhealthy workflows list */}
              {unhealthyWorkflows.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {unhealthyWorkflows.slice(0, 4).map(h => {
                    const color = HEALTH_TIER_COLOR[h.tier];
                    return (
                      <motion.div
                        key={h.workflowId}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 10px",
                          background: `${color}06`,
                          border: `1px solid ${color}18`,
                          borderRadius: 8,
                        }}
                      >
                        <TierIcon tier={h.tier} size={12} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, fontWeight: 600, color: "#E8EEFF",
                            fontFamily: "'DM Sans',sans-serif",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {h.workflowName}
                          </div>
                          {h.anomalies[0] && (
                            <div style={{
                              fontSize: 10, color: "rgba(232,238,255,0.4)",
                              fontFamily: "'DM Sans',sans-serif",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {h.anomalies[0].message}
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color,
                          fontFamily: "'DM Mono',monospace", flexShrink: 0,
                        }}>
                          {h.score}
                        </span>
                        <TrendIcon trend={h.durationTrend} />
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* All healthy */}
              {unhealthyWorkflows.length === 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px",
                  background: "rgba(0,200,150,0.04)",
                  border: "1px solid rgba(0,200,150,0.12)",
                  borderRadius: 8,
                }}>
                  <ShieldCheck size={13} color="#00C896" />
                  <span style={{
                    fontSize: 12, color: "rgba(232,238,255,0.6)",
                    fontFamily: "'DM Sans',sans-serif",
                  }}>
                    All {totalTracked} tracked workflows are operating normally
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   GlobalHealthSummary — compact strip for AppShell / sidebar
   ══════════════════════════════════════════════════════════════════════ */
export function GlobalHealthSummary() {
  const { unhealthyWorkflows, totalTracked, hasIntelligence } = useOrchestrationIntelligence();
  if (!hasIntelligence || totalTracked === 0) return null;

  const issues = unhealthyWorkflows.length;
  const color  = issues > 0 ? HEALTH_TIER_COLOR[unhealthyWorkflows[0].tier] : "#00C896";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 10px",
        background: `${color}08`,
        border: `1px solid ${color}18`,
        borderRadius: 8,
      }}
    >
      <Brain size={10} color={color} />
      <span style={{
        fontSize: 10, fontWeight: 700, color,
        fontFamily: "'DM Mono',monospace",
      }}>
        {issues === 0
          ? `${totalTracked} healthy`
          : `${issues} issue${issues !== 1 ? "s" : ""}`}
      </span>
    </motion.div>
  );
}
