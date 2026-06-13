/**
 * useExecutionStream — Phase 3
 *
 * Tracks live execution state for any workflow run using the shared
 * WebSocketContext. Provides timeline-ordered log entries, node
 * progression, duration tracking, and execution state transitions.
 *
 * Only real websocket events are consumed — no fake/simulated data.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";

/* ── Types ──────────────────────────────────────────────────────────── */
export type ExecutionPhase =
  | "idle"
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ExecutionLogEntry {
  id: string;
  ts: number;
  phase: ExecutionPhase;
  nodeId?: string;
  nodeName?: string;
  message: string;
  durationMs?: number;
  meta?: Record<string, any>;
}

export interface NodeState {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  error?: string;
}

export interface ExecutionState {
  runId: string | null;
  workflowId: string | null;
  workflowName: string | null;
  phase: ExecutionPhase;
  startedAt: number | null;
  finishedAt: number | null;
  durationMs: number | null;
  /** Live elapsed ms (updated every 100ms while running) */
  elapsedMs: number;
  logs: ExecutionLogEntry[];
  nodes: NodeState[];
  error: string | null;
  triggerType: string | null;
  stepCount: number | null;
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function toPhase(raw: any): ExecutionPhase {
  const ev     = (raw.event || raw.type || "").toLowerCase();
  const status = (raw.status || raw.result || "").toLowerCase();

  if (ev.includes("start") || status === "running" || status === "started") return "running";
  if (ev.includes("cancel")) return "cancelled";
  if (
    status === "success" || status === "complete" || status === "completed" ||
    ev.includes("end") || ev.includes("complete") || ev.includes("finish")
  ) {
    if (raw.error || status.includes("fail") || status.includes("error")) return "failed";
    return "completed";
  }
  if (status.includes("fail") || status.includes("error") || raw.error) return "failed";
  return "running";
}

function buildLogEntry(raw: any, phase: ExecutionPhase): ExecutionLogEntry {
  const messages: Record<ExecutionPhase, string> = {
    idle:      "Execution queued",
    starting:  "Execution starting…",
    running:   raw.message || raw.workflow_name
      ? `Running ${raw.workflow_name || raw.name || "workflow"}…`
      : "Execution in progress",
    completed: raw.workflow_name
      ? `${raw.workflow_name} completed successfully`
      : "Execution completed",
    failed:    raw.error || "Execution failed",
    cancelled: "Execution cancelled",
  };

  return {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ts:        raw.ts || raw.timestamp || Date.now(),
    phase,
    nodeId:    raw.node_id,
    nodeName:  raw.node_name,
    message:   messages[phase],
    durationMs: raw.duration,
    meta:      raw,
  };
}

function buildNodeState(raw: any): NodeState | null {
  if (!raw.node_id) return null;
  const status = (raw.status || "").toLowerCase();
  return {
    id:         raw.node_id,
    name:       raw.node_name || raw.node_id,
    status:     status.includes("fail") || status.includes("error") ? "failed"
               : status.includes("success") || status.includes("complete") ? "success"
               : status === "running" || status === "started" ? "running"
               : status === "skipped" ? "skipped"
               : "pending",
    startedAt:  raw.started_at || (raw.event?.includes("start") ? raw.ts : undefined),
    finishedAt: raw.finished_at,
    durationMs: raw.duration,
    error:      raw.error,
  };
}

const EMPTY_STATE: ExecutionState = {
  runId:        null,
  workflowId:   null,
  workflowName: null,
  phase:        "idle",
  startedAt:    null,
  finishedAt:   null,
  durationMs:   null,
  elapsedMs:    0,
  logs:         [],
  nodes:        [],
  error:        null,
  triggerType:  null,
  stepCount:    null,
};

const MAX_LOGS = 200;

/* ── Hook ────────────────────────────────────────────────────────────── */
export function useExecutionStream(workflowId?: string) {
  const { subscribe } = useWebSocketContext();
  const [state, setState] = useState<ExecutionState>(EMPTY_STATE);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Start elapsed ticker */
  const startTicker = useCallback((startedAt: number) => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setState(s =>
        s.phase === "running" || s.phase === "starting"
          ? { ...s, elapsedMs: Date.now() - startedAt }
          : s
      );
    }, 100);
  }, []);

  const stopTicker = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  useEffect(() => () => stopTicker(), [stopTicker]);

  const handleEvent = useCallback((raw: any) => {
    const ev = (raw.event || raw.type || "").toLowerCase();
    const skipped = ["ping", "pong", "authenticated", "auth", "connected"];
    if (skipped.includes(ev)) return;

    /* Filter by workflowId if provided */
    if (workflowId && raw.workflow_id && raw.workflow_id !== workflowId) return;

    const isWorkflowEvent =
      ev.includes("workflow") || ev.includes("run") || ev.includes("execution");
    if (!isWorkflowEvent) return;

    const phase = toPhase(raw);
    const logEntry = buildLogEntry(raw, phase);
    const nodeState = buildNodeState(raw);

    setState(prev => {
      const now = Date.now();
      const startedAt = phase === "running" && !prev.startedAt ? now : prev.startedAt;
      const finishedAt = (phase === "completed" || phase === "failed" || phase === "cancelled")
        ? (raw.finished_at || now)
        : prev.finishedAt;
      const durationMs = raw.duration ?? (
        startedAt && finishedAt ? finishedAt - startedAt : prev.durationMs
      );

      /* Update node list */
      let nodes = [...prev.nodes];
      if (nodeState) {
        const idx = nodes.findIndex(n => n.id === nodeState.id);
        if (idx >= 0) nodes[idx] = { ...nodes[idx], ...nodeState };
        else nodes = [...nodes, nodeState];
      }

      const next: ExecutionState = {
        runId:        raw.run_id || raw.id || prev.runId,
        workflowId:   raw.workflow_id || prev.workflowId,
        workflowName: raw.workflow_name || raw.name || prev.workflowName,
        phase,
        startedAt,
        finishedAt,
        durationMs,
        elapsedMs:    startedAt ? Date.now() - startedAt : prev.elapsedMs,
        logs:         [logEntry, ...prev.logs].slice(0, MAX_LOGS),
        nodes,
        error:        raw.error || (phase === "failed" ? "Unknown error" : prev.error),
        triggerType:  raw.trigger_type || prev.triggerType,
        stepCount:    raw.step_count ?? prev.stepCount,
      };

      /* Manage ticker */
      if (phase === "running" || phase === "starting") {
        startTicker(startedAt ?? now);
      } else {
        stopTicker();
      }

      return next;
    });
  }, [workflowId, startTicker, stopTicker]);

  useEffect(() => {
    const unsub = subscribe("*", handleEvent);
    return unsub;
  }, [subscribe, handleEvent]);

  const reset = useCallback(() => {
    stopTicker();
    setState(EMPTY_STATE);
  }, [stopTicker]);

  return { execution: state, reset };
}

/* ── Formatted duration helper ──────────────────────────────────────── */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000)  return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
