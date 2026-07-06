/**
 * AutoFlowNG — Phase 14 Analytics API Client
 * Typed fetch wrapper + React hooks for all analytics endpoints.
 */

import { useState, useEffect, useCallback } from 'react';

const BASE = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '') + '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('autoflowng_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: { 
      'Content-Type': 'application/json', 
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options?.headers || {}) 
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403 || res.status === 402) {
      throw new Error('__auth_error__');
    }
    throw new Error(body.error || `API error ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExecutionSummary {
  total_executions: number;
  total_successes:  number;
  total_failures:   number;
  total_timeouts:   number;
  avg_duration_ms:  number;
  p95_ms:           number;
  p99_ms:           number;
  total_retries:    number;
  active_workflows: number;
  success_rate:     number;
}

export interface VolumeDataPoint {
  bucket:       string;
  total:        number;
  successes:    number;
  failures:     number;
  timeouts:     number;
  avg_duration_ms: number;
  p95_ms:       number;
  retries:      number;
}

export interface WorkflowRanking {
  workflow_id:        string;
  health_score:       number;
  reliability_score:  number;
  performance_score:  number;
  success_rate:       number;
  failure_rate:       number;
  retry_rate:         number;
  avg_duration_ms:    number;
  p95_duration_ms:    number;
  total_executions:   number;
  executions_7d:      number;
  last_executed_at:   string;
}

export interface BottleneckWorkflow extends WorkflowRanking {
  bottleneck_type: 'high_failure_rate' | 'high_latency' | 'high_retry_rate' | 'low_health' | 'degraded';
}

export interface IntegrationSummary {
  integration:     string;
  total_calls:     number;
  total_errors:    number;
  avg_latency_ms:  number;
  error_rate:      number;
  last_used_at:    string;
}

export interface ErrorCause {
  error_type:             string;
  distinct_errors:        number;
  total_occurrences:      number;
  last_seen:              string;
  affected_workflows:     number;
  affected_integrations:  number;
}

export interface HeatmapCell {
  day:   number;
  hour:  number;
  count: number;
}

export interface OperationalHealth {
  overall_health:           number;
  workflow_reliability:     number;
  integration_reliability:  number;
  queue_pressure:           number;
  anomaly_score:            number;
  risk_score:               number;
  computed_at:              string;
}

export interface ForecastResult {
  metric_type:      string;
  horizon_days:     number;
  forecast_date:    string;
  predicted_value:  number;
  lower_bound:      number;
  upper_bound:      number;
  confidence:       number;
  warning:          string | null;
}

export interface ReportSchedule {
  id:              number;
  report_type:     string;
  frequency:       'daily' | 'weekly' | 'monthly';
  format:          'pdf' | 'csv' | 'json';
  recipient_email: string;
  active:          boolean;
  last_run_at:     string | null;
  next_run_at:     string | null;
  created_at:      string;
}

export interface GeneratedReport {
  id:              number;
  report_type:     string;
  report_period:   string;
  format:          string;
  file_size_bytes: number;
  email_sent_to:   string | null;
  generated_at:    string;
}

// ── API functions ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  getExecutionSummary:   (days = 30) =>
    apiFetch<ExecutionSummary>(`/analytics/executions/summary?days=${days}`),

  getDashboardSummary: (range: string = '7d') =>
    apiFetch<{
      range: string;
      total_events: number;
      success_rate: number | null;
      avg_duration_ms: number | null;
      active_workflows: number;
      ai_requests: number;
      recent_runs: unknown[];
      volume: unknown;
    }>(`/analytics?range=${range}`),

  // FIX: `days` lets callers request an explicit lookback window (e.g. 7)
  // instead of being stuck with the 'daily' period's hardcoded 30-day
  // window on the backend — this is what was causing the Dashboard and
  // Analytics Center charts to span a full month (e.g. "Jun 3 – Jul 3")
  // and show a mostly-flat line for low-volume workspaces.
  getExecutionVolume:    (period = 'daily', workflowId?: string, days?: number) =>
    apiFetch<VolumeDataPoint[]>(
      `/analytics/executions/volume?period=${period}${workflowId ? `&workflowId=${workflowId}` : ''}${days ? `&days=${days}` : ''}`
    ),

  getInProgressVolume: (period = 'daily', days?: number) =>
    apiFetch<Array<{ bucket: string; in_progress: number }>>(
      `/analytics/executions/in-progress?period=${period}${days ? `&days=${days}` : ''}`
    ),

  getThroughput: () =>
    apiFetch<Array<{ hour: string; executions: number }>>(`/analytics/executions/throughput`),

  getTopWorkflows: (limit = 10) =>
    apiFetch<WorkflowRanking[]>(`/analytics/executions/top-workflows?limit=${limit}`),

  getExecutionTrend: (workflowId?: string) =>
    apiFetch<Record<string, number>>(`/analytics/executions/trend${workflowId ? `?workflowId=${workflowId}` : ''}`),

  getWorkflowRankings: (sortBy = 'health_score', limit = 20) =>
    apiFetch<WorkflowRanking[]>(`/analytics/workflows/rankings?sortBy=${sortBy}&limit=${limit}`),

  getBottlenecks: () =>
    apiFetch<BottleneckWorkflow[]>(`/analytics/workflows/bottlenecks`),

  getWorkflowRiskScores: () =>
    apiFetch<WorkflowRanking[]>(`/analytics/workflows/risk-scores`),

  getIntegrationSummary: (days = 30) =>
    apiFetch<IntegrationSummary[]>(`/analytics/integrations/summary?days=${days}`),

  getIntegrationTimeSeries: (integration?: string, period = 'daily') =>
    apiFetch<Array<{ time_bucket: string; integration: string; calls: number; errors: number; avg_latency_ms: number }>>(
      `/analytics/integrations/timeseries?period=${period}${integration ? `&integration=${integration}` : ''}`
    ),

  getOAuthHealthTrend: () =>
    apiFetch<Array<{ day: string; avg_health_score: number; critical_count: number; healthy_count: number }>>(
      `/analytics/integrations/oauth-health-trend`
    ),

  getIntegrationRanking: () =>
    apiFetch<{ mostUsed: IntegrationSummary[]; leastUsed: IntegrationSummary[] }>(`/analytics/integrations/ranking`),

  getIntegrationReliability: () =>
    apiFetch<Array<{ integration: string; reliability_score: number; error_rate: number; avg_latency_ms: number }>>(
      `/analytics/integrations/reliability`
    ),

  getTopErrorCauses: (days = 30) =>
    apiFetch<ErrorCause[]>(`/analytics/errors/top-causes?days=${days}`),

  getErrorHeatmap: (workflowId?: string) =>
    apiFetch<HeatmapCell[]>(`/analytics/errors/heatmap${workflowId ? `?workflowId=${workflowId}` : ''}`),

  getErrorIntelligence: () =>
    apiFetch<{ topCauses: ErrorCause[]; integrationErrors: unknown[]; errorSpike: Record<string, unknown> }>(
      `/analytics/errors/intelligence`
    ),

  getRetryTrend: (days = 30) =>
    apiFetch<Array<{ day: string; total_retries: number; retry_rate: number }>>(`/analytics/errors/retry-trend?days=${days}`),

  getHealthScores: () =>
    apiFetch<OperationalHealth>(`/analytics/intelligence/health`),

  getHealthTrend: (days = 30) =>
    apiFetch<Array<{ day: string; overall_health: number; risk_score: number }>>(`/analytics/intelligence/health-trend?days=${days}`),

  getForecasts: () =>
    apiFetch<ForecastResult[]>(`/analytics/forecasts`),

  computeForecasts: () =>
    apiFetch<unknown>(`/analytics/forecasts/compute`, { method: 'POST' }),

  computeIntelligence: () =>
    apiFetch<OperationalHealth>(`/analytics/intelligence/compute`, { method: 'POST' }),

  // Reports
  generateReport: async (reportType: string, format: string) => {
    const token = localStorage.getItem('autoflowng_token');
    const res = await fetch(`${BASE}/reports/generate`, {
      method:      'POST',
      headers:     { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body:        JSON.stringify({ reportType, format }),
    });
    if (!res.ok) throw new Error(`Report generation failed: ${res.status}`);
    const blob = await res.blob();
    const cd   = res.headers.get('Content-Disposition') || '';
    const fn   = cd.match(/filename="([^"]+)"/)?.[1] || `report.${format}`;
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = fn; a.click();
    URL.revokeObjectURL(url);
  },

  getReportHistory: () =>
    apiFetch<GeneratedReport[]>(`/reports/history`),

  getSchedules: () =>
    apiFetch<ReportSchedule[]>(`/reports/schedules`),

  createSchedule: (data: Omit<ReportSchedule, 'id' | 'created_at' | 'last_run_at' | 'next_run_at'>) =>
    apiFetch<ReportSchedule>(`/reports/schedules`, { method: 'POST', body: JSON.stringify(data) }),

  updateSchedule: (id: number, data: Partial<ReportSchedule>) =>
    apiFetch<ReportSchedule>(`/reports/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteSchedule: (id: number) =>
    apiFetch<void>(`/reports/schedules/${id}`, { method: 'DELETE' }),
};

