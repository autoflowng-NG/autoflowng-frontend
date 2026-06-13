/**
 * AutoFlowNG — Integration Health API Client
 * Phase 13.5: Typed fetch helpers for all health endpoints.
 *
 * Usage:
 *   import { useIntegrationHealth } from '@/api/integrationsHealthApi';
 *   const { health, loading, refresh } = useIntegrationHealth();
 */

import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TriggerStat {
  workflow_id:       string;
  trigger_id:        string;
  workflow_name:     string;
  is_active:         boolean;
  total_polls:       number;
  success_count:     number;
  failure_count:     number;
  success_rate:      number;
  last_executed_at:  string | null;
  last_status:       string;
  last_error:        string | null;
  healthScore:       number;
}

export interface OAuthCredential {
  id:               string;
  platform:         string;
  type:             string;
  expiresAt:        string | null;
  lastRotated:      string | null;
  rotationCount:    number;
  healthScore:      number;
  healthStatus:     string;
  scannedAt:        string | null;
  timeToExpiryMs:   number | null;
}

export interface HealthSummary {
  overallScore:    number;
  overallStatus:   string;
  triggers: {
    totalTriggers:   number;
    healthy:         number;
    warning:         number;
    critical:        number;
    deadLetterCount: number;
  };
  oauth: {
    total:    number;
    healthy:  number;
    warning:  number;
    critical: number;
    avgScore: number;
  };
  expiring:    ExpiringConnection[];
  generatedAt: string;
}

export interface ExpiringConnection {
  id:              string;
  platform:        string;
  token_expires_at: string;
  updated_at:      string;
}

export interface DeadLetter {
  id:            string;
  workflow_id:   string;
  trigger_id:    string;
  workflow_name: string;
  error_message: string;
  attempts:      number;
  created_at:    string;
  replayed_at:   string | null;
}

export interface TriggerDetail {
  workflow: {
    id:          string;
    name:        string;
    triggerType: string;
    isActive:    boolean;
  };
  stats: TriggerStat | null;
  history: Array<{
    id:              number;
    status:          string;
    error_message:   string | null;
    fired_count:     number;
    poll_latency_ms: number | null;
    executed_at:     string;
  }>;
  state: {
    lastEventAt:   string | null;
    lastEventId:   string | null;
    updatedAt:     string | null;
    offset:        number | null;
    lastId:        string | null;
    lastTimestamp: number | null;
  };
  dedupCount: number;
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

const API_BASE = '/api';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json();
}

// ── API functions ──────────────────────────────────────────────────────────────

export async function fetchIntegrationHealth(): Promise<HealthSummary> {
  return apiFetch<HealthSummary>('/integrations/health');
}

export async function fetchTriggerHealthStats(): Promise<{ ok: boolean; triggers: TriggerStat[] }> {
  return apiFetch('/integrations/triggers');
}

export async function fetchTriggerDetail(workflowId: string, triggerId?: string): Promise<{ ok: boolean } & TriggerDetail> {
  const qs = triggerId ? `?triggerId=${encodeURIComponent(triggerId)}` : '';
  return apiFetch(`/integrations/triggers/${workflowId}${qs}`);
}

export async function fetchOAuthHealth(): Promise<{ ok: boolean; credentials: OAuthCredential[]; summary: { total: number; healthy: number; warning: number; critical: number; avgScore: number } }> {
  return apiFetch('/integrations/oauth/health');
}

export async function fetchDeadLetters(): Promise<{ ok: boolean; deadLetters: DeadLetter[] }> {
  return apiFetch('/integrations/deadletters');
}

export async function replayDeadLetter(id: string): Promise<{ ok: boolean; error?: string }> {
  return apiFetch(`/integrations/deadletters/${id}/replay`, { method: 'POST' });
}

export async function resetTriggerState(workflowId: string, triggerId: string): Promise<{ ok: boolean; message?: string }> {
  return apiFetch(`/integrations/triggers/${workflowId}/reset`, {
    method: 'POST',
    body:   JSON.stringify({ triggerId }),
  });
}

export async function fetchTriggerState(workflowId: string): Promise<{ ok: boolean; states: unknown[] }> {
  return apiFetch(`/integrations/triggers/${workflowId}/state`);
}

// ── React hooks ────────────────────────────────────────────────────────────────

/**
 * useIntegrationHealth — fetches the overall health summary.
 * Auto-refreshes every 5 minutes.
 */
export function useIntegrationHealth(autoRefreshMs = 5 * 60_000) {
  const [health, setHealth]   = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchIntegrationHealth();
      setHealth(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (autoRefreshMs > 0) {
      const id = setInterval(refresh, autoRefreshMs);
      return () => clearInterval(id);
    }
  }, [refresh, autoRefreshMs]);

  return { health, loading, error, refresh };
}

/**
 * useTriggerHealth — fetches trigger health stats.
 */
export function useTriggerHealth() {
  const [triggers, setTriggers] = useState<TriggerStat[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTriggerHealthStats();
      setTriggers(data.triggers || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { triggers, loading, error, refresh };
}

/**
 * useOAuthHealth — fetches OAuth credential health.
 */
export function useOAuthHealth() {
  const [credentials, setCredentials] = useState<OAuthCredential[]>([]);
  const [summary, setSummary]         = useState<{ total: number; healthy: number; warning: number; critical: number; avgScore: number } | null>(null);
  const [loading, setLoading]         = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOAuthHealth();
      setCredentials(data.credentials || []);
      setSummary(data.summary || null);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { credentials, summary, loading, refresh };
}

/**
 * useDeadLetters — fetches the DLQ with replay capability.
 */
export function useDeadLetters() {
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [loading, setLoading]         = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDeadLetters();
      setDeadLetters(data.deadLetters || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  const replay = useCallback(async (id: string) => {
    setReplayingId(id);
    try {
      await replayDeadLetter(id);
      await refresh();
    } finally {
      setReplayingId(null);
    }
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { deadLetters, loading, replayingId, refresh, replay };
}
