/**
 * useBackendHydration — Phase 5
 *
 * Hydrates ExecutionHistoryContext from backend on mount so intelligence
 * is available immediately (not just after live runs arrive via WS).
 *
 * Flow:
 *  1. On authenticated mount, fetch all user workflows
 *  2. For each workflow, fetch last 50 runs from GET /api/workflows/:id/runs
 *  3. Also fetch persisted metrics from GET /api/workflows/:id/metrics
 *  4. Inject into ExecutionHistoryContext.hydrateFromBackend()
 *  5. Merge backend metrics into health state
 *
 * Also handles replay gap recovery:
 *  - On WS reconnect, calls GET /api/events/replay?since=gapFrom&until=gapTo
 *  - Passes results to useReplayBuffer.hydrateFromReplay()
 */
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient }    from "@tanstack/react-query";
import { useAuth }           from "../contexts/AuthContext";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { useExecutionHistory }  from "../contexts/ExecutionHistoryContext";
import { useReplayBuffer }      from "./useReplayBuffer";

const API_BASE = (import.meta.env?.VITE_API_URL || "https://autoflowng-backend-production.up.railway.app")
  .replace(/\/$/, "");

async function apiFetch(path: string, token: string) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export function useBackendHydration() {
  const { isAuthenticated, token } = useAuth();
  const { status }          = useWebSocketContext();
  const { hydrateFromBackend } = useExecutionHistory();
  const { gaps, hydrateFromReplay } = useReplayBuffer();

  const hydrated   = useRef(false);
  const prevStatus = useRef(status);

  const runHydration = useCallback(async () => {
    if (!isAuthenticated) return;
    const tok = token();
    if (!tok) return;

    try {
      // Phase 6: Single-endpoint bulk hydration — replaces N+1 per-workflow fetch pattern
      const data = await apiFetch("/dashboard/health/runs", tok);
      const rawRuns = data.runs || [];

      if (!rawRuns.length) return;

      const allRuns = rawRuns.map((r: any) => ({
        runId:        String(r.id),
        workflowId:   String(r.workflow_id),
        workflowName: r.workflow_name || "Unknown",
        outcome:      r.status === "completed" ? "success"
                    : r.status === "failed"    ? "failed"
                    : r.status === "cancelled" ? "cancelled" : "unknown",
        startedAt:    r.started_ts  ?? Date.now(),
        finishedAt:   r.completed_ts ?? null,
        durationMs:   r.duration_ms ?? null,
        triggerType:  r.trigger_type ?? null,
        stepCount:    r.steps_completed ?? null,
        error:        r.error ?? null,
        nodeCount:    r.node_count ?? 0,
      }));

      hydrateFromBackend(allRuns);
    } catch (e) {
      console.warn("[BackendHydration]", e);
    }
  }, [isAuthenticated, token, hydrateFromBackend]);

  /* Initial hydration on mount */
  useEffect(() => {
    if (!isAuthenticated || hydrated.current) return;
    hydrated.current = true;
    runHydration();
  }, [isAuthenticated, runHydration]);

  /* Gap recovery on WS reconnect */
  useEffect(() => {
    const wasDisconnected = prevStatus.current !== "authenticated";
    const isNowConnected  = status === "authenticated";
    prevStatus.current    = status;

    if (!wasDisconnected || !isNowConnected || !isAuthenticated) return;

    const tok = token();
    if (!tok) return;

    // Find unrecovered gaps
    const unrecovered = gaps.filter(g => !g.recovered && g.to !== null);
    if (unrecovered.length === 0) return;

    unrecovered.forEach(async (gap, idx) => {
      try {
        const since = gap.from;
        const until = gap.to ?? Date.now();
        const data  = await apiFetch(`/events/replay?since=${since}&until=${until}`, tok);
        if (data.events?.length > 0) {
          await hydrateFromReplay(data.events, idx);
        }
      } catch (e) {
        console.warn("[GapRecovery]", e);
      }
    });
  }, [status, isAuthenticated, token, gaps, hydrateFromReplay]);
}
