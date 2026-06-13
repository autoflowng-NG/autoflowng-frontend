/**
 * ExecutionDetailDrawer — Phase 3
 *
 * Cinematic side drawer that renders full execution detail when a live event
 * is clicked. Shows:
 *  - Run metadata (workflow name, trigger, status, duration)
 *  - Node progression timeline
 *  - Ordered execution log stream
 *  - Collapsible runtime diagnostics
 *
 * All data sourced from real websocket events via useExecutionStream.
 * No simulated/fake data.
 */
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, GitBranch, Zap, Clock, CheckCircle2, XCircle,
  AlertCircle, Circle, ChevronDown, ChevronUp,
  Activity, Radio, Loader,
} from "lucide-react";
import { useExecutionStream, formatDuration, type ExecutionState, type NodeState, type ExecutionLogEntry } from "../hooks/useExecutionStream";
import { WorkflowIntelligencePanel, AnomalyFlagList } from "./OrchestrationIntelligence";
import { ExecutionSummaryPanel } from "./ExecutionSummaryPanel";
import { RecommendationList } from "./PredictiveInsightsPanel";
import { ExecutionShareButton } from "./EnterpriseOpsCenter";
import type { LiveEvent } from "../hooks/useLiveEvents";

/* ── Phase colours ───────────────────────────────────────────────────── */
const PHASE_COLOR: Record<string, string> = {
  idle:      "#94A3B8",
  starting:  "#38BDF8",
  running:   "#A78BFA",
  completed: "#00C896",
  failed:    "#FB7185",
  cancelled: "#FBBF24",
};

/* ── Node status icons ───────────────────────────────────────────────── */
function NodeIcon({ status }: { status: NodeState["status"] }) {
  const props = { size: 13 };
  if (status === "success")  return <CheckCircle2 {...props} color="#00C896" />;
  if (status === "failed")   return <XCircle      {...props} color="#FB7185" />;
  if (status === "running")  return <Loader       {...props} color="#A78BFA" style={{ animation: "spin-slow 1.2s linear infinite" }} />;
  if (status === "skipped")  return <AlertCircle  {...props} color="#FBBF24" />;
  return <Circle {...props} color="rgba(232,238,255,0.2)" />;
}

