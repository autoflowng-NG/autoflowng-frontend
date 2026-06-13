/**
 * TeamExecutionFeed — Phase 8
 *
 * Shows org-scoped execution history with triggered_by attribution.
 * Displayed on Dashboard when an org workspace is active.
 * Falls back gracefully if no org is active.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, User, Clock, ChevronRight, Radio, GitBranch } from "lucide-react";
import { useOrg } from "../contexts/OrgContext";
import { useOrgExecutionFeed } from "../hooks/useOrgWorkflows";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { useQueryClient } from "@tanstack/react-query";
import { formatDuration } from "../hooks/useExecutionStream";

const STATUS_COLOR: Record<string, string> = {
  completed: "#00C896",
  failed:    "#FB7185",
  cancelled: "#FBBF24",
  running:   "#A78BFA",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "completed",
  failed:    "failed",
  cancelled: "cancelled",
  running:   "running",
};

interface OrgExecution {
  id:               number;
  workflow_id:      number;
  workflow_name:    string;
  status:           string;
  trigger_type:     string | null;
  triggered_by_name?: string | null;
  duration_ms:      number | null;
  started_at:       string;
  ai_summary:       string | null;
}

function ExecutionRow({ run, onSelect }: { run: OrgExecution; onSelect: () => void }) {
  const color  = STATUS_COLOR[run.status] ?? "#94A3B8";
  const isLive = run.status === "running";
  const ago    = timeAgo(run.started_at);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", cursor: "pointer",
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        transition: "background 0.15s, border-color 0.15s",
      }}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: `${color}25` }}
    >
      {/* Status dot */}
      <div style={{
        width: 7, height: 7, borderRadius: "50%",
        background: color, flexShrink: 0,
        animation: isLive ? "glw 2s ease infinite" : "none",
        boxShadow: isLive ? `0 0 6px ${color}` : "none",
      }} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: "#E8EEFF",
          fontFamily: "'DM Sans',sans-serif",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {run.workflow_name}
        </div>
        <div style={{
          display: "flex", gap: 8, marginTop: 2, alignItems: "center", flexWrap: "wrap",
        }}>
          {run.triggered_by_name && (
            <span style={{
              display: "flex", alignItems: "center", gap: 3,
              fontSize: 10, color: "rgba(232,238,255,0.4)",
              fontFamily: "'DM Mono',monospace",
            }}>
              <User size={8} /> {run.triggered_by_name}
            </span>
          )}
          <span style={{
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 10, color: "rgba(232,238,255,0.3)",
            fontFamily: "'DM Mono',monospace",
          }}>
            <Clock size={8} /> {ago}
          </span>
          {run.duration_ms !== null && (
            <span style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
              {formatDuration(run.duration_ms)}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span style={{
        fontSize: 9, fontWeight: 800, color,
        background: `${color}12`, border: `1px solid ${color}25`,
        borderRadius: 100, padding: "2px 7px",
        fontFamily: "'DM Mono',monospace", flexShrink: 0,
        textTransform: "uppercase",
      }}>
        {STATUS_LABEL[run.status] ?? run.status}
      </span>

      <ChevronRight size={11} color="rgba(232,238,255,0.2)" />
    </motion.div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000)  return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export function TeamExecutionFeed({ onSelectRun }: { onSelectRun?: (run: OrgExecution) => void }) {
  const { activeOrg } = useOrg();
  const { data: executions = [], isLoading, isError } = useOrgExecutionFeed(30);
  const { subscribe } = useWebSocketContext();
  const qc            = useQueryClient();

  // Phase 9A: Invalidate on WS org events — no more 15s polling primary path
  useEffect(() => {
    if (!activeOrg) return;
    const unsub = subscribe("*", (event) => {
      const evType = (event.event || event.type || "").toLowerCase();
      const isRun  = evType.includes("run") || evType.includes("workflow") || evType.includes("execution");
      if (!isRun) return;
      // Only invalidate for this org's events
      if (event.org_id && String(event.org_id) !== String(activeOrg.id)) return;
      qc.invalidateQueries({ queryKey: ["executions", "org", activeOrg.id] });
    });
    return unsub;
  }, [subscribe, activeOrg, qc]);
  const [filter, setFilter] = useState<"all" | "failed" | "running">("all");

  if (!activeOrg) return null;

  const filtered = filter === "all" ? executions
    : executions.filter((r: OrgExecution) => r.status === filter);

  const liveCount = executions.filter((r: OrgExecution) => r.status === "running").length;

  return (
    <div className="af-glass" style={{
      borderRadius: 18, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap",
      }}>
        <Activity size={14} color="#00C896" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", flex: 1 }}>
          Team Executions
        </span>

        {liveCount > 0 && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 800, color: "#A78BFA",
              background: "rgba(167,139,250,0.1)",
              border: "1px solid rgba(167,139,250,0.25)",
              borderRadius: 100, padding: "2px 8px",
              fontFamily: "'DM Mono',monospace",
            }}
          >
            <Radio size={8} /> {liveCount} LIVE
          </motion.div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["all", "running", "failed"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: 9, fontWeight: 700, padding: "3px 8px",
                borderRadius: 6, cursor: "pointer",
                fontFamily: "'DM Mono',monospace",
                border: `1px solid ${filter === f ? "#00C896" : "rgba(255,255,255,0.08)"}`,
                background: filter === f ? "rgba(0,200,150,0.1)" : "transparent",
                color: filter === f ? "#00C896" : "rgba(232,238,255,0.3)",
                transition: "all 0.15s",
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div style={{ padding: "10px 12px", maxHeight: 400, overflowY: "auto" }}>
        {isLoading ? (
          <div style={{
            padding: "24px 0", textAlign: "center",
            fontSize: 12, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Sans',sans-serif",
          }}>
            Loading team executions…
          </div>
        ) : isError ? (
          <div style={{
            padding: "24px 0", textAlign: "center",
            fontSize: 12, color: "#FB7185", fontFamily: "'DM Sans',sans-serif",
          }}>
            Could not load team executions
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: "32px 0", textAlign: "center",
          }}>
            <GitBranch size={24} color="rgba(0,200,150,0.15)" style={{ margin: "0 auto 10px" }} />
            <div style={{
              fontSize: 12, color: "rgba(232,238,255,0.2)",
              fontFamily: "'DM Sans',sans-serif",
            }}>
              {filter === "all" ? "No executions in the last 24 hours" : `No ${filter} executions`}
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(filtered as OrgExecution[]).map(run => (
                <ExecutionRow
                  key={run.id}
                  run={run}
                  onSelect={() => onSelectRun?.(run)}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <div style={{
          padding: "8px 18px", borderTop: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(0,0,0,0.15)",
          fontSize: 9, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Mono',monospace",
        }}>
          {filtered.length} run{filtered.length !== 1 ? "s" : ""} · {activeOrg.name} workspace · refreshes every 15s
        </div>
      )}
    </div>
  );
}
