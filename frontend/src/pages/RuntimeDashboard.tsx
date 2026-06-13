/**
 * AutoFlowNG — Enterprise Runtime Intelligence Dashboard (Phase 8)
 *
 * Real-time visibility across:
 *   - Execution pipeline (live throughput, p95/p99 latency, error rate)
 *   - Queue health (tier depth, DLQ counts, backpressure indicators)
 *   - WebSocket connections (online users, auth failures, heartbeat misses)
 *   - AI provider fleet (call counts, latency, fallback activity)
 *   - Database & Redis health
 *   - Org-level queue fairness
 *
 * Data sources: /api/system/health, /api/metrics (Prometheus text → parsed),
 * /api/queue-tiers, /api/admin/dlq/health, /api/orgs/admin/queue/org-health
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ObservabilityIntelligencePanel from '../components/ObservabilityIntelligencePanel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthCheck {
  ok: boolean;
  [key: string]: unknown;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  version: string;
  checks: {
    db?:          HealthCheck;
    redis?:       HealthCheck;
    websocket?:   HealthCheck;
    tierQueues?:  HealthCheck;
    stuckRuns?:   HealthCheck;
    [k: string]:  HealthCheck | undefined;
  };
  ts: string;
}

interface TierStats {
  waiting:  number;
  active:   number;
  failed:   number;
  dlq:      number;
  pressure: number;
}

interface DLQHealth {
  status:  'healthy' | 'warning' | 'critical' | 'degraded';
  tierQueues: boolean;
  tiers:   Record<string, { status: string; dlqDepth: number; waiting: number; active: number }>;
  ts:      string;
}

interface OrgQueueHealth {
  success: boolean;
  summary?: { totalOrgs: number; throttledOrgs: number; totalEnqueued: number };
  orgs?:   Array<{ orgId: string; name: string; metrics: Record<string, number> }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_MS    = 10_000;
const TIER_COLORS: Record<string, string> = {
  'af-critical': 'text-red-400',
  'af-standard': 'text-amber-400',
  'af-bulk':     'text-blue-400',
  'af-scheduled':'text-purple-400',
};
const STATUS_DOT: Record<string, string> = {
  healthy:  'bg-green-500',
  warning:  'bg-yellow-500',
  critical: 'bg-red-500',
  degraded: 'bg-orange-500',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_DOT[status] ?? 'bg-gray-500';
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} mr-2 shrink-0`} />
  );
}

function MetricCard({
  label, value, unit = '', sub, accent = false,
}: { label: string; value: string | number; unit?: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${accent ? 'border-amber-500/40 bg-amber-950/20' : 'border-white/10 bg-white/5'}`}>
      <span className="text-xs text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}<span className="text-sm text-gray-400 ml-1">{unit}</span>
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3 mt-6 first:mt-0">
      {children}
    </h2>
  );
}

function CheckRow({ label, check }: { label: string; check?: HealthCheck }) {
  const ok = check?.ok !== false;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="flex items-center text-sm text-gray-300">
        <StatusBadge status={ok ? 'healthy' : 'critical'} />
        {label}
      </span>
      <span className={`text-xs font-mono ${ok ? 'text-green-400' : 'text-red-400'}`}>
        {ok ? 'OK' : 'FAIL'}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RuntimeDashboard() {
  const { user } = useAuth();
  const [health,     setHealth]     = useState<SystemHealth | null>(null);
  const [dlq,        setDlq]        = useState<DLQHealth | null>(null);
  const [orgQueue,   setOrgQueue]   = useState<OrgQueueHealth | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const headers = useCallback(() => {
    const token = localStorage.getItem('autoflowng_token') || sessionStorage.getItem('autoflowng_token') || '';
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [healthRes, dlqRes, orgRes] = await Promise.allSettled([
        fetch('/api/health/deep', { headers: headers() }).then(r => r.json()),
        fetch('/api/admin/dlq/health', { headers: headers() }).then(r => r.json()),
        fetch('/api/orgs/admin/queue/org-health', { headers: headers() }).then(r => r.json()),
      ]);

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value as SystemHealth);
      if (dlqRes.status   === 'fulfilled') setDlq(dlqRes.value as DLQHealth);
      if (orgRes.status   === 'fulfilled') setOrgQueue(orgRes.value as OrgQueueHealth);

      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError('Failed to fetch runtime data');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll]);

  const overallStatus = health?.status ?? 'unknown';
  const wsStats       = health?.checks?.websocket as (HealthCheck & { connectedUsers?: number; totalConnections?: number }) | undefined;

  return (
    <div className="min-h-screen bg-black text-white p-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Enterprise Runtime Intelligence
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Phase 8 — Real-time observability across all system layers
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchAll}
            className="px-3 py-1.5 text-xs rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-950/40 transition-colors"
          >
            Refresh
          </button>
          <span className="flex items-center gap-1.5 text-sm">
            <StatusBadge status={overallStatus === 'healthy' ? 'healthy' : overallStatus === 'degraded' ? 'warning' : 'critical'} />
            <span className="text-gray-300 capitalize">{overallStatus}</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading && !health && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* ── System Health Checks ─────────────────────────────────── */}
          <SectionTitle>System Health</SectionTitle>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
            {health?.checks ? (
              Object.entries(health.checks).map(([key, val]) => (
                <CheckRow key={key} label={key} check={val as HealthCheck} />
              ))
            ) : (
              <span className="text-xs text-gray-500">No health data</span>
            )}
          </div>

          {/* ── WebSocket Layer ──────────────────────────────────────── */}
          <SectionTitle>WebSocket Connections</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MetricCard
              label="Connected Users"
              value={wsStats?.connectedUsers ?? '—'}
              sub="authenticated sessions"
              accent
            />
            <MetricCard
              label="Total Sockets"
              value={wsStats?.totalConnections ?? '—'}
              sub="across all users"
            />
            <MetricCard
              label="Redis Fanout"
              value={(wsStats as any)?.redisFanout ? 'Active' : 'Off'}
              sub="multi-instance mode"
            />
            <MetricCard
              label="Ghost Connections"
              value={(wsStats as any)?.ghostConnections ?? '—'}
              sub="not in OPEN state"
            />
          </div>

          {/* ── DLQ Intelligence ─────────────────────────────────────── */}
          <SectionTitle>Dead-Letter Queue Health</SectionTitle>
          {dlq ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge status={dlq.status} />
                <span className="text-sm font-medium text-white capitalize">{dlq.status}</span>
                <span className="text-xs text-gray-500 ml-auto">{dlq.ts ? new Date(dlq.ts).toLocaleTimeString() : ''}</span>
              </div>
              {!dlq.tierQueues ? (
                <p className="text-xs text-gray-500">Queue system unavailable (Redis offline)</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(dlq.tiers || {}).map(([tier, info]) => (
                    <div key={tier} className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <span className={`text-xs font-mono ${TIER_COLORS[tier] ?? 'text-gray-400'}`}>{tier}</span>
                      <div className="mt-1 flex items-end justify-between">
                        <span className="text-lg font-bold text-white">{info.dlqDepth}</span>
                        <StatusBadge status={info.status} />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {info.waiting} waiting · {info.active} active
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 text-xs text-gray-500">
              DLQ data unavailable — admin access required
            </div>
          )}

          {/* ── Org Queue Fairness ──────────────────────────────────── */}
          <SectionTitle>Organisation Queue Fairness</SectionTitle>
          {orgQueue?.success ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
              {orgQueue.summary && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MetricCard label="Active Orgs"     value={orgQueue.summary.totalOrgs}    />
                  <MetricCard label="Throttled Orgs"  value={orgQueue.summary.throttledOrgs} />
                  <MetricCard label="Total Enqueued"  value={orgQueue.summary.totalEnqueued} />
                </div>
              )}
              {orgQueue.orgs && orgQueue.orgs.length > 0 && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {orgQueue.orgs.map(org => (
                    <div key={org.orgId} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 text-sm">
                      <span className="text-gray-300 truncate max-w-xs">{org.name || org.orgId}</span>
                      <div className="flex gap-4 text-xs text-gray-400 font-mono">
                        <span>↑ {org.metrics?.enqueued ?? 0}</span>
                        <span className="text-green-400">✓ {org.metrics?.completed ?? 0}</span>
                        <span className="text-red-400">✗ {org.metrics?.failed ?? 0}</span>
                        {(org.metrics?.throttled ?? 0) > 0 && (
                          <span className="text-yellow-400">⚡ {org.metrics.throttled}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 text-xs text-gray-500">
              Org queue data unavailable — admin access required
            </div>
          )}

          {/* ── Phase 15B.6 Observability Intelligence ─────────────── */}
          <ObservabilityIntelligencePanel />

          {/* ── Runtime Version Banner ──────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-amber-400 font-semibold uppercase tracking-widest">AutoFlowNG</span>
              <span className="text-xs text-gray-400 ml-2">
                v15.5.0 · Phase 15B.6 Observability & Read Replica Intelligence
              </span>
            </div>
            <a
              href="/api/metrics"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-500 hover:text-amber-400 underline"
            >
              Prometheus /metrics →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