// ── React Hooks ───────────────────────────────────────────────────────────────

function useAnalyticsQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg !== '__auth_error__') {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch_(); }, [fetch_]);

  // Poll every 30 s so the Analytics page reflects new completed jobs
  // without needing a manual refresh — matches the always-on workflow model.
  useEffect(() => {
    const id = setInterval(() => fetch_(), 30_000);
    return () => clearInterval(id);
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

export const useExecutionSummary   = (days = 30) =>
  useAnalyticsQuery(() => analyticsApi.getExecutionSummary(days), [days]);

export const useExecutionVolume    = (period = 'daily', days?: number) =>
  useAnalyticsQuery(() => analyticsApi.getExecutionVolume(period, undefined, days), [period, days]);

export const useThroughput         = () =>
  useAnalyticsQuery(() => analyticsApi.getThroughput());

export const useWorkflowRankings   = (sortBy = 'health_score') =>
  useAnalyticsQuery(() => analyticsApi.getWorkflowRankings(sortBy), [sortBy]);

export const useBottlenecks        = () =>
  useAnalyticsQuery(() => analyticsApi.getBottlenecks());

export const useIntegrationSummary = (days = 30) =>
  useAnalyticsQuery(() => analyticsApi.getIntegrationSummary(days), [days]);

export const useErrorHeatmap       = () =>
  useAnalyticsQuery(() => analyticsApi.getErrorHeatmap());

export const useTopErrorCauses     = (days = 30) =>
  useAnalyticsQuery(() => analyticsApi.getTopErrorCauses(days), [days]);

export const useHealthScores       = () =>
  useAnalyticsQuery(() => analyticsApi.getHealthScores());

export const useHealthTrend        = (days = 30) =>
  useAnalyticsQuery(() => analyticsApi.getHealthTrend(days), [days]);

export const useForecasts          = () =>
  useAnalyticsQuery(() => analyticsApi.getForecasts());

export const useReportHistory      = () =>
  useAnalyticsQuery(() => analyticsApi.getReportHistory());

export const useReportSchedules    = () =>
  useAnalyticsQuery(() => analyticsApi.getSchedules());

// ── Post Analytics (Content Tab) ──────────────────────────────────────────────

export interface PostAnalyticsSeries {
  platform:    string;
  views:       number;
  likes:       number;
  comments:    number;
  shares:      number;
  impressions: number;
  reach:       number;
  fetched_at:  string;
  // YouTube Analytics API watch-time fields — null for non-YouTube platforms
  // or YouTube posts without the yt-analytics.readonly scope granted.
  watch_time_minutes?:        number | null;
  avg_view_duration_seconds?: number | null;
  avg_view_percentage?:       number | null;
}

export interface PostAnalyticsData {
  job: {
    id:               number;
    title:            string;
    status:           string;
    target_platforms: string[];
    completed_at:     string | null;
    created_at:       string;
  };
  series:  PostAnalyticsSeries[];
  totals:  Record<string, number>;
}

/**
 * usePostAnalytics(jobId)
 * Fetches time-series engagement data for a single publishing job.
 * Powers the Analytics Center "Content" tab per-post trend chart.
 * Calls GET /api/publishing/jobs/:id/analytics
 */
export function usePostAnalytics(jobId: number | null) {
  const [data,    setData]    = useState<PostAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!jobId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<PostAnalyticsData>(`/publishing/jobs/${jobId}/analytics`));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg !== '__auth_error__') setError(msg);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { data, loading, error, refetch: fetch_ };
}
