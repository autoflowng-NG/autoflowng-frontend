/**
 * GlobalExecutionTimeline — Phase 4
 *
 * Cinematic real-time orchestration timeline. Renders workflow runs as
 * horizontal swimlanes so concurrent executions are visible side-by-side.
 *
 * Architecture:
 * - Ingests events exclusively from WebSocketContext (no new WS connection)
 * - Maintains a rolling 5-minute visible window
 * - Each workflow gets its own swimlane row
 * - Concurrent run segments rendered as colored bars
 * - Zoom levels: 1min / 5min / 15min
 * - Filter by status, search by name
 * - Replay-ready: all run data preserved with timestamps
 *
 * Real events only — no simulated timeline data.
 */
import {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { useExecutionHistory, HEALTH_TIER_COLOR } from "../contexts/ExecutionHistoryContext";
import {
  Activity, Radio, ZoomIn, ZoomOut, Filter,
  Clock, GitBranch, ChevronRight,
} from "lucide-react";
import { formatDuration } from "../hooks/useExecutionStream";

/* ── Types ───────────────────────────────────────────────────────────── */
type RunStatus = "running" | "completed" | "failed" | "cancelled";

interface TimelineRun {
  runId:        string;
  workflowId:   string;
  workflowName: string;
  status:       RunStatus;
  startedAt:    number;
  finishedAt:   number | null;
  durationMs:   number | null;
  triggerType:  string | null;
  error:        string | null;
}

interface SwimlaneRow {
  workflowId:   string;
  workflowName: string;
  runs:         TimelineRun[];
  lastActivity: number;
}

/* ── Constants ───────────────────────────────────────────────────────── */
const ZOOM_WINDOWS: Record<string, { label: string; ms: number }> = {
  "1m":  { label: "1 min",  ms:  60_000 },
  "5m":  { label: "5 min",  ms: 300_000 },
  "15m": { label: "15 min", ms: 900_000 },
};
const DEFAULT_ZOOM    = "5m";
const MAX_SWIMLANES   = 12;
const MAX_RUNS_PER_WF = 30;
const TICK_INTERVAL   = 500;   // redraw cadence while runs are live

const RUN_STATUS_COLOR: Record<RunStatus, string> = {
  running:   "#A78BFA",
  completed: "#00C896",
  failed:    "#FB7185",
  cancelled: "#FBBF24",
};

/* ── Hook: useTimelineState ──────────────────────────────────────────── */
function useTimelineState() {
  const { subscribe } = useWebSocketContext();
  const [swimlanes, setSwimlanes] = useState<Record<string, TimelineRun[]>>({});
  const [tick, setTick]           = useState(0);
  const liveCount = useRef(0);

  // Tick for live bar widths
  useEffect(() => {
    const id = setInterval(() => {
      if (liveCount.current > 0) setTick(t => t + 1);
    }, TICK_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const handleEvent = useCallback((raw: any) => {
    const ev     = (raw.event || raw.type || "").toLowerCase();
    const status = (raw.status || raw.result || "").toLowerCase();
    const skip   = ["ping", "pong", "authenticated", "auth", "connected"];
    if (skip.includes(ev)) return;

    const isWfEvent = ev.includes("workflow") || ev.includes("run") || ev.includes("execution");
    if (!isWfEvent) return;

    const wfId   = raw.workflow_id;
    const wfName = raw.workflow_name || raw.name || "Unknown";
    if (!wfId) return;

    const runId  = raw.run_id || raw.id;
    if (!runId) return;

    const isStart = ev.includes("start") || status === "running" || status === "started";
    const isEnd   = ev.includes("end") || ev.includes("complete") || ev.includes("finish")
                 || ev.includes("cancel") || status === "success" || status === "completed"
                 || status.includes("fail") || status.includes("error");

    const now = Date.now();

    setSwimlanes(prev => {
      const existing = prev[wfId] || [];
      const idx      = existing.findIndex(r => r.runId === runId);

      if (isEnd) {
        let runStatus: RunStatus = "completed";
        if (ev.includes("cancel"))                                             runStatus = "cancelled";
        else if (raw.error || status.includes("fail") || status.includes("error")) runStatus = "failed";

        if (idx >= 0) {
          const updated = [...existing];
          updated[idx] = {
            ...updated[idx],
            status:     runStatus,
            finishedAt: raw.finished_at || raw.ts || now,
            durationMs: raw.duration ?? (now - updated[idx].startedAt),
          };
          liveCount.current = Math.max(0, liveCount.current - 1);
          return { ...prev, [wfId]: updated };
        }

        // End event with no prior start — create completed entry
        const run: TimelineRun = {
          runId, workflowId: wfId, workflowName: wfName,
          status:     runStatus,
          startedAt:  raw.started_at || (raw.ts ? raw.ts - (raw.duration || 0) : now - 1000),
          finishedAt: raw.finished_at || raw.ts || now,
          durationMs: raw.duration ?? null,
          triggerType: raw.trigger_type || null,
          error:       raw.error || null,
        };
        return { ...prev, [wfId]: [run, ...existing].slice(0, MAX_RUNS_PER_WF) };
      }

      if (isStart) {
        if (idx >= 0) return prev; // already tracking
        const run: TimelineRun = {
          runId, workflowId: wfId, workflowName: wfName,
          status:      "running",
          startedAt:   raw.started_at || raw.ts || now,
          finishedAt:  null,
          durationMs:  null,
          triggerType: raw.trigger_type || null,
          error:       null,
        };
        liveCount.current += 1;
        return { ...prev, [wfId]: [run, ...existing].slice(0, MAX_RUNS_PER_WF) };
      }

      return prev;
    });
  }, []);

  useEffect(() => {
    const unsub = subscribe("*", handleEvent);
    return unsub;
  }, [subscribe, handleEvent]);

  return { swimlanes, tick };
}

/* ── TimelineBar ─────────────────────────────────────────────────────── */
function TimelineBar({
  run, windowStart, windowMs, rowHeight,
  onClick,
}: {
  run:         TimelineRun;
  windowStart: number;
  windowMs:    number;
  rowHeight:   number;
  onClick:     (run: TimelineRun) => void;
}) {
  const now         = Date.now();
  const barStart    = Math.max(run.startedAt, windowStart);
  const barEnd      = run.finishedAt ?? now;
  const windowEnd   = windowStart + windowMs;

  if (barStart > windowEnd || barEnd < windowStart) return null;

  const leftPct  = ((barStart - windowStart) / windowMs) * 100;
  const widthPct = ((Math.min(barEnd, windowEnd) - barStart) / windowMs) * 100;

  if (widthPct < 0.1) return null;

  const color    = RUN_STATUS_COLOR[run.status];
  const isLive   = run.status === "running";
  const barH     = rowHeight * 0.55;
  const topOffset = (rowHeight - barH) / 2;

  return (
    <motion.div
      layout
      title={`${run.workflowName} — ${run.status}${run.durationMs ? ` (${formatDuration(run.durationMs)})` : ""}`}
      onClick={() => onClick(run)}
      style={{
        position:     "absolute",
        left:         `${Math.max(0, leftPct)}%`,
        width:        `${Math.max(widthPct, 0.5)}%`,
        top:          topOffset,
        height:       barH,
        background:   isLive
          ? `linear-gradient(90deg, ${color}cc, ${color})`
          : `${color}bb`,
        borderRadius: 4,
        cursor:       "pointer",
        overflow:     "hidden",
        boxShadow:    isLive ? `0 0 8px ${color}60` : "none",
        border:       `1px solid ${color}50`,
        minWidth:     4,
      }}
      whileHover={{ scaleY: 1.15, filter: "brightness(1.2)" }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {/* Shimmer sweep for running bars */}
      {isLive && (
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear", repeatDelay: 0.3 }}
          style={{
            position:   "absolute", inset: 0,
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
            width:      "50%",
          }}
        />
      )}
    </motion.div>
  );
}

/* ── TimelineRow ─────────────────────────────────────────────────────── */
function TimelineRow({
  lane, windowStart, windowMs, rowHeight,
  onRunClick, index,
}: {
  lane:        SwimlaneRow;
  windowStart: number;
  windowMs:    number;
  rowHeight:   number;
  onRunClick:  (run: TimelineRun) => void;
  index:       number;
}) {
  const { getWorkflowHealth } = useExecutionHistory();
  const health = getWorkflowHealth(lane.workflowId);
  const tierColor = health ? HEALTH_TIER_COLOR[health.tier] : "#94A3B8";
  const hasLive   = lane.runs.some(r => r.status === "running");

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        display:      "grid",
        gridTemplateColumns: "180px 1fr",
        height:       rowHeight,
        borderBottom: "1px solid rgba(255,255,255,0.035)",
      }}
    >
      {/* Label */}
      <div style={{
        display:    "flex",
        alignItems: "center",
        gap:        7,
        padding:    "0 12px",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        background:  "rgba(0,0,0,0.15)",
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: tierColor, flexShrink: 0,
          animation: hasLive ? "glw 2s ease infinite" : "none",
          boxShadow: hasLive ? `0 0 6px ${tierColor}` : "none",
        }} />
        <span style={{
          fontSize:     11,
          fontWeight:   600,
          color:        "rgba(232,238,255,0.7)",
          fontFamily:   "'DM Sans',sans-serif",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
        }}>
          {lane.workflowName}
        </span>
        {hasLive && (
          <Radio size={9} color="#A78BFA" style={{ flexShrink: 0, animation: "glw 1.5s ease infinite" }} />
        )}
      </div>

      {/* Bars */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {lane.runs.map(run => (
          <TimelineBar
            key={run.runId}
            run={run}
            windowStart={windowStart}
            windowMs={windowMs}
            rowHeight={rowHeight}
            onClick={onRunClick}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ── RunDetailTooltip ────────────────────────────────────────────────── */
function RunDetailTooltip({
  run, onClose,
}: {
  run:     TimelineRun;
  onClose: () => void;
}) {
  const color = RUN_STATUS_COLOR[run.status];
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [run.runId, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{   opacity: 0, y: 6 }}
      style={{
        position:     "absolute",
        bottom:       8,
        left:         "50%",
        transform:    "translateX(-50%)",
        zIndex:       100,
        background:   "rgba(6,9,20,0.97)",
        border:       `1px solid ${color}30`,
        borderRadius: 10,
        padding:      "10px 14px",
        minWidth:     200,
        boxShadow:    "0 8px 32px rgba(0,0,0,0.5)",
        backdropFilter: "blur(16px)",
        pointerEvents:  "none",
      }}
    >
      <div style={{
        fontSize: 12, fontWeight: 700, color: "#E8EEFF",
        fontFamily: "'DM Sans',sans-serif", marginBottom: 5,
      }}>
        {run.workflowName}
      </div>
      {[
        ["Status",   run.status],
        ["Duration", formatDuration(run.durationMs)],
        ["Trigger",  run.triggerType || "—"],
        ["Run ID",   run.runId.slice(0, 12) + "…"],
      ].map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
          <span style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>{k}</span>
          <span style={{ fontSize: 10, color, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{v}</span>
        </div>
      ))}
      {run.error && (
        <div style={{
          marginTop: 6, padding: "4px 7px",
          background: "rgba(251,113,133,0.08)",
          border: "1px solid rgba(251,113,133,0.2)",
          borderRadius: 6,
          fontSize: 10, color: "#FB7185",
          fontFamily: "'DM Sans',sans-serif",
        }}>
          {run.error}
        </div>
      )}
    </motion.div>
  );
}

/* ── TimelineRuler ───────────────────────────────────────────────────── */
function TimelineRuler({ windowStart, windowMs }: { windowStart: number; windowMs: number }) {
  const ticks = 6;
  return (
    <div style={{
      display:     "grid",
      gridTemplateColumns: "180px 1fr",
      height:      24,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background:   "rgba(0,0,0,0.2)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", paddingLeft: 12,
        borderRight: "1px solid rgba(255,255,255,0.04)",
      }}>
        <span style={{
          fontSize: 9, color: "rgba(232,238,255,0.25)",
          fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Workflow
        </span>
      </div>
      <div style={{ position: "relative", overflow: "hidden" }}>
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const pct = (i / ticks) * 100;
          const ts  = windowStart + (i / ticks) * windowMs;
          const t   = new Date(ts);
          const lbl = `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}:${t.getSeconds().toString().padStart(2, "0")}`;
          return (
            <div key={i} style={{
              position: "absolute", left: `${pct}%`, top: 0, bottom: 0,
              display: "flex", alignItems: "center",
            }}>
              <span style={{
                fontSize: 8, color: "rgba(232,238,255,0.2)",
                fontFamily: "'DM Mono',monospace",
                transform: "translateX(-50%)",
                display: "block", whiteSpace: "nowrap",
              }}>
                {lbl}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */
export function GlobalExecutionTimeline() {
  const { swimlanes, tick } = useTimelineState();
  const [zoom,        setZoom]        = useState(DEFAULT_ZOOM);
  const [statusFilter, setStatusFilter] = useState<RunStatus | "all">("all");
  const [selected,    setSelected]    = useState<TimelineRun | null>(null);
  const now = Date.now();

  const windowMs    = ZOOM_WINDOWS[zoom].ms;
  const windowStart = now - windowMs;

  // Build sorted lanes
  const lanes: SwimlaneRow[] = useMemo(() => {
    return Object.entries(swimlanes)
      .map(([wfId, runs]): SwimlaneRow => ({
        workflowId:   wfId,
        workflowName: runs[0]?.workflowName ?? wfId,
        runs:         statusFilter === "all"
          ? runs
          : runs.filter(r => r.status === statusFilter),
        lastActivity: runs[0]?.finishedAt ?? runs[0]?.startedAt ?? 0,
      }))
      .filter(l => l.runs.some(r => r.startedAt > windowStart || r.status === "running"))
      .sort((a, b) => {
        const aLive = a.runs.some(r => r.status === "running");
        const bLive = b.runs.some(r => r.status === "running");
        if (aLive !== bLive) return aLive ? -1 : 1;
        return b.lastActivity - a.lastActivity;
      })
      .slice(0, MAX_SWIMLANES);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swimlanes, zoom, statusFilter, tick]);

  const ROW_H       = 40;
  const liveCount   = lanes.reduce((n, l) => n + l.runs.filter(r => r.status === "running").length, 0);
  const isEmpty     = lanes.length === 0;

  return (
    <div className="af-glass" style={{
      borderRadius: 18, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      position: "relative",
    }}>
      {/* ── Header ── */}
      <div style={{
        display:     "flex",
        alignItems:  "center",
        gap:         12,
        padding:     "14px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexWrap:    "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <Activity size={14} color="#A78BFA" />
          <span style={{
            fontSize: 13, fontWeight: 700, color: "#E8EEFF",
            fontFamily: "'Syne',sans-serif",
          }}>
            Execution Timeline
          </span>
          {liveCount > 0 && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                fontSize: 10, fontWeight: 800, color: "#A78BFA",
                background: "rgba(167,139,250,0.1)",
                border: "1px solid rgba(167,139,250,0.25)",
                borderRadius: 100, padding: "2px 7px",
                fontFamily: "'DM Mono',monospace",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <Radio size={8} /> {liveCount} LIVE
            </motion.span>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* Status filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "running", "completed", "failed"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  fontSize: 9, fontWeight: 700,
                  padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                  fontFamily: "'DM Mono',monospace",
                  border: `1px solid ${statusFilter === s ? (s === "all" ? "#A78BFA" : RUN_STATUS_COLOR[s as RunStatus] ?? "#A78BFA") : "rgba(255,255,255,0.1)"}`,
                  background: statusFilter === s
                    ? `${s === "all" ? "#A78BFA" : RUN_STATUS_COLOR[s as RunStatus] ?? "#A78BFA"}15`
                    : "transparent",
                  color: statusFilter === s
                    ? (s === "all" ? "#A78BFA" : RUN_STATUS_COLOR[s as RunStatus] ?? "#A78BFA")
                    : "rgba(232,238,255,0.3)",
                  transition: "all 0.15s",
                }}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Zoom control */}
          <div style={{ display: "flex", gap: 4 }}>
            {Object.entries(ZOOM_WINDOWS).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setZoom(key)}
                style={{
                  fontSize: 9, fontWeight: 700, padding: "3px 8px",
                  borderRadius: 6, cursor: "pointer",
                  fontFamily: "'DM Mono',monospace",
                  border: `1px solid ${zoom === key ? "rgba(56,189,248,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: zoom === key ? "rgba(56,189,248,0.1)" : "transparent",
                  color: zoom === key ? "#38BDF8" : "rgba(232,238,255,0.3)",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Timeline body ── */}
      {isEmpty ? (
        <div style={{
          padding: "48px 24px", textAlign: "center",
        }}>
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            style={{ marginBottom: 12 }}
          >
            <GitBranch size={28} color="rgba(167,139,250,0.2)" />
          </motion.div>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "rgba(232,238,255,0.25)",
            fontFamily: "'DM Sans',sans-serif",
          }}>
            Timeline activates as workflows execute
          </div>
          <div style={{
            fontSize: 11, color: "rgba(232,238,255,0.15)",
            fontFamily: "'DM Mono',monospace", marginTop: 6,
          }}>
            window: last {ZOOM_WINDOWS[zoom].label}
          </div>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <TimelineRuler windowStart={windowStart} windowMs={windowMs} />
          <div style={{ overflowY: "auto", maxHeight: ROW_H * MAX_SWIMLANES }}>
            <AnimatePresence initial={false}>
              {lanes.map((lane, i) => (
                <TimelineRow
                  key={lane.workflowId}
                  lane={lane}
                  windowStart={windowStart}
                  windowMs={windowMs}
                  rowHeight={ROW_H}
                  onRunClick={setSelected}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Run tooltip */}
          <AnimatePresence>
            {selected && (
              <RunDetailTooltip run={selected} onClose={() => setSelected(null)} />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Footer ── */}
      {!isEmpty && (
        <div style={{
          display:     "flex",
          alignItems:  "center",
          gap:         8,
          padding:     "8px 18px",
          borderTop:   "1px solid rgba(255,255,255,0.04)",
          background:  "rgba(0,0,0,0.15)",
        }}>
          <Clock size={9} color="rgba(232,238,255,0.2)" />
          <span style={{
            fontSize: 9, color: "rgba(232,238,255,0.2)",
            fontFamily: "'DM Mono',monospace",
          }}>
            {lanes.length} workflow{lanes.length !== 1 ? "s" : ""} ·{" "}
            {lanes.reduce((n, l) => n + l.runs.length, 0)} runs in window ·{" "}
            window: {ZOOM_WINDOWS[zoom].label}
          </span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   HistoricalTimeline — Phase 5 scrubbing extension
   Uses ExecutionHistoryContext to show past runs beyond live window.
   ══════════════════════════════════════════════════════════════════════ */
export function HistoricalTimeline() {
  const { history } = useExecutionHistory();
  const [scrubOffset, setScrubOffset] = useState(0); // minutes back from now
  const [isDragging,  setIsDragging]  = useState(false);
  const dragStartX    = useRef<number | null>(null);
  const dragStartOff  = useRef(0);
  const containerRef  = useRef<HTMLDivElement>(null);

  const WINDOW_MS  = 15 * 60_000; // 15-minute view
  const now        = Date.now();
  const viewEnd    = now - scrubOffset * 60_000;
  const viewStart  = viewEnd - WINDOW_MS;

  // Build historical lanes from ExecutionHistoryContext
  const historicalLanes = useMemo(() => {
    return Object.entries(history)
      .map(([wfId, runs]) => ({
        workflowId:   wfId,
        workflowName: runs[0]?.workflowName ?? wfId,
        runs: runs
          .filter(r => r.finishedAt && r.finishedAt > viewStart && r.startedAt < viewEnd)
          .map(r => ({
            runId:        r.runId,
            workflowId:   wfId,
            workflowName: r.workflowName,
            status:       (r.outcome === "success" ? "completed"
              : r.outcome === "failed" ? "failed"
              : r.outcome === "cancelled" ? "cancelled" : "completed") as RunStatus,
            startedAt:    r.startedAt,
            finishedAt:   r.finishedAt,
            durationMs:   r.durationMs,
            triggerType:  r.triggerType,
            error:        r.error,
          })),
      }))
      .filter(l => l.runs.length > 0)
      .slice(0, MAX_SWIMLANES);
  }, [history, viewStart, viewEnd]);

  const maxOffset = 24 * 60; // 24h back
  const ROW_H = 38;
  const isEmpty = historicalLanes.length === 0;

  // Drag-to-scrub handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartX.current   = e.clientX;
    dragStartOff.current = scrubOffset;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragStartX.current === null || !containerRef.current) return;
    const containerW  = containerRef.current.clientWidth - 180;
    const deltaPx     = dragStartX.current - e.clientX;
    const deltaMinutes = (deltaPx / containerW) * (WINDOW_MS / 60_000);
    const newOffset   = Math.max(0, Math.min(maxOffset, dragStartOff.current + deltaMinutes));
    setScrubOffset(Math.round(newOffset));
  };
  const onMouseUp = () => { setIsDragging(false); dragStartX.current = null; };

  return (
    <div className="af-glass" style={{
      borderRadius: 18, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <Activity size={13} color="#38BDF8" />
          <span style={{
            fontSize: 13, fontWeight: 700, color: "#E8EEFF",
            fontFamily: "'Syne',sans-serif",
          }}>
            Historical Timeline
          </span>
          <span style={{
            fontSize: 10, color: "rgba(232,238,255,0.3)",
            fontFamily: "'DM Mono',monospace",
          }}>
            {scrubOffset === 0 ? "now" : `−${scrubOffset}m`}
          </span>
        </div>

        {/* Scrub control */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>
            now
          </span>
          <input
            type="range"
            min={0}
            max={maxOffset}
            value={scrubOffset}
            onChange={e => setScrubOffset(Number(e.target.value))}
            style={{ width: 120, accentColor: "#38BDF8", cursor: "pointer" }}
          />
          <span style={{ fontSize: 9, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>
            −24h
          </span>
          {scrubOffset > 0 && (
            <button
              onClick={() => setScrubOffset(0)}
              style={{
                fontSize: 9, fontWeight: 700, color: "#38BDF8",
                background: "rgba(56,189,248,0.1)",
                border: "1px solid rgba(56,189,248,0.25)",
                borderRadius: 6, padding: "3px 8px",
                cursor: "pointer", fontFamily: "'DM Mono',monospace",
              }}
            >
              LIVE
            </button>
          )}
        </div>
      </div>

      {/* Timeline body — drag to scrub */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
      >
        {isEmpty ? (
          <div style={{ padding: "36px 24px", textAlign: "center" }}>
            <div style={{
              fontSize: 12, color: "rgba(232,238,255,0.2)",
              fontFamily: "'DM Sans',sans-serif",
            }}>
              {scrubOffset === 0
                ? "No execution history in view"
                : `No executions in the −${scrubOffset}m window`}
            </div>
          </div>
        ) : (
          <div>
            <TimelineRuler windowStart={viewStart} windowMs={WINDOW_MS} />
            <AnimatePresence initial={false}>
              {historicalLanes.map((lane, i) => (
                <TimelineRow
                  key={lane.workflowId}
                  lane={lane as SwimlaneRow}
                  windowStart={viewStart}
                  windowMs={WINDOW_MS}
                  rowHeight={ROW_H}
                  onRunClick={() => {}}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "7px 18px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(0,0,0,0.15)",
        fontSize: 9, color: "rgba(232,238,255,0.2)",
        fontFamily: "'DM Mono',monospace",
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <Clock size={9} color="rgba(232,238,255,0.2)" />
        Drag timeline to scrub · {historicalLanes.length} workflows ·{" "}
        {new Date(viewStart).toLocaleTimeString()} → {new Date(viewEnd).toLocaleTimeString()}
      </div>
    </div>
  );
}
