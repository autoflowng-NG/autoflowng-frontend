/**
 * ExecutionHistoryContext — Phase 4
 *
 * Persistent execution intelligence layer. Accumulates real runtime events
 * from WebSocketContext into per-workflow history, computes reliability
 * metrics, detects anomalies, and serves as the single source of truth
 * for all orchestration intelligence features.
 *
 * Architecture:
 * - Subscribes to shared WebSocketContext (no new WS connection)
 * - Stores last MAX_HISTORY_PER_WF runs per workflow in memory
 * - Derives health scores, trend indicators, and anomaly flags live
 * - sessionStorage persistence for reconnect continuity
 * - Designed for future backend replay hydration
 */

import {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef, type ReactNode,
} from "react";
import { useWebSocketContext } from "./WebSocketContext";

/* ── Constants ──────────────────────────────────────────────────────── */
const MAX_HISTORY_PER_WF   = 50;
const STORAGE_KEY          = "af_exec_history_v1";
const SPIKE_THRESHOLD_MULT = 1.8;   // duration > 1.8× p50 = spike
const FAILURE_WINDOW       = 5;     // look at last N runs for failure rate
const DEGRADATION_WINDOW   = 8;     // runs to check for duration trend
const MIN_RUNS_FOR_SCORING = 3;     // need at least N runs for reliable health score
const HEALTH_SCORE_VERSION = 1;

/* ── Types ──────────────────────────────────────────────────────────── */
export type RunOutcome = "success" | "failed" | "cancelled" | "unknown";

export interface HistoricalRun {
  runId:       string;
  workflowId:  string;
  workflowName: string;
  outcome:     RunOutcome;
  startedAt:   number;
  finishedAt:  number | null;
  durationMs:  number | null;
  triggerType: string | null;
  stepCount:   number | null;
  error:       string | null;
  nodeCount:   number;
}

export type HealthTier = "healthy" | "warning" | "degraded" | "critical" | "unknown";

export interface AnomalyFlag {
  type:    "duration_spike" | "repeated_failure" | "increasing_duration" | "high_failure_rate" | "no_recent_success";
  message: string;
  severity: "low" | "medium" | "high";
  detectedAt: number;
}

export interface WorkflowHealth {
  workflowId:      string;
  workflowName:    string;
  score:           number;          // 0–100
  tier:            HealthTier;
  totalRuns:       number;
  successRate:     number;          // 0–1
  recentFailureRate: number;        // 0–1 over last FAILURE_WINDOW runs
  p50DurationMs:   number | null;
  lastRunAt:       number | null;
  lastOutcome:     RunOutcome;
  anomalies:       AnomalyFlag[];
  durationTrend:   "increasing" | "stable" | "improving" | "insufficient_data";
  computedAt:      number;
}

export interface ExecutionHistoryState {
  /** Per-workflow run history, keyed by workflowId */
  history:   Record<string, HistoricalRun[]>;
  /** Derived health per workflow */
  health:    Record<string, WorkflowHealth>;
  /** Global anomalies across all workflows */
  anomalies: AnomalyFlag[];
  /** Total runs ingested this session */
  totalIngested: number;
  /** Timestamp of last ingestion */
  lastUpdated: number | null;
}

