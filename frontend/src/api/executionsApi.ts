/**
 * AutoFlowNG — Execution Detail API Client
 *
 * Fetches full historical execution data (logs, steps, duration, trigger)
 * for a completed run. Used by ExecutionDetailDrawer when a user opens a
 * PAST run (e.g. from Dashboard's Recent Workflow Runs table), where no
 * live websocket stream will ever populate execution state.
 */
const BASE = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '') + '/api';

export interface HistoricalRun {
  id: number | string;
  workflow_id: number | string;
  workflow_name: string;
  status: string;
  steps_completed: number | null;
  steps_total: number | null;
  logs: any[];
  error: string | null;
  trigger_type: string | null;
  trigger_data: Record<string, any>;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  ai_summary?: string | null;
}

/**
 * Fetch full detail for a single run by ID.
 * Returns null on 404 or any error so callers can fall back gracefully
 * rather than throwing and breaking the drawer.
 */
export async function fetchExecutionDetail(runId: string | number): Promise<HistoricalRun | null> {
  const token = localStorage.getItem('autoflowng_token');
  try {
    const res = await fetch(`${BASE}/executions/${runId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.run ?? null;
  } catch {
    return null;
  }
}
