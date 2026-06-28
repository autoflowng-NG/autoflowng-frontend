/**
 * useReplayBuffer — Phase 4
 *
 * Replay-ready execution infrastructure. Buffers all websocket events with
 * timestamps so the frontend can:
 *   1. Detect gaps in the event stream (missed events during disconnect)
 *   2. Request backend replay when it becomes available
 *   3. Re-hydrate ExecutionHistoryContext from the replay stream
 *   4. Provide execution snapshots for deep-linking (/executions/:runId)
 *
 * Backend requirements for full replay (not yet implemented backend-side):
 *   GET /api/events/replay?since=<ts>&until=<ts>  — returns missed events
 *   GET /api/executions/:runId                    — returns execution snapshot
 *
 * Until the backend supports replay, this module:
 *   - Correctly timestamps all disconnect periods
 *   - Stores gap metadata for future reconciliation
 *   - Exposes a hydrateFromReplay() entry point for when backend is ready
 *   - Provides per-run event snapshots from the local buffer
 */
import {
  useState, useEffect, useCallback, useRef,
} from "react";
import { useWebSocketContext, type WSEvent, type WSStatus } from "../contexts/WebSocketContext";
import { useExecutionHistory } from "../contexts/ExecutionHistoryContext";

/* ── Types ───────────────────────────────────────────────────────────── */
export interface BufferedEvent {
  ts:      number;
  event:   WSEvent;
  runId:   string | null;
  wfId:    string | null;
}

export interface DisconnectGap {
  from:         number;
  to:           number | null;   // null = still disconnected
  durationMs:   number | null;
  recovered:    boolean;
  missedEvents: number | null;  // populated after backend replay
}

export interface ReplayBufferState {
  /** Circular buffer of last MAX_BUFFERED events */
  buffer:     BufferedEvent[];
  /** Disconnect periods detected this session */
  gaps:       DisconnectGap[];
  /** Whether a gap is currently open (still disconnected) */
  hasOpenGap: boolean;
  /** Total events buffered this session */
  totalEvents: number;
}

export interface ReplayBufferApi extends ReplayBufferState {
  /** Returns all buffered events for a given runId */
  getRunSnapshot:  (runId: string) => BufferedEvent[];
  /** Returns events in a timestamp range (for gap reconciliation) */
  getEventRange:   (from: number, to: number) => BufferedEvent[];
  /**
   * Entry point for backend replay injection.
   * When backend GET /api/events/replay?since=X is implemented,
   * pass the response array here. It will:
   *   - Merge events into the history context
   *   - Mark the gap as recovered
   *   - Trigger re-derivation of health scores
   */
  hydrateFromReplay: (events: WSEvent[], gapIndex?: number) => Promise<void>;
  /** True when backend replay is available (feature flag) */
  replayAvailable: boolean;
  clearBuffer:     () => void;
}

/* ── Constants ───────────────────────────────────────────────────────── */
const MAX_BUFFERED    = 500;
const STORAGE_KEY_GAP = "af_replay_gaps_v1";

/* ── Gap persistence helpers ─────────────────────────────────────────── */
function loadGaps(): DisconnectGap[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_GAP);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveGaps(gaps: DisconnectGap[]) {
  try { sessionStorage.setItem(STORAGE_KEY_GAP, JSON.stringify(gaps.slice(-20))); }
  catch { /* quota */ }
}