export interface ExecutionHistoryContextValue extends ExecutionHistoryState {
  getWorkflowHealth:  (workflowId: string) => WorkflowHealth | null;
  getWorkflowHistory: (workflowId: string) => HistoricalRun[];
  getGlobalAnomalies: () => AnomalyFlag[];
  getUnhealthyWorkflows: () => WorkflowHealth[];
  clearHistory:       () => void;
  /** Hydrate from backend replay — call when backend provides historical runs */
  hydrateFromBackend: (runs: HistoricalRun[]) => void;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function toOutcome(raw: any): RunOutcome {
  const ev     = (raw.event || raw.type || "").toLowerCase();
  const status = (raw.status || raw.result || "").toLowerCase();
  if (ev.includes("cancel")) return "cancelled";
  if (status === "success" || status === "completed" || status === "complete") return "success";
  if (status.includes("fail") || status.includes("error") || raw.error) return "failed";
  if (ev.includes("end") || ev.includes("complete") || ev.includes("finish")) {
    return raw.error ? "failed" : "success";
  }
  return "unknown";
}

function isTerminalEvent(raw: any): boolean {
  const ev     = (raw.event || raw.type || "").toLowerCase();
  const status = (raw.status || raw.result || "").toLowerCase();
  const terminalEv     = ev.includes("end") || ev.includes("complete") || ev.includes("finish") || ev.includes("cancel");
  const terminalStatus = status === "success" || status === "completed" || status.includes("fail") || status.includes("error");
  return terminalEv || terminalStatus;
}

function p50(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function computeDurationTrend(runs: HistoricalRun[]): WorkflowHealth["durationTrend"] {
  const withDuration = runs.slice(0, DEGRADATION_WINDOW)
    .filter(r => r.durationMs !== null && r.outcome !== "cancelled")
    .map(r => r.durationMs as number);

  if (withDuration.length < 4) return "insufficient_data";

  // Simple linear regression slope
  const n    = withDuration.length;
  const xMean = (n - 1) / 2;
  const yMean = withDuration.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  withDuration.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  if (den === 0) return "stable";
  const slope = num / den;
  const relativeSlope = yMean > 0 ? slope / yMean : 0;

  if (relativeSlope >  0.08) return "increasing";
  if (relativeSlope < -0.08) return "improving";
  return "stable";
}

function detectAnomalies(runs: HistoricalRun[], p50ms: number | null): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  const now = Date.now();
  if (runs.length < MIN_RUNS_FOR_SCORING) return flags;

  const recent = runs.slice(0, FAILURE_WINDOW);
  const recentFails = recent.filter(r => r.outcome === "failed").length;
  const recentFailRate = recentFails / recent.length;

  // High recent failure rate
  if (recentFailRate >= 0.6 && recent.length >= 3) {
    flags.push({
      type: "high_failure_rate",
      message: `${Math.round(recentFailRate * 100)}% failure rate in last ${recent.length} runs`,
      severity: recentFailRate >= 0.8 ? "high" : "medium",
      detectedAt: now,
    });
  }

  // Repeated failures (last 2+ runs failed)
  if (runs.length >= 2 && runs[0].outcome === "failed" && runs[1].outcome === "failed") {
    flags.push({
      type: "repeated_failure",
      message: "Consecutive execution failures detected",
      severity: runs[2]?.outcome === "failed" ? "high" : "medium",
      detectedAt: now,
    });
  }

  // Duration spike in latest run
  if (p50ms !== null && runs[0]?.durationMs !== null) {
    const latest = runs[0].durationMs as number;
    if (latest > p50ms * SPIKE_THRESHOLD_MULT && p50ms > 100) {
      flags.push({
        type: "duration_spike",
        message: `Latest run took ${(latest / p50ms).toFixed(1)}× median duration`,
        severity: latest > p50ms * 3 ? "high" : "medium",
        detectedAt: now,
      });
    }
  }

  // Increasing duration trend
  const trend = computeDurationTrend(runs);
  if (trend === "increasing") {
    flags.push({
      type: "increasing_duration",
      message: "Execution duration trending upward",
      severity: "low",
      detectedAt: now,
    });
  }

  // No recent success (last 5 runs all non-success)
  if (recent.length >= 3 && !recent.some(r => r.outcome === "success")) {
    flags.push({
      type: "no_recent_success",
      message: `No successful runs in last ${recent.length} executions`,
      severity: "high",
      detectedAt: now,
    });
  }

  return flags;
}

function computeHealth(workflowId: string, workflowName: string, runs: HistoricalRun[]): WorkflowHealth {
  const now = Date.now();
  if (runs.length === 0) {
    return {
      workflowId, workflowName, score: 100, tier: "unknown",
      totalRuns: 0, successRate: 1, recentFailureRate: 0,
      p50DurationMs: null, lastRunAt: null, lastOutcome: "unknown",
      anomalies: [], durationTrend: "insufficient_data", computedAt: now,
    };
  }

  const totalRuns = runs.length;
  const successes = runs.filter(r => r.outcome === "success").length;
  const successRate = successes / totalRuns;

  const recent = runs.slice(0, FAILURE_WINDOW);
  const recentFails = recent.filter(r => r.outcome === "failed").length;
  const recentFailRate = recentFails / recent.length;

  const durations = runs
    .filter(r => r.durationMs !== null && r.outcome !== "cancelled")
    .map(r => r.durationMs as number);
  const p50ms = p50(durations);

  const durationTrend = computeDurationTrend(runs);
  const anomalies = detectAnomalies(runs, p50ms);

  // Health score: start at 100, subtract for issues
  let score = 100;
  if (totalRuns >= MIN_RUNS_FOR_SCORING) {
    score -= recentFailRate * 50;                          // up to -50 for recent failures
    score -= (1 - successRate) * 20;                      // up to -20 for overall fail rate
    if (durationTrend === "increasing")    score -= 10;
    anomalies.forEach(a => {
      if (a.severity === "high")   score -= 12;
      if (a.severity === "medium") score -= 6;
      if (a.severity === "low")    score -= 3;
    });
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const tier: HealthTier =
    totalRuns < MIN_RUNS_FOR_SCORING ? "unknown" :
    score >= 85 ? "healthy" :
    score >= 65 ? "warning" :
    score >= 40 ? "degraded" : "critical";

  return {
    workflowId, workflowName, score, tier, totalRuns,
    successRate, recentFailureRate: recentFailRate,
    p50DurationMs: p50ms,
    lastRunAt:     runs[0].finishedAt ?? runs[0].startedAt,
    lastOutcome:   runs[0].outcome,
    anomalies, durationTrend, computedAt: now,
  };
}

/* ── Session storage helpers ─────────────────────────────────────────── */
function loadFromStorage(): Record<string, HistoricalRun[]> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object") return {};
    return parsed;
  } catch { return {}; }
}