/* ── Log entry ───────────────────────────────────────────────────────── */
function LogRow({ entry, index }: { entry: ExecutionLogEntry; index: number }) {
  const color = PHASE_COLOR[entry.phase] ?? "#94A3B8";
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      style={{
        display:    "flex",
        alignItems: "flex-start",
        gap:        10,
        padding:    "7px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Timeline dot */}
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: color, flexShrink: 0, marginTop: 4,
        boxShadow: entry.phase === "running" ? `0 0 6px ${color}` : "none",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: "rgba(232,238,255,0.85)",
          fontFamily: "'DM Sans',sans-serif",
          lineHeight: 1.4,
        }}>
          {entry.message}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 2, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, color: "rgba(232,238,255,0.25)",
            fontFamily: "'DM Mono',monospace",
          }}>
            {new Date(entry.ts).toLocaleTimeString()}
          </span>
          {entry.nodeName && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: color, background: `${color}12`,
              border: `1px solid ${color}25`,
              borderRadius: 4, padding: "1px 5px",
              fontFamily: "'DM Mono',monospace",
            }}>
              {entry.nodeName}
            </span>
          )}
          {entry.durationMs !== undefined && (
            <span style={{
              fontSize: 9, color: "rgba(232,238,255,0.3)",
              fontFamily: "'DM Mono',monospace",
            }}>
              {formatDuration(entry.durationMs)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Node timeline ────────────────────────────────────────────────────── */
function NodeTimeline({ nodes }: { nodes: NodeState[] }) {
  if (nodes.length === 0) return null;
  return (
    <div>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
        color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace",
        textTransform: "uppercase", marginBottom: 10,
      }}>
        Node Progression
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          10,
              padding:      "7px 10px",
              background:   "rgba(255,255,255,0.02)",
              border:       "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
            }}
          >
            <NodeIcon status={node.status} />
            <span style={{
              flex: 1, fontSize: 12, fontWeight: 600,
              color: "rgba(232,238,255,0.75)",
              fontFamily: "'DM Sans',sans-serif",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {node.name}
            </span>
            {node.durationMs !== undefined && (
              <span style={{
                fontSize: 9, color: "rgba(232,238,255,0.25)",
                fontFamily: "'DM Mono',monospace", flexShrink: 0,
              }}>
                {formatDuration(node.durationMs)}
              </span>
            )}
            {node.error && (
              <span style={{
                fontSize: 9, color: "#FB7185",
                fontFamily: "'DM Mono',monospace",
                overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100,
              }}>
                {node.error}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Runtime diagnostics (collapsible) ──────────────────────────────── */
function RuntimeDiagnostics({ execution, event }: { execution: ExecutionState; event: LiveEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background:   "rgba(0,0,0,0.25)",
      border:       "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10,
      overflow:     "hidden",
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", background: "none", border: "none",
          cursor: "pointer", padding: "10px 12px",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <Activity size={11} color="rgba(232,238,255,0.3)" />
        <span style={{
          flex: 1, fontSize: 10, fontWeight: 700, textAlign: "left",
          color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace",
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          Runtime Diagnostics
        </span>
        {open ? <ChevronUp size={11} color="rgba(232,238,255,0.3)" /> : <ChevronDown size={11} color="rgba(232,238,255,0.3)" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.05)",
              padding: "12px",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              {[
                ["Run ID",        execution.runId || event.raw?.run_id || "—"],
                ["Workflow ID",   execution.workflowId || event.raw?.workflow_id || "—"],
                ["Trigger",       execution.triggerType || event.raw?.trigger_type || "—"],
                ["Steps",         execution.stepCount ?? event.raw?.step_count ?? "—"],
                ["Duration",      formatDuration(execution.durationMs ?? event.raw?.duration ?? null)],
                ["Log entries",   execution.logs.length],
                ["Started",       execution.startedAt ? new Date(execution.startedAt).toLocaleTimeString() : "—"],
                ["Finished",      execution.finishedAt ? new Date(execution.finishedAt).toLocaleTimeString() : "—"],
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{
                    fontSize: 10, color: "rgba(232,238,255,0.3)",
                    fontFamily: "'DM Mono',monospace",
                  }}>
                    {k}
                  </span>
                  <span style={{
                    fontSize: 10, color: "rgba(232,238,255,0.65)",
                    fontFamily: "'DM Mono',monospace", textAlign: "right",
                    overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160,
                  }}>
                    {String(v)}
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

/* ── Drawer ──────────────────────────────────────────────────────────── */
interface ExecutionDetailDrawerProps {
  event: LiveEvent | null;
  onClose: () => void;
}

export function ExecutionDetailDrawer({ event, onClose }: ExecutionDetailDrawerProps) {
  const { execution } = useExecutionStream(event?.raw?.workflow_id);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const phaseColor = PHASE_COLOR[execution.phase] ?? "#94A3B8";

  /* Auto-scroll logs when new entries arrive */
  useEffect(() => {
    if (execution.phase === "running") {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [execution.logs.length, execution.phase]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const workflowName = execution.workflowName || event?.raw?.workflow_name || event?.title || "Execution";
  const displayPhase = execution.phase !== "idle" ? execution.phase : (event?.status ?? "pending");
  const displayColor = PHASE_COLOR[displayPhase] ?? phaseColor;

  return (
    <AnimatePresence>
      {event && (
        <>
          {/* Backdrop */}
          <motion.div
            key="exec-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 800,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            }}
          />

          {/* Drawer panel */}
          <motion.div
            key="exec-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            style={{
              position:   "fixed",
              top: 0, right: 0, bottom: 0,
              width:      "min(480px, 100vw)",
              zIndex:     900,
              background: "rgba(6,9,20,0.97)",
              backdropFilter: "blur(28px)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              display:    "flex",
              flexDirection: "column",
              overflow:   "hidden",
            }}
          >
            {/* Accent top bar */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${displayColor}, transparent)`,
              opacity: 0.7,
            }} />

            {/* ── Header ── */}
            <div style={{
              padding:    "20px 20px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Phase badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: displayColor, flexShrink: 0,
                      animation: displayPhase === "running" ? "glw 2s ease infinite" : "none",
                      boxShadow: displayPhase === "running" ? `0 0 8px ${displayColor}` : "none",
                    }} />
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      color: displayColor, fontFamily: "'DM Mono',monospace",
                      letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>
                      {displayPhase}
                    </span>
                    {execution.phase === "running" && (
                      <span style={{
                        fontSize: 10, color: "rgba(232,238,255,0.4)",
                        fontFamily: "'DM Mono',monospace",
                      }}>
                        {formatDuration(execution.elapsedMs)}
                      </span>
                    )}
                    {execution.durationMs !== null && execution.phase !== "running" && (
                      <span style={{
                        fontSize: 10, color: "rgba(232,238,255,0.4)",
                        fontFamily: "'DM Mono',monospace",
                      }}>
                        {formatDuration(execution.durationMs)}
                      </span>
                    )}
                  </div>

                  <h2 style={{
                    fontSize: 17, fontWeight: 800,
                    fontFamily: "'Syne',sans-serif",
                    color: "#E8EEFF", lineHeight: 1.2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {workflowName}
                  </h2>

                  <div style={{
                    display: "flex", gap: 10, marginTop: 6,
                    alignItems: "center", flexWrap: "wrap",
                  }}>
                    {(execution.triggerType || event.raw?.trigger_type) && (
                      <span style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 10, color: "rgba(232,238,255,0.4)",
                        fontFamily: "'DM Mono',monospace",
                      }}>
                        <Zap size={9} />
                        {execution.triggerType || event.raw?.trigger_type}
                      </span>
                    )}
                    {execution.nodes.length > 0 && (
                      <span style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 10, color: "rgba(232,238,255,0.4)",
                        fontFamily: "'DM Mono',monospace",
                      }}>
                        <GitBranch size={9} />
                        {execution.nodes.length} node{execution.nodes.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {event.ts && (
                      <span style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 10, color: "rgba(232,238,255,0.4)",
                        fontFamily: "'DM Mono',monospace",
                      }}>
                        <Clock size={9} />
                        {new Date(event.ts).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "rgba(232,238,255,0.5)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLButtonElement).style.color = "#E8EEFF";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(232,238,255,0.5)";
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* ── Body — scrollable ── */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "18px 20px",
              display: "flex", flexDirection: "column", gap: 20,
            }}>
              {/* Node progression */}
              {execution.nodes.length > 0 && (
                <NodeTimeline nodes={execution.nodes} />
              )}

              {/* AI Summary */}
              <ExecutionSummaryPanel
                runId={execution.runId ?? event?.raw?.run_id ?? null}
                phase={execution.phase !== "idle" ? execution.phase : (event?.status ?? "pending")}
                autoFetch={false}
              />

              {/* Intelligence panel */}
              {event?.raw?.workflow_id && (
                <WorkflowIntelligencePanel workflowId={String(event.raw.workflow_id)} />
              )}

              {/* Recommendations */}
              {event?.raw?.workflow_id && (
                <RecommendationList workflowId={String(event.raw.workflow_id)} />
              )}

              {/* Live log stream */}
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                    color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace",
                    textTransform: "uppercase", flex: 1,
                  }}>
                    Execution Log
                  </div>
                  {execution.phase === "running" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Radio size={9} color="#A78BFA" style={{ animation: "glw 1.5s ease infinite" }} />
                      <span style={{ fontSize: 9, color: "#A78BFA", fontFamily: "'DM Mono',monospace" }}>
                        LIVE
                      </span>
                    </div>
                  )}
                </div>

                {execution.logs.length === 0 ? (
                  <div style={{
                    padding: "24px 0", textAlign: "center",
                    fontSize: 12, color: "rgba(232,238,255,0.2)",
                    fontFamily: "'DM Sans',sans-serif",
                  }}>
                    {execution.phase === "running"
                      ? "Awaiting execution events…"
                      : "No log entries captured for this run."}
                  </div>
                ) : (
                  <div>
                    {[...execution.logs].reverse().map((entry, i) => (
                      <LogRow key={entry.id} entry={entry} index={i} />
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>

              {/* Runtime diagnostics */}
              <RuntimeDiagnostics execution={execution} event={event} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