/* ── Hook ────────────────────────────────────────────────────────────── */
export function useReplayBuffer(): ReplayBufferApi {
  const { subscribe, status } = useWebSocketContext();
  const { hydrateFromBackend } = useExecutionHistory();

  const [state, setState] = useState<ReplayBufferState>(() => ({
    buffer:      [],
    gaps:        loadGaps(),
    hasOpenGap:  false,
    totalEvents: 0,
  }));

  const gapOpenedAt = useRef<number | null>(null);

  /* ── Track disconnect gaps ── */
  const prevStatus = useRef<WSStatus>(status);
  useEffect(() => {
    const wasConnected = prevStatus.current === "authenticated";
    const isConnected  = status === "authenticated";
    const now          = Date.now();

    if (wasConnected && !isConnected) {
      // Disconnected — open a gap
      gapOpenedAt.current = now;
      setState(prev => {
        const newGap: DisconnectGap = {
          from: now, to: null, durationMs: null,
          recovered: false, missedEvents: null,
        };
        const gaps = [...prev.gaps, newGap];
        saveGaps(gaps);
        return { ...prev, gaps, hasOpenGap: true };
      });
    }

    if (!wasConnected && isConnected && gapOpenedAt.current !== null) {
      // Reconnected — close the gap
      const gapFrom = gapOpenedAt.current;
      gapOpenedAt.current = null;
      setState(prev => {
        const gaps = [...prev.gaps];
        let openIdx = -1; for (let i = gaps.length - 1; i >= 0; i--) { if ((gaps[i] as DisconnectGap).to === null) { openIdx = i; break; } }
        if (openIdx >= 0) {
          gaps[openIdx] = {
            ...gaps[openIdx],
            to:         now,
            durationMs: now - gapFrom,
            recovered:  false, // set to true after backend replay
          };
        }
        saveGaps(gaps);
        return { ...prev, gaps, hasOpenGap: false };
      });
    }

    prevStatus.current = status;
  }, [status]);

  /* ── Buffer all events ── */
  const handleEvent = useCallback((event: WSEvent) => {
    const skip = ["ping", "pong", "auth", "authenticated"];
    const evType = (event.event || event.type || "").toLowerCase();
    if (skip.includes(evType)) return;

    const entry: BufferedEvent = {
      ts:    event.ts || Date.now(),
      event,
      runId: event.run_id || event.id || null,
      wfId:  event.workflow_id || null,
    };

    setState(prev => ({
      ...prev,
      buffer:      [entry, ...prev.buffer].slice(0, MAX_BUFFERED),
      totalEvents: prev.totalEvents + 1,
    }));
  }, []);

  useEffect(() => {
    const unsub = subscribe("*", handleEvent);
    return unsub;
  }, [subscribe, handleEvent]);

  /* ── Public API ── */
  const getRunSnapshot = useCallback((runId: string): BufferedEvent[] =>
    state.buffer.filter(e => e.runId === runId),
    [state.buffer]
  );

  const getEventRange = useCallback((from: number, to: number): BufferedEvent[] =>
    state.buffer.filter(e => e.ts >= from && e.ts <= to),
    [state.buffer]
  );

  /**
   * hydrateFromReplay — called when backend replay endpoint becomes available.
   *
   * Expected backend contract:
   *   GET /api/events/replay?since=<ms>&until=<ms>
   *   → { events: WSEvent[] }
   *
   * Caller flow:
   *   const { gaps, hydrateFromReplay } = useReplayBuffer();
   *   for (const gap of gaps.filter(g => !g.recovered)) {
   *     const res = await api.get('/events/replay', { since: gap.from, until: gap.to });
   *     await hydrateFromReplay(res.events, gapIndex);
   *   }
   */
  const hydrateFromReplay = useCallback(async (events: WSEvent[], gapIndex?: number) => {
    if (events.length === 0) return;

    // Convert raw WS events into HistoricalRun format and inject into ExecutionHistoryContext
    const runs = events
      .filter(e => {
        const ev = (e.event || e.type || "").toLowerCase();
        return ev.includes("workflow") || ev.includes("run");
      })
      .map(e => {
        const now = Date.now();
        const status = (e.status || e.result || "").toLowerCase();
        return {
          runId:        e.run_id || e.id || `replay-${now}-${Math.random().toString(36).slice(2)}`,
          workflowId:   e.workflow_id,
          workflowName: e.workflow_name || e.name || "Unknown",
          outcome:      (status === "success" || status === "completed" ? "success"
            : status.includes("fail") || status.includes("error") ? "failed"
            : e.error ? "failed" : "unknown") as any,
          startedAt:    e.started_at || e.ts || now,
          finishedAt:   e.finished_at || e.ts || now,
          durationMs:   e.duration || null,
          triggerType:  e.trigger_type || null,
          stepCount:    e.step_count || null,
          error:        e.error || null,
          nodeCount:    e.node_count || 0,
        };
      })
      .filter(r => r.workflowId);

    hydrateFromBackend(runs as any);

    // Mark gap as recovered
    if (gapIndex !== undefined) {
      setState(prev => {
        const gaps = [...prev.gaps];
        if (gaps[gapIndex]) {
          gaps[gapIndex] = {
            ...gaps[gapIndex],
            recovered:    true,
            missedEvents: events.length,
          };
        }
        saveGaps(gaps);
        return { ...prev, gaps };
      });
    }
  }, [hydrateFromBackend]);

  const clearBuffer = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY_GAP);
    setState({ buffer: [], gaps: [], hasOpenGap: false, totalEvents: 0 });
  }, []);

  return {
    ...state,
    getRunSnapshot,
    getEventRange,
    hydrateFromReplay,
    replayAvailable: true, // Phase 6: backend endpoint live
    clearBuffer,
  };
}

/* ── GapIndicator component ──────────────────────────────────────────── */
/**
 * Small UI element that surfaces detected event gaps to operators.
 * Renders only when unrecovered gaps exist.
 */
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function ReplayGapIndicator() {
  const { gaps, hasOpenGap, replayAvailable } = useReplayBuffer();
  const unrecovered = gaps.filter(g => !g.recovered && g.to !== null);
  if (unrecovered.length === 0 && !hasOpenGap) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{   opacity: 0, y: -4 }}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          7,
          padding:      "5px 10px",
          background:   "rgba(251,191,36,0.07)",
          border:       "1px solid rgba(251,191,36,0.18)",
          borderRadius: 8,
        }}
      >
        <AlertTriangle size={10} color="#FBBF24" />
        <span style={{
          fontSize: 10, fontWeight: 600, color: "#FBBF24",
          fontFamily: "'DM Mono',monospace",
        }}>
          {hasOpenGap
            ? "Reconnecting — events may be missed"
            : `${unrecovered.length} event gap${unrecovered.length !== 1 ? "s" : ""} detected`}
        </span>
        {replayAvailable && !hasOpenGap && (
          <button style={{
            fontSize: 9, fontWeight: 700, color: "#FBBF24",
            background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: 6, padding: "2px 7px", cursor: "pointer",
            fontFamily: "'DM Mono',monospace",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <RefreshCw size={8} /> Replay
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