function saveToStorage(history: Record<string, HistoricalRun[]>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch { /* quota exceeded or SSR */ }
}

/* ── Context ─────────────────────────────────────────────────────────── */
const ExecutionHistoryContext = createContext<ExecutionHistoryContextValue | null>(null);

/* ── Provider ────────────────────────────────────────────────────────── */
export function ExecutionHistoryProvider({ children }: { children: ReactNode }) {
  const { subscribe } = useWebSocketContext();

  const [state, setState] = useState<ExecutionHistoryState>(() => {
    const history = loadFromStorage();
    const health: Record<string, WorkflowHealth> = {};
    Object.entries(history).forEach(([wfId, runs]) => {
      if (runs.length > 0) {
        health[wfId] = computeHealth(wfId, runs[0].workflowName, runs);
      }
    });
    return { history, health, anomalies: [], totalIngested: 0, lastUpdated: null };
  });

  // Persist to sessionStorage on change (debounced via ref)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToStorage(state.history), 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state.history]);

  const ingestRun = useCallback((raw: any) => {
    if (!isTerminalEvent(raw)) return;
    const ev = (raw.event || raw.type || "").toLowerCase();
    const skip = ["ping", "pong", "authenticated", "auth", "connected"];
    if (skip.includes(ev)) return;

    const wfId   = raw.workflow_id;
    const wfName = raw.workflow_name || raw.name || "Unknown Workflow";
    if (!wfId) return;

    const outcome  = toOutcome(raw);
    const now      = Date.now();
    const startTs  = raw.started_at || (raw.ts ? raw.ts - (raw.duration || 0) : now);
    const finishTs = raw.finished_at || raw.ts || now;

    const run: HistoricalRun = {
      runId:        raw.run_id || raw.id || `${now}-${Math.random().toString(36).slice(2)}`,
      workflowId:   wfId,
      workflowName: wfName,
      outcome,
      startedAt:    startTs,
      finishedAt:   finishTs,
      durationMs:   raw.duration ?? (finishTs - startTs),
      triggerType:  raw.trigger_type || null,
      stepCount:    raw.step_count ?? null,
      error:        raw.error || null,
      nodeCount:    raw.node_count || 0,
    };

    setState(prev => {
      const existing = prev.history[wfId] || [];
      // Dedup by runId
      if (existing.some(r => r.runId === run.runId)) return prev;

      const updated = [run, ...existing].slice(0, MAX_HISTORY_PER_WF);
      const newHistory = { ...prev.history, [wfId]: updated };
      const newHealth  = computeHealth(wfId, wfName, updated);

      // Collect all anomalies across workflows
      const allAnomalies = (Object.values({ ...prev.health, [wfId]: newHealth }) as WorkflowHealth[])
        .flatMap((h) => h.anomalies)
        .sort((a, b) => b.detectedAt - a.detectedAt)
        .slice(0, 20);

      return {
        history:       newHistory,
        health:        { ...prev.health, [wfId]: newHealth },
        anomalies:     allAnomalies,
        totalIngested: prev.totalIngested + 1,
        lastUpdated:   now,
      };
    });
  }, []);

  useEffect(() => {
    const unsub = subscribe("*", ingestRun);
    return unsub;
  }, [subscribe, ingestRun]);

  /* ── Public API ── */
  const getWorkflowHealth = useCallback(
    (wfId: string) => state.health[wfId] ?? null, [state.health]
  );

  const getWorkflowHistory = useCallback(
    (wfId: string) => state.history[wfId] ?? [], [state.history]
  );

  const getGlobalAnomalies = useCallback(() => state.anomalies, [state.anomalies]);

  const getUnhealthyWorkflows = useCallback(() =>
    Object.values(state.health)
      .filter(h => h.tier === "critical" || h.tier === "degraded" || h.tier === "warning")
      .sort((a, b) => a.score - b.score),
    [state.health]
  );

  const clearHistory = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState({ history: {}, health: {}, anomalies: [], totalIngested: 0, lastUpdated: null });
  }, []);

  const hydrateFromBackend = useCallback((runs: HistoricalRun[]) => {
    setState(prev => {
      const newHistory = { ...prev.history };
      runs.forEach(run => {
        const existing = newHistory[run.workflowId] || [];
        if (!existing.some(r => r.runId === run.runId)) {
          newHistory[run.workflowId] = [run, ...existing]
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, MAX_HISTORY_PER_WF);
        }
      });
      const newHealth: Record<string, WorkflowHealth> = { ...prev.health };
      Object.entries(newHistory).forEach(([wfId, wfRuns]) => {
        newHealth[wfId] = computeHealth(wfId, wfRuns[0]?.workflowName ?? wfId, wfRuns);
      });
      return { ...prev, history: newHistory, health: newHealth };
    });
  }, []);

  const value = useMemo<ExecutionHistoryContextValue>(() => ({
    ...state,
    getWorkflowHealth,
    getWorkflowHistory,
    getGlobalAnomalies,
    getUnhealthyWorkflows,
    clearHistory,
    hydrateFromBackend,
  }), [state, getWorkflowHealth, getWorkflowHistory, getGlobalAnomalies, getUnhealthyWorkflows, clearHistory, hydrateFromBackend]);

  return (
    <ExecutionHistoryContext.Provider value={value}>
      {children}
    </ExecutionHistoryContext.Provider>
  );
}

