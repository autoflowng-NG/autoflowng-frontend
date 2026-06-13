/**
 * AutoFlowNG — Observability Intelligence Panel (Phase 15B.8 — Workstream H)
 *
 * Phase 15B.8 additions (strictly additive — no prior sections removed or redesigned):
 *   - Queue Intelligence section (saturation, pressure, growth, forecast)
 *   - Execution Recovery section (stuck count, orphan count, engine status)
 *   - Redis Resilience section (latency percentiles, memory pressure, reconnects)
 *   - Region Readiness section (region count, health, routing model)
 *   - Control Plane section (topology, node count, roles)
 *   - Capacity Risk Score (capacityRiskScore, riskCategory, 5M tier in table)
 *   - Summary header bar (system score + 5 quick-status pills)
 *
 * Phase 15B.6/15B.7 sections preserved unchanged:
 *   Health, Cache, Replica, Worker, Scheduler, Capacity Intelligence
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Type extensions (Phase 15B.8 additions) ────────────────────────────────────

interface Summary {
  health?: {
    systemHealthScore: number;
    category: string;
    subsystems: Record<string, { score: number }>;
  };
  cache?: {
    hitRatio: number; missRatio: number; keyCount: number;
    evictions: number; efficiency: string; memoryEstimateBytes: number;
  };
  replica?: {
    mode: string; healthScore: number; readShare: number;
    replicaLagSeconds: number | null; status: string;
  };
  workers?: {
    tierQueues: boolean;
    fleet?: { utilizationPct: number; status: string; totalCompleted: number };
    tiers?: Record<string, { throughputPerMin: number; utilizationPct: number; status: string }>;
  };
  scheduler?: {
    status: string; recommendedPartitions: number; partitionsActive: number;
    backlogProjection: number; maxBurst: number;
  };
  capacity?: {
    projections: Array<{
      users: number; apiPods: number; workerPods: number;
      replicas: number; schedulerShards: number; blockers: string[];
      redis?: { cmdsPerSec: number; loadPct: number };
    }>;
    capacityRiskScore?: number;
    riskCategory?: string;
    exhaustionForecasts?: {
      workers?: { utilizationPct?: number; daysToExhaustion?: number | null; risk?: string; recommendation?: string; available?: boolean };
      scheduler?: { utilizationPct?: number; nextExhaustionAtUsers?: number | null; risk?: string; recommendation?: string; available?: boolean };
      redis?: { loadPct?: number; nextExhaustionAtUsers?: number | null; risk?: string; recommendation?: string; available?: boolean };
    };
  };
  // Phase 15B.8
  queueIntelligence?: {
    available: boolean;
    tiers?: Record<string, { waiting: number; active: number; pressure: number; growthRate: number; forecastDepth: number; status: string; healthScore: number }>;
    fleet?: { totalWaiting: number; totalActive: number; avgPressure: number; healthScore: number; status: string; saturatedTiers: number };
    forecast?: { horizonSeconds: number; totalProjected: number; riskLevel: string };
  };
  recovery?: {
    running: boolean;
    stuckCount: number;
    intervalMs: number;
    stuckThresholdMin: number;
    coordinator?: { ownedLeases: number; orphanCount: number; mode: string };
  };
  redisResilience?: {
    mode: string; healthScore: number; status: string;
    latency?: { p50Ms: number | null; p95Ms: number | null; p99Ms: number | null };
    memory?: { pressurePct: number; usedHuman: string | null };
    reconnects?: { total: number; recentReconnect: boolean };
    commands?: { total: number; failures: number; failureRate: number };
  };
  regions?: {
    regionCount: number; thisRegion: string; multiRegion: boolean; overallStatus: string;
    regions?: Array<{ regionId: string; healthScore: number; status: string; latencyMs?: number; workerCount?: number }>;
    note?: string;
  };
  controlPlane?: {
    status: string; nodeCount: number; healthyNodes: number;
    roleBreakdown?: Record<string, number>;
    controlPlaneMode: string;
  };

  // ── Phase 15B.9 additions (strictly additive — no prior fields changed) ──
  queueStall?: {
    queues?: Record<string, { stallsLastMinute: number; repeatedStalls: number; trackedJobs: number; alertThreshold: number; status: string }>;
    queueCount?: number;
    windowMs?: number;
  } | null;
  redisSubscriptions?: {
    subscriptions?: Record<string, { channel: string; healthy: boolean; lastProbeAgoMs: number }>;
    subscriptionCount?: number;
    probeIntervalMs?: number;
  } | null;
  recoveryIdempotency?: {
    dedupTtlS: number; attemptTtlS: number; mode: string;
  } | null;
  schedulerJitter?: {
    enabled: boolean; jitterMaxMs: number; shardOffsetMs: number;
  } | null;

  // ── Phase 15C additions (strictly additive — global orchestration) ──
  globalLatency?: {
    matrix?: Record<string, Record<string, { samples: number; p50: number | null; p95: number | null; p99: number | null; last: number | null }>>;
    probe?: { available: boolean; thisRegion: string; probeIntervalMs: number; windowSize: number; trackedPairs: number; running: boolean };
  } | null;
  globalFailover?: {
    regions?: Array<{ regionId: string; state: string; healthScore: number }>;
    transitions?: Array<{ regionId: string; from: string; to: string }>;
    unhealthy?: number;
    thresholds?: { failover: number; degraded: number };
  } | null;
  globalPlacement?: {
    thisRegion?: string;
    scored?: Array<{ regionId: string; health: number; capacity: number; latencyP95: number; compositeScore: number; status?: string }>;
    best?: { regionId: string; compositeScore: number } | null;
  } | null;
  globalTopology?: {
    clusterCount?: number; federatedNodes?: number; controlPlaneHealthScore?: number;
    regionTopology?: Array<{ regionId: string; healthScore: number; status: string; workerCount: number | null }>;
    federation?: { mode: string; supportsMultiRegion: boolean; supportsMultiCluster: boolean };
  } | null;
  globalKubernetes?: {
    current?: { workers: number };
    recommended?: { workerPods: number; schedulerPods: number; apiPods: number };
    hpa?: { worker: { minReplicas: number; maxReplicas: number; targetCPUUtilization: number }; api: { minReplicas: number; maxReplicas: number; targetCPUUtilization: number } };
    clusterSizing?: { smallNodes: number; mediumNodes: number };
  } | null;
  globalReplication?: {
    thisRegion?: string; streamLen?: number; lagMs?: number | null;
    eventsEmitted?: number; failures?: number; failureRate?: number;
  } | null;
  globalRouter?: { thisRegion?: string; mode?: string; available?: boolean } | null;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  healthy:        'text-green-400',
  warning:        'text-yellow-400',
  degraded:       'text-orange-400',
  critical:       'text-red-400',
  saturated:      'text-red-400',
  busy:           'text-amber-400',
  growing:        'text-yellow-300',
  not_configured: 'text-gray-400',
  single_db:      'text-gray-400',
  low:            'text-green-400',
  moderate:       'text-yellow-400',
  high:           'text-orange-400',
};

const RISK_COLOR: Record<string, string> = {
  low: 'text-green-400', moderate: 'text-yellow-400',
  high: 'text-orange-400', critical: 'text-red-400',
};

function Card({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3 mt-6">{children}</h2>;
}

function SmCard({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 uppercase tracking-widest">{label}</span>
      <span className={`text-lg font-semibold ${color ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

function Pill({ label, status }: { label: string; status: string }) {
  const color = CAT_COLOR[status] ?? 'text-gray-400';
  const bg    = status === 'healthy' ? 'bg-green-500/10' : status === 'critical' ? 'bg-red-500/10' : 'bg-amber-500/10';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
      {label}
    </span>
  );
}

function fmtBytes(b?: number) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

function fmtUsers(n?: number | null) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ObservabilityIntelligencePanel() {
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const headers = useCallback(() => {
    const token = localStorage.getItem('autoflowng_token') || sessionStorage.getItem('autoflowng_token') || '';
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/observability/summary', { headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setErr(null);
    } catch (e) {
      setErr('Observability intelligence unavailable — admin access required');
    }
  }, [headers]);

  useEffect(() => {
    fetchData();
    timer.current = setInterval(fetchData, 15_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [fetchData]);

  if (err) {
    return (
      <>
        <Title>Observability Intelligence (Phase 15B.8)</Title>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 text-xs text-gray-500">{err}</div>
      </>
    );
  }
  if (!data) return null;

  const h   = data.health;
  const c   = data.cache;
  const rep = data.replica;
  const w   = data.workers;
  const s   = data.scheduler;
  const cap = data.capacity;
  const qi  = data.queueIntelligence;
  const rec = data.recovery;
  const rr  = data.redisResilience;
  const reg = data.regions;
  const cp  = data.controlPlane;

  return (
    <>
      {/* ── Phase 15B.8: Summary Status Bar ────────────────────────────── */}
      <Title>Observability Intelligence (Phase 15B.8)</Title>
      <div className="flex flex-wrap gap-2 mb-4">
        <Pill label={`System ${h?.systemHealthScore ?? '—'}`} status={h?.category ?? 'healthy'} />
        <Pill label={`Queue ${qi?.fleet?.status ?? '—'}`}     status={qi?.fleet?.status ?? 'healthy'} />
        <Pill label={`Redis ${rr?.status ?? '—'}`}            status={rr?.status ?? 'healthy'} />
        <Pill label={`Recovery ${rec?.running ? 'active' : 'stopped'}`} status={rec?.running ? 'healthy' : 'warning'} />
        <Pill label={`Regions ${reg?.regionCount ?? 1}`}      status={reg?.overallStatus ?? 'healthy'} />
        <Pill label={`Cluster ${cp?.nodeCount ?? 1} nodes`}   status={cp?.status ?? 'healthy'} />
        {cap?.riskCategory && <Pill label={`Capacity risk: ${cap.riskCategory}`} status={cap.riskCategory} />}
      </div>

      {/* ── Phase 15B.6/15B.7: Health Intelligence ─────────────────────── */}
      <Title>Health Intelligence</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <Card label="System Health" value={<span className={CAT_COLOR[h?.category ?? ''] ?? 'text-white'}>{h?.systemHealthScore ?? '—'}</span>} sub={h?.category ?? ''} />
        {h?.subsystems && Object.entries(h.subsystems).slice(0, 3).map(([k, v]) => (
          <Card key={k} label={k} value={v.score} sub="subsystem score" />
        ))}
      </div>
      {h?.subsystems && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {Object.entries(h.subsystems).slice(3).map(([k, v]) => (
            <Card key={k} label={k} value={v.score} sub="subsystem score" />
          ))}
        </div>
      )}

      {/* ── Phase 15B.6/15B.7: Cache Intelligence ───────────────────────── */}
      <Title>Cache Intelligence</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card label="Hit Ratio" value={`${((c?.hitRatio ?? 0) * 100).toFixed(1)}%`} sub={c?.efficiency} />
        <Card label="Miss Ratio" value={`${((c?.missRatio ?? 0) * 100).toFixed(1)}%`} />
        <Card label="Keys" value={c?.keyCount ?? '—'} sub={`${c?.evictions ?? 0} evictions`} />
        <Card label="Cache Memory" value={fmtBytes(c?.memoryEstimateBytes)} sub="per-pod estimate" />
      </div>

      {/* ── Phase 15B.6/15B.7: Replica Intelligence ─────────────────────── */}
      <Title>Read Replica Intelligence</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card label="Health Score" value={<span className={CAT_COLOR[rep?.status ?? ''] ?? 'text-white'}>{rep?.healthScore ?? '—'}</span>} sub={rep?.status} />
        <Card label="Read Share" value={`${((rep?.readShare ?? 0) * 100).toFixed(1)}%`} sub="replica vs primary" />
        <Card label="Replica Lag" value={rep?.replicaLagSeconds != null ? `${rep.replicaLagSeconds.toFixed(2)}s` : 'n/a'} />
        <Card label="Mode" value={rep?.mode ?? '—'} />
      </div>

      {/* ── Phase 15B.6/15B.7: Worker Intelligence ──────────────────────── */}
      <Title>Worker Throughput Intelligence</Title>
      {w?.tierQueues && w.tiers ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {Object.entries(w.tiers).map(([tier, t]) => (
            <Card key={tier} label={tier} value={<span className={CAT_COLOR[t.status] ?? 'text-white'}>{t.throughputPerMin}/min</span>} sub={`${t.utilizationPct}% util`} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 text-xs text-gray-500">
          Tier queues not initialised on this node (API-only role or Redis off)
        </div>
      )}

      {/* ── Phase 15B.6/15B.7: Scheduler Intelligence ───────────────────── */}
      <Title>Scheduler Intelligence</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card label="Status" value={<span className={CAT_COLOR[s?.status ?? ''] ?? 'text-white'}>{s?.status ?? '—'}</span>} />
        <Card label="Recommended Shards" value={s?.recommendedPartitions ?? '—'} sub={`active: ${s?.partitionsActive ?? 1}`} />
        <Card label="Peak Burst" value={s?.maxBurst ?? '—'} sub="workflows/tick" />
        <Card label="Backlog Projection" value={s?.backlogProjection ?? '—'} sub="jobs over budget" />
      </div>

      {/* ── Phase 15B.8: Queue Intelligence ─────────────────────────────── */}
      <Title>Queue Intelligence (Phase 15B.8)</Title>
      {qi?.available ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <Card label="Queue Health" value={<span className={CAT_COLOR[qi.fleet?.status ?? ''] ?? 'text-white'}>{qi.fleet?.healthScore ?? '—'}</span>} sub={qi.fleet?.status} />
            <Card label="Avg Pressure" value={`${qi.fleet?.avgPressure ?? '—'}%`} sub="fleet-wide" />
            <Card label="Total Waiting" value={qi.fleet?.totalWaiting?.toLocaleString() ?? '—'} sub="all tiers" />
            <Card label="Forecast Risk" value={<span className={RISK_COLOR[qi.forecast?.riskLevel ?? ''] ?? 'text-white'}>{qi.forecast?.riskLevel ?? '—'}</span>} sub={`${qi.forecast?.horizonSeconds ?? 300}s horizon`} />
          </div>
          {qi.tiers && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="py-1.5 pr-4">Tier</th><th className="pr-4">Waiting</th><th className="pr-4">Active</th>
                    <th className="pr-4">Pressure</th><th className="pr-4">Growth/min</th><th className="pr-4">Forecast (5m)</th><th>Status</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300 font-mono">
                  {Object.entries(qi.tiers).map(([tier, t]) => (
                    <tr key={tier} className="border-t border-white/5">
                      <td className="py-1.5 pr-4 font-semibold">{tier}</td>
                      <td className="pr-4">{t.waiting}</td>
                      <td className="pr-4">{t.active}</td>
                      <td className="pr-4">{t.pressure}%</td>
                      <td className="pr-4">{t.growthRate > 0 ? `+${t.growthRate}` : t.growthRate}</td>
                      <td className="pr-4">{t.forecastDepth}</td>
                      <td className={CAT_COLOR[t.status] ?? 'text-gray-300'}>{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 text-xs text-gray-500">
          Queue intelligence unavailable — tier queues not initialised or Redis off
        </div>
      )}

      {/* ── Phase 15B.8: Redis Resilience ────────────────────────────────── */}
      <Title>Redis Resilience (Phase 15B.8)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card label="Redis Health" value={<span className={CAT_COLOR[rr?.status ?? ''] ?? 'text-white'}>{rr?.healthScore ?? '—'}</span>} sub={rr?.status} />
        <Card label="p50 Latency" value={rr?.latency?.p50Ms != null ? `${rr.latency.p50Ms}ms` : '—'} sub="ping p50" />
        <Card label="p95 Latency" value={rr?.latency?.p95Ms != null ? `${rr.latency.p95Ms}ms` : '—'} sub="ping p95" />
        <Card label="Mem Pressure" value={rr?.memory?.pressurePct != null ? `${rr.memory.pressurePct}%` : '—'} sub={rr?.memory?.usedHuman ?? ''} />
      </div>
      {rr && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <SmCard label="Reconnects" value={rr.reconnects?.total ?? 0} color={rr.reconnects?.recentReconnect ? 'text-amber-400' : 'text-green-400'} sub={rr.reconnects?.recentReconnect ? 'recent reconnect' : 'stable'} />
          <SmCard label="Cmd Failures" value={rr.commands?.failures ?? 0} sub={`${((rr.commands?.failureRate ?? 0) * 100).toFixed(2)}% rate`} color={(rr.commands?.failureRate ?? 0) > 0.01 ? 'text-red-400' : 'text-green-400'} />
          <SmCard label="Mode" value={rr.mode ?? '—'} />
        </div>
      )}

      {/* ── Phase 15B.8: Execution Recovery ─────────────────────────────── */}
      <Title>Execution Recovery Engine (Phase 15B.8)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card label="Engine" value={<span className={rec?.running ? 'text-green-400' : 'text-red-400'}>{rec?.running ? 'Active' : 'Stopped'}</span>} sub={rec?.running ? `every ${Math.round((rec?.intervalMs ?? 60000) / 1000)}s` : 'not running'} />
        <Card label="Stuck Runs" value={<span className={(rec?.stuckCount ?? 0) > 0 ? 'text-amber-400' : 'text-green-400'}>{rec?.stuckCount ?? 0}</span>} sub={`>${rec?.stuckThresholdMin ?? 15}min threshold`} />
        <Card label="Orphaned Leases" value={<span className={(rec?.coordinator?.orphanCount ?? 0) > 0 ? 'text-amber-400' : 'text-green-400'}>{rec?.coordinator?.orphanCount ?? 0}</span>} sub="no active owner" />
        <Card label="Coord Mode" value={rec?.coordinator?.mode ?? '—'} sub={`${rec?.coordinator?.ownedLeases ?? 0} owned leases`} />
      </div>

      {/* ── Phase 15B.8: Control Plane ───────────────────────────────────── */}
      <Title>Control Plane (Phase 15B.8)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card label="Status" value={<span className={CAT_COLOR[cp?.status ?? ''] ?? 'text-white'}>{cp?.status ?? '—'}</span>} sub={cp?.controlPlaneMode} />
        <Card label="Active Nodes" value={cp?.nodeCount ?? '—'} sub={`${cp?.healthyNodes ?? '—'} healthy`} />
        {cp?.roleBreakdown && Object.entries(cp.roleBreakdown).map(([role, count]) => (
          <SmCard key={role} label={role} value={count} sub="nodes" />
        ))}
      </div>

      {/* ── Phase 15B.8: Region Readiness ────────────────────────────────── */}
      <Title>Region Readiness (Phase 15B.8)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <Card label="Regions" value={reg?.regionCount ?? 1} sub={reg?.multiRegion ? 'multi-region' : 'single-region'} />
        <Card label="This Region" value={reg?.thisRegion ?? 'default'} />
        <Card label="Overall" value={<span className={CAT_COLOR[reg?.overallStatus ?? ''] ?? 'text-white'}>{reg?.overallStatus ?? '—'}</span>} />
        <Card label="Multi-Region" value={reg?.multiRegion ? 'Ready' : 'Single'} sub={reg?.multiRegion ? 'routing active' : 'add REGION_ID env to activate'} />
      </div>
      {reg?.regions && reg.regions.length > 1 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="py-1.5 pr-4">Region</th><th className="pr-4">Health</th><th className="pr-4">Status</th>
                <th className="pr-4">Latency</th><th>Workers</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 font-mono">
              {reg.regions.map(r => (
                <tr key={r.regionId} className="border-t border-white/5">
                  <td className="py-1.5 pr-4 font-semibold">{r.regionId}</td>
                  <td className="pr-4">{r.healthScore}</td>
                  <td className={`pr-4 ${CAT_COLOR[r.status] ?? ''}`}>{r.status}</td>
                  <td className="pr-4">{r.latencyMs != null ? `${r.latencyMs}ms` : '—'}</td>
                  <td>{r.workerCount ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {reg?.note && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 mb-4 text-xs text-gray-500">{reg.note}</div>
      )}

      {/* ── Phase 15B.8: Capacity Intelligence (extended with risk score + 5M) */}
      <Title>Capacity Intelligence (Phase 15B.8)</Title>
      {cap?.capacityRiskScore != null && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Card label="Capacity Risk Score" value={<span className={RISK_COLOR[cap.riskCategory ?? ''] ?? 'text-white'}>{cap.capacityRiskScore}</span>} sub={cap.riskCategory ?? ''} />
          {cap.exhaustionForecasts?.workers?.daysToExhaustion != null && (
            <Card label="Worker Exhaustion" value={<span className={RISK_COLOR[cap.exhaustionForecasts.workers.risk ?? ''] ?? 'text-white'}>{cap.exhaustionForecasts.workers.daysToExhaustion}d</span>} sub={cap.exhaustionForecasts.workers.recommendation} />
          )}
          {cap.exhaustionForecasts?.scheduler?.nextExhaustionAtUsers != null && (
            <Card label="Sched Exhaustion" value={<span className={RISK_COLOR[cap.exhaustionForecasts.scheduler.risk ?? ''] ?? 'text-white'}>{fmtUsers(cap.exhaustionForecasts.scheduler.nextExhaustionAtUsers)}</span>} sub="user count trigger" />
          )}
          {cap.exhaustionForecasts?.redis?.nextExhaustionAtUsers != null && (
            <Card label="Redis Exhaustion" value={<span className={RISK_COLOR[cap.exhaustionForecasts.redis.risk ?? ''] ?? 'text-white'}>{fmtUsers(cap.exhaustionForecasts.redis.nextExhaustionAtUsers)}</span>} sub="user count trigger" />
          )}
        </div>
      )}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-gray-400 uppercase tracking-widest">
            <tr>
              <th className="py-1.5 pr-4">Users</th><th className="pr-4">API</th><th className="pr-4">Workers</th>
              <th className="pr-4">Replicas</th><th className="pr-4">Shards</th>
              <th className="pr-4">Redis Cmd/s</th><th>Blockers</th>
            </tr>
          </thead>
          <tbody className="text-gray-300 font-mono">
            {cap?.projections?.map((p) => (
              <tr key={p.users} className={`border-t border-white/5 ${p.users >= 5_000_000 ? 'text-amber-200' : ''}`}>
                <td className="py-1.5 pr-4 font-semibold">{fmtUsers(p.users)}</td>
                <td className="pr-4">{p.apiPods}</td>
                <td className="pr-4">{p.workerPods}</td>
                <td className="pr-4">{p.replicas}</td>
                <td className="pr-4">{p.schedulerShards}</td>
                <td className="pr-4">{p.redis?.cmdsPerSec?.toLocaleString() ?? '—'}</td>
                <td className="text-amber-400">{p.blockers.length ? p.blockers.join('; ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Phase 15B.9: Enterprise Hardening (additive) ─────────────────── */}
      <Title>Execution Safety (Phase 15B.9)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SmCard label="Recovery Mode" value={data.recoveryIdempotency?.mode ?? '—'} sub="dedup backend" />
        <SmCard label="Dedup TTL" value={`${data.recoveryIdempotency?.dedupTtlS ?? '—'}s`} sub="lockout window" />
        <SmCard label="Attempt TTL" value={`${data.recoveryIdempotency?.attemptTtlS ?? '—'}s`} sub="recovery slot" />
        <SmCard label="Orphan Leader" value={data.recovery?.coordinator && 'isOrphanLeader' in (data.recovery?.coordinator as any) ? ((data.recovery?.coordinator as any).isOrphanLeader ? 'YES' : 'no') : '—'} sub="leader-elected scan" />
      </div>

      <Title>Scheduler Health (Phase 15B.9)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SmCard label="Lock Jitter" value={data.schedulerJitter?.enabled ? `0–${data.schedulerJitter.jitterMaxMs}ms` : 'off'} sub="herd protection" />
        <SmCard label="Shard Offset" value={`${data.schedulerJitter?.shardOffsetMs ?? '—'}ms`} sub="per-shard stagger" />
        <SmCard label="Capacity Spike Risk" value={(data.capacity as any)?.spikeRiskScore ?? '—'} sub="0–40 subscore" />
        <SmCard label="Risk Category" value={data.capacity?.riskCategory ?? '—'} color={RISK_COLOR[data.capacity?.riskCategory ?? ''] ?? 'text-white'} />
      </div>

      <Title>Queue Stall Intelligence (Phase 15B.9)</Title>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-gray-400 uppercase tracking-widest">
            <tr><th className="py-1.5 pr-4">Queue</th><th className="pr-4">Stalls / min</th><th className="pr-4">Repeated</th><th className="pr-4">Tracked</th><th>Status</th></tr>
          </thead>
          <tbody className="text-gray-300 font-mono">
            {data.queueStall?.queues && Object.entries(data.queueStall.queues).map(([q, s]) => (
              <tr key={q} className="border-t border-white/5">
                <td className="py-1.5 pr-4">{q}</td>
                <td className="pr-4">{s.stallsLastMinute}</td>
                <td className="pr-4">{s.repeatedStalls}</td>
                <td className="pr-4">{s.trackedJobs}</td>
                <td><Pill label={s.status} status={s.status === 'stable' ? 'healthy' : s.status === 'unstable' ? 'critical' : 'warning'} /></td>
              </tr>
            ))}
            {!data.queueStall?.queues && (
              <tr><td colSpan={5} className="py-2 text-gray-500">No stall data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Title>Redis Subscription Health (Phase 15B.9)</Title>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-gray-400 uppercase tracking-widest">
            <tr><th className="py-1.5 pr-4">Subscription</th><th className="pr-4">Channel</th><th className="pr-4">Healthy</th><th>Last probe</th></tr>
          </thead>
          <tbody className="text-gray-300 font-mono">
            {data.redisSubscriptions?.subscriptions && Object.entries(data.redisSubscriptions.subscriptions).map(([name, s]) => (
              <tr key={name} className="border-t border-white/5">
                <td className="py-1.5 pr-4">{name}</td>
                <td className="pr-4">{s.channel}</td>
                <td className={`pr-4 ${s.healthy ? 'text-green-400' : 'text-red-400'}`}>{s.healthy ? 'yes' : 'no'}</td>
                <td>{Math.round(s.lastProbeAgoMs / 1000)}s ago</td>
              </tr>
            ))}
            {!data.redisSubscriptions?.subscriptions && (
              <tr><td colSpan={4} className="py-2 text-gray-500">No subscriptions registered.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Title>Spike Risk Analysis (Phase 15B.9)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SmCard label="Spike Subscore" value={(data.capacity as any)?.spikeRiskScore ?? '—'} sub="queue acceleration" />
        <SmCard label="Total Risk" value={data.capacity?.capacityRiskScore ?? '—'} sub={data.capacity?.riskCategory ?? '—'} color={RISK_COLOR[data.capacity?.riskCategory ?? ''] ?? 'text-white'} />
        <SmCard label="Fleet Pressure" value={data.queueIntelligence?.fleet?.avgPressure ?? '—'} sub="across tiers" />
        <SmCard label="Forecast Depth" value={data.queueIntelligence?.forecast?.totalProjected ?? '—'} sub="projected jobs" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Phase 15C — Global Operations Center (strictly additive)            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <Title>Global Region Map (Phase 15C)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SmCard label="Clusters" value={data.globalTopology?.clusterCount ?? '—'} sub={data.globalTopology?.federation?.mode ?? '—'} />
        <SmCard label="Federated Nodes" value={data.globalTopology?.federatedNodes ?? '—'} sub="active" />
        <SmCard label="Control Plane Score" value={data.globalTopology?.controlPlaneHealthScore ?? '—'} sub="health 0–100" />
        <SmCard label="This Region" value={data.globalRouter?.thisRegion ?? '—'} sub={data.globalRouter?.mode ?? 'router'} />
      </div>

      <Title>Region Health Matrix (Phase 15C)</Title>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-gray-400 uppercase tracking-widest">
            <tr><th className="py-1.5 pr-4">Region</th><th className="pr-4">Health</th><th className="pr-4">Workers</th><th>Status</th></tr>
          </thead>
          <tbody className="text-gray-300 font-mono">
            {data.globalTopology?.regionTopology?.map(r => (
              <tr key={r.regionId} className="border-t border-white/5">
                <td className="py-1.5 pr-4">{r.regionId}</td>
                <td className="pr-4">{r.healthScore}</td>
                <td className="pr-4">{r.workerCount ?? '—'}</td>
                <td><Pill label={r.status} status={r.status === 'healthy' ? 'healthy' : r.status === 'degraded' ? 'warning' : 'critical'} /></td>
              </tr>
            ))}
            {!data.globalTopology?.regionTopology?.length && (
              <tr><td colSpan={4} className="py-2 text-gray-500">Single-region deployment.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Title>Latency Matrix (Phase 15C)</Title>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-gray-400 uppercase tracking-widest">
            <tr><th className="py-1.5 pr-4">From → To</th><th className="pr-4">Samples</th><th className="pr-4">p50</th><th className="pr-4">p95</th><th>p99</th></tr>
          </thead>
          <tbody className="text-gray-300 font-mono">
            {data.globalLatency?.matrix && Object.entries(data.globalLatency.matrix).flatMap(([from, tos]) =>
              Object.entries(tos).map(([to, m]) => (
                <tr key={`${from}->${to}`} className="border-t border-white/5">
                  <td className="py-1.5 pr-4">{from} → {to}</td>
                  <td className="pr-4">{m.samples}</td>
                  <td className="pr-4">{m.p50 ?? '—'}ms</td>
                  <td className="pr-4">{m.p95 ?? '—'}ms</td>
                  <td>{m.p99 ?? '—'}ms</td>
                </tr>
              )))}
            {!data.globalLatency?.matrix || !Object.keys(data.globalLatency.matrix).length ? (
              <tr><td colSpan={5} className="py-2 text-gray-500">No cross-region samples yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Title>Failover Activity (Phase 15C)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SmCard label="Unhealthy Regions" value={data.globalFailover?.unhealthy ?? 0} sub="below thresholds" />
        <SmCard label="Failover @" value={`${data.globalFailover?.thresholds?.failover ?? '—'}`} sub="health score" />
        <SmCard label="Degraded @" value={`${data.globalFailover?.thresholds?.degraded ?? '—'}`} sub="health score" />
        <SmCard label="Recent Transitions" value={data.globalFailover?.transitions?.length ?? 0} sub="last evaluation" />
      </div>

      <Title>Execution Placement (Phase 15C)</Title>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-gray-400 uppercase tracking-widest">
            <tr><th className="py-1.5 pr-4">Region</th><th className="pr-4">Health</th><th className="pr-4">Capacity</th><th className="pr-4">Latency p95</th><th>Score</th></tr>
          </thead>
          <tbody className="text-gray-300 font-mono">
            {data.globalPlacement?.scored?.map(r => (
              <tr key={r.regionId} className="border-t border-white/5">
                <td className="py-1.5 pr-4">{r.regionId}{r.regionId === data.globalPlacement?.best?.regionId ? ' ★' : ''}</td>
                <td className="pr-4">{r.health}</td>
                <td className="pr-4">{r.capacity}</td>
                <td className="pr-4">{r.latencyP95}ms</td>
                <td>{r.compositeScore}</td>
              </tr>
            ))}
            {!data.globalPlacement?.scored?.length && (
              <tr><td colSpan={5} className="py-2 text-gray-500">No placement scores.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Title>Replication Health (Phase 15C)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SmCard label="Stream Length" value={data.globalReplication?.streamLen ?? '—'} sub="events buffered" />
        <SmCard label="Lag" value={`${data.globalReplication?.lagMs ?? '—'}ms`} sub="since last emit" />
        <SmCard label="Events Emitted" value={data.globalReplication?.eventsEmitted ?? 0} sub="total" />
        <SmCard label="Failure Rate" value={`${Math.round((data.globalReplication?.failureRate ?? 0) * 100)}%`} sub={`${data.globalReplication?.failures ?? 0} failures`} />
      </div>

      <Title>Kubernetes Readiness (Phase 15C)</Title>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SmCard label="Workers (rec.)" value={data.globalKubernetes?.recommended?.workerPods ?? '—'} sub={`current: ${data.globalKubernetes?.current?.workers ?? '—'}`} />
        <SmCard label="Schedulers (rec.)" value={data.globalKubernetes?.recommended?.schedulerPods ?? '—'} sub="pods" />
        <SmCard label="API (rec.)" value={data.globalKubernetes?.recommended?.apiPods ?? '—'} sub="pods" />
        <SmCard label="HPA Target CPU" value={`${data.globalKubernetes?.hpa?.worker?.targetCPUUtilization ?? '—'}%`} sub={`max ${data.globalKubernetes?.hpa?.worker?.maxReplicas ?? '—'}`} />
      </div>
    </>
  );
}