/* ── Consumer hooks ──────────────────────────────────────────────────── */
export function useExecutionHistory(): ExecutionHistoryContextValue {
  const ctx = useContext(ExecutionHistoryContext);
  if (!ctx) throw new Error("useExecutionHistory must be used within ExecutionHistoryProvider");
  return ctx;
}

export function useWorkflowHealth(workflowId: string): WorkflowHealth | null {
  const { getWorkflowHealth } = useExecutionHistory();
  return getWorkflowHealth(workflowId);
}

export function useOrchestrationIntelligence() {
  const { health, anomalies, getUnhealthyWorkflows, totalIngested } = useExecutionHistory();
  return {
    unhealthyWorkflows: getUnhealthyWorkflows(),
    globalAnomalies:    anomalies,
    healthMap:          health,
    totalTracked:       Object.keys(health).length,
    totalIngested,
    hasIntelligence:    totalIngested > 0,
  };
}

/* ── Health tier display helpers ─────────────────────────────────────── */
export const HEALTH_TIER_COLOR: Record<HealthTier, string> = {
  healthy:  "#00C896",
  warning:  "#FBBF24",
  degraded: "#FB923C",
  critical: "#FB7185",
  unknown:  "#94A3B8",
};

export const HEALTH_TIER_LABEL: Record<HealthTier, string> = {
  healthy:  "Healthy",
  warning:  "Warning",
  degraded: "Degraded",
  critical: "Critical",
  unknown:  "No data",
};
