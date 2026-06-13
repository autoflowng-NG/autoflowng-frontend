/**
 * AutoFlowNG — Phase 20.1 Ops Center
 * Enterprise Stabilization & Risk Elimination
 *
 * Adds Phase 20.1 monitoring panels to the Phase 20 Ops Center:
 *   Panel 1 — Credential Vault Migration Status (WS1)
 *   Panel 2 — Governance Fail-Closed Config (WS3)
 *   Panel 3 — Trust Score Guard: pending approvals + audit log (WS4)
 *   Panel 4 — Scheduler Health State (WS6)
 *   Panel 5 — Schema Integrity Check (WS7)
 *   Panel 6 — Bus Stats (WS2)
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ── Shared helpers ────────────────────────────────────────────────────────────

const API  = '/api/phase20';
const API1 = '/api/phase20_1';
const fetcher = (url: string) => fetch(url).then(r => r.json());

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-900/50 text-green-300 border border-green-700',
    red:    'bg-red-900/50 text-red-300 border border-red-700',
    yellow: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
    blue:   'bg-blue-900/50 text-blue-300 border border-blue-700',
    purple: 'bg-purple-900/50 text-purple-300 border border-purple-700',
    orange: 'bg-orange-900/50 text-orange-300 border border-orange-700',
    gray:   'bg-gray-800 text-gray-400 border border-gray-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color] || colors.gray}`}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub, color = 'gray' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  const textColor: Record<string, string> = {
    green: 'text-green-400', blue: 'text-blue-400', yellow: 'text-yellow-400',
    red: 'text-red-400', purple: 'text-purple-400', orange: 'text-orange-400', gray: 'text-gray-300',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${textColor[color] || textColor.gray}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, badge, badgeColor = 'blue' }: { title: string; badge?: string; badgeColor?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
      {badge && <Badge label={badge} color={badgeColor} />}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-xs uppercase text-gray-500 bg-gray-900/80 font-medium">{children}</th>;
}
function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2 text-gray-300 border-t border-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>{children}</td>;
}

function ErrorBox({ message }: { message: string }) {
  return <div className="bg-red-900/20 border border-red-800 rounded p-3 text-red-400 text-sm">{message}</div>;
}
function LoadingSpinner() {
  return <div className="text-gray-500 text-sm">Loading…</div>;
}

// ── WS1: Reliability Closure (from Phase 20) ──────────────────────────────────

function ReliabilityPanel() {
  const qc = useQueryClient();
  const { data: diag }    = useQuery({ queryKey: ['p20-diag'],    queryFn: () => fetcher(`${API}/ws1/scheduler/diagnostics`), refetchInterval: 30_000 });
  const { data: wiring }  = useQuery({ queryKey: ['p20-wiring'],  queryFn: () => fetcher(`${API}/ws1/wiring/health`),          refetchInterval: 60_000 });
  const { data: fed }     = useQuery({ queryKey: ['p20-fed'],     queryFn: () => fetcher(`${API}/ws1/federation/latest`),      refetchInterval: 60_000 });
  const { data: history } = useQuery({ queryKey: ['p20-sched-history'], queryFn: () => fetcher(`${API}/ws1/scheduler/history?limit=20`), refetchInterval: 30_000 });

  const runCheck = useMutation({
    mutationFn: () => fetch(`${API}/ws1/federation/run-check`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['p20-fed'] }),
  });

  const d = diag as any;
  const w = wiring as any;
  const f = fed as any;

  return (
    <section className="space-y-4">
      <SectionHeader title="WS1 — Reliability Closure" badge="Phase 20" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Scheduler"      value={d?.initialized ? 'Ready' : 'Initializing'} color={d?.initialized ? 'green' : 'yellow'} sub={d?.schedulerStatus} />
        <StatCard label="Leader"         value={d?.isLeader ? 'Yes' : 'No'}  color={d?.isLeader ? 'purple' : 'gray'} sub={d?.holderId?.slice(0, 8)} />
        <StatCard label="Recent Cycles"  value={d?.recentCycles ?? '—'} sub={`${d?.failureRate ?? 0}% failure`} color={d?.failureRate > 20 ? 'red' : 'green'} />
        <StatCard label="Wiring"         value={w?.status ?? '—'} color={w?.status === 'valid' ? 'green' : 'yellow'} sub={`${w?.wiredCount ?? 0} wired`} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => runCheck.mutate()}
          className="px-3 py-1.5 text-xs rounded bg-blue-800 hover:bg-blue-700 text-blue-100 disabled:opacity-50"
          disabled={runCheck.isPending}>
          {runCheck.isPending ? 'Running…' : 'Run Federation Check'}
        </button>
      </div>
      {Array.isArray(history) && history.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead><tr>{['Cycle','Status','Duration','Started'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {(history as any[]).slice(0, 10).map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <Td mono>{row.cycle_name}</Td>
                  <Td><Badge label={row.status} color={row.status === 'completed' ? 'green' : row.status === 'failed' ? 'red' : 'yellow'} /></Td>
                  <Td>{row.duration_ms ? `${row.duration_ms}ms` : '—'}</Td>
                  <Td mono>{row.started_at ? new Date(row.started_at).toLocaleTimeString() : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Phase 20.1 WS1: Credential Vault ─────────────────────────────────────────

function CredentialVaultPanel() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['p201-vault'], queryFn: () => fetcher(`${API1}/vault/status`), refetchInterval: 60_000,
  });
  const migrate = useMutation({
    mutationFn: (dryRun: boolean) =>
      fetch(`${API1}/vault/migrate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['p201-vault'] }),
  });
  const d = data as any;

  return (
    <section className="space-y-4">
      <SectionHeader title="WS1 — Credential Vault (Phase 20.1)" badge="R-P20-01" badgeColor="green" />
      {isLoading && <LoadingSpinner />}
      {error && <ErrorBox message="Failed to load vault status" />}
      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Migration"    value={d.fullyMigrated ? 'Complete' : 'Pending'} color={d.fullyMigrated ? 'green' : 'yellow'} />
            <StatCard label="Encrypted"    value={d.totalEncrypted ?? 0} color="green" sub="tokens" />
            <StatCard label="Plaintext"    value={d.totalPlaintext ?? 0} color={d.totalPlaintext > 0 ? 'red' : 'gray'} sub="tokens remaining" />
            <StatCard label="Algorithm"    value="AES-256-GCM" color="blue" sub="per-token IV+tag" />
          </div>
          {d.tables && (
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead><tr>{['Table','Column','Encrypted','Plaintext','Progress'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {d.tables.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-800/30">
                      <Td mono>{t.table}</Td>
                      <Td mono>{t.field}</Td>
                      <Td>{t.encrypted ?? 0}</Td>
                      <Td><Badge label={String(t.plaintext ?? 0)} color={t.plaintext > 0 ? 'red' : 'gray'} /></Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${t.migrationPct ?? (t.plaintext === 0 ? 100 : 0)}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{t.migrationPct ?? (t.plaintext === 0 ? 100 : 0)}%</span>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => migrate.mutate(true)}
              className="px-3 py-1.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50"
              disabled={migrate.isPending}>
              {migrate.isPending ? 'Running…' : 'Dry Run'}
            </button>
            {!d.fullyMigrated && (
              <button onClick={() => migrate.mutate(false)}
                className="px-3 py-1.5 text-xs rounded bg-green-900 hover:bg-green-800 text-green-100 disabled:opacity-50"
                disabled={migrate.isPending}>
                {migrate.isPending ? 'Encrypting…' : 'Run Migration'}
              </button>
            )}
          </div>
          {migrate.data && (
            <div className={`text-sm rounded p-3 border ${(migrate.data as any).success ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-yellow-900/20 border-yellow-800 text-yellow-300'}`}>
              {(migrate.data as any).dryRun ? '[Dry Run] ' : ''}{(migrate.data as any).totalEncrypted ?? 0} tokens encrypted, {(migrate.data as any).totalSkipped ?? 0} skipped
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Phase 20.1 WS3: Governance Fail-Closed ───────────────────────────────────

function GovernanceHardeningPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['p201-gov-config'], queryFn: () => fetcher(`${API1}/governance/config`), refetchInterval: 30_000,
  });
  const { data: failLog } = useQuery({
    queryKey: ['p201-gov-failures'], queryFn: () => fetcher(`${API1}/governance/failure-log?limit=20`), refetchInterval: 30_000,
  });
  const d = data as any;
  const log = (failLog as any[]) || [];

  return (
    <section className="space-y-4">
      <SectionHeader title="WS3 — Governance Hardening (Phase 20.1)" badge="R-P20-07" badgeColor={d?.failOpen ? 'red' : 'green'} />
      {isLoading && <LoadingSpinner />}
      {d && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Mode"         value={d.mode}       color={d.failOpen ? 'red' : 'green'} sub={d.failOpen ? '⚠ allow on failure' : '✓ deny on failure'} />
          <StatCard label="Env Var"      value={d.envVar}     color="blue" sub={`value: "${d.currentValue}"`} />
          <StatCard label="Gov Failures" value={log.length}   color={log.length > 0 ? 'yellow' : 'gray'} sub="last 24h" />
        </div>
      )}
      {d?.failOpen && (
        <div className="bg-red-900/20 border border-red-700 rounded p-3 text-red-300 text-sm">
          ⚠ AGENT_GOVERNANCE_FAIL_OPEN=true — governance failures will allow tasks. Remove this for production.
        </div>
      )}
      {log.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead><tr>{['Agent','Task Type','Reason','Fail-Open','Time'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {log.slice(0, 10).map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <Td mono>{row.agent_id?.slice(0, 12)}…</Td>
                  <Td>{row.task_type}</Td>
                  <Td>{row.failure_reason?.slice(0, 60)}</Td>
                  <Td><Badge label={row.fail_open ? 'OPEN' : 'CLOSED'} color={row.fail_open ? 'red' : 'green'} /></Td>
                  <Td mono>{new Date(row.logged_at).toLocaleTimeString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Phase 20.1 WS4: Trust Score Guard ────────────────────────────────────────

function TrustScoreGuardPanel() {
  const qc = useQueryClient();
  const { data: approvals } = useQuery({
    queryKey: ['p201-approvals'], queryFn: () => fetcher(`${API1}/trust/approvals?status=pending`), refetchInterval: 30_000,
  });
  const { data: auditLog } = useQuery({
    queryKey: ['p201-trust-audit'], queryFn: () => fetcher(`${API1}/trust/audit-log?limit=30&hours=24`), refetchInterval: 30_000,
  });

  const approve = useMutation({
    mutationFn: ({ approvalId, approvedBy }: { approvalId: string; approvedBy: string }) =>
      fetch(`${API1}/trust/approvals/${approvalId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvedBy }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['p201-approvals'] });
      qc.invalidateQueries({ queryKey: ['p201-trust-audit'] });
    },
  });

  const pending  = (approvals as any[]) || [];
  const auditRows = (auditLog as any[]) || [];
  const rateLimited = auditRows.filter((r: any) => r.status === 'rate_limited');
  const anomalies   = auditRows.filter((r: any) => r.anomaly_detected);

  return (
    <section className="space-y-4">
      <SectionHeader title="WS4 — Trust Score Guard (Phase 20.1)" badge="R-P20-03" badgeColor={pending.length > 0 ? 'yellow' : 'green'} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pending Approvals" value={pending.length}    color={pending.length > 0 ? 'yellow' : 'gray'} />
        <StatCard label="Audit Records"     value={auditRows.length}  color="blue"   sub="last 24h" />
        <StatCard label="Rate Limited"      value={rateLimited.length} color={rateLimited.length > 0 ? 'orange' : 'gray'} />
        <StatCard label="Anomalies"         value={anomalies.length}  color={anomalies.length > 0 ? 'red' : 'gray'} />
      </div>
      {pending.length > 0 && (
        <div>
          <div className="text-sm text-gray-400 mb-2 font-medium">Pending Trust Score Approvals</div>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead><tr>{['Agent','Delta','Reason','Requested By','Action'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {pending.map((row: any) => (
                  <tr key={row.approval_id} className="hover:bg-gray-800/30">
                    <Td mono>{row.agent_id?.slice(0, 12)}…</Td>
                    <Td><span className="text-yellow-300 font-medium">+{row.delta}</span></Td>
                    <Td>{row.reason}</Td>
                    <Td>{row.requested_by}</Td>
                    <Td>
                      <button onClick={() => approve.mutate({ approvalId: row.approval_id, approvedBy: 'admin' })}
                        className="px-2 py-1 text-xs rounded bg-green-900 hover:bg-green-800 text-green-100"
                        disabled={approve.isPending}>
                        Approve
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {auditRows.length > 0 && (
        <div>
          <div className="text-sm text-gray-400 mb-2 font-medium">Trust Score Audit Log</div>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead><tr>{['Agent','Delta','Status','Reason','Anomaly','Time'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {auditRows.slice(0, 15).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-800/30">
                    <Td mono>{row.agent_id?.slice(0, 12)}…</Td>
                    <Td><span className={row.delta >= 0 ? 'text-green-400' : 'text-red-400'}>{row.delta >= 0 ? '+' : ''}{row.delta}</span></Td>
                    <Td><Badge label={row.status} color={row.status === 'applied' ? 'green' : row.status === 'rate_limited' ? 'orange' : 'yellow'} /></Td>
                    <Td>{row.reason?.slice(0, 40)}</Td>
                    <Td>{row.anomaly_detected ? <Badge label="⚠ Anomaly" color="red" /> : <span className="text-gray-600">—</span>}</Td>
                    <Td mono>{new Date(row.logged_at).toLocaleTimeString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Phase 20.1 WS6: Scheduler Health ─────────────────────────────────────────

function SchedulerHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['p201-sched-health'], queryFn: () => fetcher(`${API1}/scheduler/health`), refetchInterval: 15_000,
  });
  const { data: healthLog } = useQuery({
    queryKey: ['p201-sched-health-log'], queryFn: () => fetcher(`${API1}/scheduler/health-log?limit=20`), refetchInterval: 30_000,
  });

  const d = data as any;
  const log = (healthLog as any[]) || [];

  return (
    <section className="space-y-4">
      <SectionHeader title="WS6 — Scheduler Health (Phase 20.1)" badge="R-P20-05" badgeColor={d?.state === 'healthy' ? 'green' : d?.state === 'degraded' ? 'yellow' : 'red'} />
      {isLoading && <LoadingSpinner />}
      {d && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Health State"  value={d.state ?? '—'} color={d.state === 'healthy' ? 'green' : d.state === 'degraded' ? 'yellow' : 'red'} />
          <StatCard label="Initialized"   value={d.initialized ? 'Yes' : 'No'} color={d.initialized ? 'green' : 'yellow'} />
          <StatCard label="Dep Check"     value={d.depCheck?.passed ? 'Passed' : d.depCheck?.checked ? 'Failed' : 'Not Run'} color={d.depCheck?.passed ? 'green' : d.depCheck?.checked ? 'red' : 'gray'} />
          <StatCard label="Events"        value={log.length} sub="last 24h" color="blue" />
        </div>
      )}
      {d?.degradedSince && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded p-3 text-yellow-300 text-sm">
          Degraded since {new Date(d.degradedSince).toLocaleString()}
        </div>
      )}
      {d?.depCheck?.missing?.length > 0 && (
        <div className="bg-red-900/20 border border-red-700 rounded p-3 text-red-300 text-sm">
          Missing cycles: {d.depCheck.missing.join(', ')}
        </div>
      )}
      {log.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead><tr>{['State','Event','Detail','Time'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {log.slice(0, 10).map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <Td><Badge label={row.state} color={row.state === 'healthy' ? 'green' : row.state === 'degraded' ? 'yellow' : 'red'} /></Td>
                  <Td>{row.event_type}</Td>
                  <Td>{row.detail?.slice(0, 60)}</Td>
                  <Td mono>{new Date(row.logged_at).toLocaleTimeString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Phase 20.1 WS7: Schema Integrity ─────────────────────────────────────────

function SchemaIntegrityPanel() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['p201-schema'], queryFn: () => fetcher(`${API1}/schema/integrity`), refetchInterval: 300_000,
  });
  const d = data as any;

  return (
    <section className="space-y-4">
      <SectionHeader title="WS7 — Schema Integrity (Phase 20.1)" badge="R-P20-11" badgeColor={d?.passed ? 'green' : d ? 'red' : 'gray'} />
      {isLoading && <LoadingSpinner />}
      {error && <ErrorBox message="Failed to run schema integrity check" />}
      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Status"        value={d.passed ? 'Passed' : 'Failed'} color={d.passed ? 'green' : 'red'} />
            <StatCard label="Tables"        value={d.checks?.totalTablesFound ?? 0} color="blue"   sub="in schema" />
            <StatCard label="Errors"        value={d.errors?.length ?? 0}           color={d.errors?.length > 0 ? 'red' : 'gray'} />
            <StatCard label="Warnings"      value={d.warnings?.length ?? 0}         color={d.warnings?.length > 0 ? 'yellow' : 'gray'} />
          </div>
          {d.errors?.length > 0 && (
            <div className="bg-red-900/20 border border-red-700 rounded p-3 space-y-1">
              {d.errors.map((e: string, i: number) => <div key={i} className="text-red-300 text-sm">✗ {e}</div>)}
            </div>
          )}
          {d.warnings?.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded p-3 space-y-1">
              {d.warnings.map((w: string, i: number) => <div key={i} className="text-yellow-300 text-sm">⚠ {w}</div>)}
            </div>
          )}
          {d.recommendations?.length > 0 && (
            <div className="bg-blue-900/20 border border-blue-700 rounded p-3 space-y-1">
              {d.recommendations.map((r: string, i: number) => <div key={i} className="text-blue-300 text-sm">→ {r}</div>)}
            </div>
          )}
          {d.checks?.vaultMigration && (
            <div className="text-sm text-gray-400">
              Vault migration: {d.checks.vaultMigration.fullyMigrated ? (
                <Badge label="Fully Migrated" color="green" />
              ) : (
                <Badge label={`${d.checks.vaultMigration.plaintextCount} plaintext remaining`} color="yellow" />
              )}
            </div>
          )}
          <button onClick={() => qc.invalidateQueries({ queryKey: ['p201-schema'] })}
            className="px-3 py-1.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-200">
            Re-run Check
          </button>
        </>
      )}
    </section>
  );
}

// ── WS7: Multi-Agent Foundation (from Phase 20) ───────────────────────────────

function MultiAgentPanel() {
  const { data: stats }   = useQuery({ queryKey: ['p20-reg-stats'], queryFn: () => fetcher(`${API}/ws7/agents/stats/registry`), refetchInterval: 30_000 });
  const { data: routing } = useQuery({ queryKey: ['p20-routing'],   queryFn: () => fetcher(`${API}/ws7/tasks/routing-stats`),    refetchInterval: 30_000 });
  const { data: bus }     = useQuery({ queryKey: ['p20-bus'],       queryFn: () => fetcher(`${API}/ws7/bus/stats`),               refetchInterval: 15_000 });
  const rows   = (stats   as any[]) || [];
  const rrows  = (routing as any[]) || [];
  const b      = bus as any;

  const totalActive = rows.reduce((s: number, r: any) => s + (r.status === 'active' ? parseInt(r.count) : 0), 0);

  return (
    <section className="space-y-4">
      <SectionHeader title="WS7 — Multi-Agent Foundation" badge="Phase 20" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Agents" value={totalActive}               color="green" />
        <StatCard label="Bus Backend"   value={b?.backend ?? '—'}         color={b?.redisEnabled ? 'purple' : 'blue'} sub={b?.redisHealthy === false ? 'unhealthy' : b?.redisEnabled ? 'multi-pod' : 'single-pod'} />
        <StatCard label="Channels"      value={b?.totalChannels ?? 0}     color="blue" />
        <StatCard label="Pending Replies" value={b?.pendingReplies ?? 0}  color={b?.pendingReplies > 10 ? 'yellow' : 'gray'} />
      </div>
      {!b?.redisEnabled && (
        <div className="bg-blue-900/20 border border-blue-700 rounded p-3 text-blue-300 text-sm">
          ℹ Agent bus running in memory mode (single-pod). Set AGENT_BUS_BACKEND=redis for multi-pod.
        </div>
      )}
      {rrows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead><tr>{['Type','Pending','Running','Completed','Failed','Avg Latency'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {rrows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <Td><Badge label={r.agent_type} color="purple" /></Td>
                  <Td>{r.pending}</Td>
                  <Td>{r.running}</Td>
                  <Td>{r.completed}</Td>
                  <Td>{r.failed}</Td>
                  <Td>{r.avg_duration_ms ? `${r.avg_duration_ms}ms` : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── WS8: Governance (from Phase 20) ──────────────────────────────────────────

function GovernancePanel() {
  const { data: scores }     = useQuery({ queryKey: ['p20-trust'],    queryFn: () => fetcher(`${API}/ws8/governance/trust-scores?limit=20`), refetchInterval: 30_000 });
  const { data: violations } = useQuery({ queryKey: ['p20-boundary'], queryFn: () => fetcher(`${API}/ws8/governance/boundary-violations`),   refetchInterval: 30_000 });
  const scoreRows = (scores as any[]) || [];
  const vRows     = (violations as any[]) || [];

  return (
    <section className="space-y-4">
      <SectionHeader title="WS8 — Agent Governance" badge="Phase 20" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Low Trust Agents" value={scoreRows.filter((r: any) => parseFloat(r.current_score) < 70).length} color="red" />
        <StatCard label="Boundary Violations" value={vRows.length} color={vRows.length > 0 ? 'orange' : 'gray'} sub="24h" />
      </div>
      {scoreRows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead><tr>{['Agent','Score','Total Exec','Failed Exec','Last Updated'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {scoreRows.slice(0, 10).map((r: any, i: number) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <Td mono>{r.agent_id?.slice(0, 14)}…</Td>
                  <Td>
                    <span className={parseFloat(r.current_score) >= 80 ? 'text-green-400' : parseFloat(r.current_score) >= 60 ? 'text-yellow-400' : 'text-red-400'}>
                      {parseFloat(r.current_score).toFixed(1)}
                    </span>
                  </Td>
                  <Td>{r.total_executions ?? 0}</Td>
                  <Td>{r.failed_executions ?? 0}</Td>
                  <Td mono>{r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── WS9: Observability Summary ────────────────────────────────────────────────

function ObservabilityPanel() {
  const { data } = useQuery({ queryKey: ['p20-obs'], queryFn: () => fetcher(`${API}/ws9/observability/summary`), refetchInterval: 30_000 });
  const d = data as any;

  return (
    <section className="space-y-4">
      <SectionHeader title="WS9 — Observability" badge="Phase 20" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Agents"  value={d?.agents?.active ?? 0} color="green" />
        <StatCard label="Fed Critical"   value={d?.federation?.critical ?? 0} color={d?.federation?.critical > 0 ? 'red' : 'gray'} />
        <StatCard label="Integ Critical" value={d?.integrations?.critical ?? 0} color={d?.integrations?.critical > 0 ? 'red' : 'gray'} />
        <StatCard label="Security High"  value={d?.security?.high_unresolved ?? 0} color={d?.security?.high_unresolved > 0 ? 'orange' : 'gray'} sub="unresolved" />
      </div>
    </section>
  );
}

// ── Tab navigation ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'reliability',     label: 'Reliability',      panel: ReliabilityPanel,       badge: 'WS1' },
  { id: 'vault',           label: 'Credential Vault',  panel: CredentialVaultPanel,   badge: '20.1' },
  { id: 'governance',      label: 'Gov. Hardening',   panel: GovernanceHardeningPanel, badge: '20.1' },
  { id: 'trust-guard',     label: 'Trust Guard',      panel: TrustScoreGuardPanel,   badge: '20.1' },
  { id: 'sched-health',    label: 'Sched. Health',    panel: SchedulerHealthPanel,   badge: '20.1' },
  { id: 'schema',          label: 'Schema',           panel: SchemaIntegrityPanel,   badge: '20.1' },
  { id: 'multi-agent',     label: 'Multi-Agent',      panel: MultiAgentPanel,        badge: 'WS7' },
  { id: 'gov-base',        label: 'Governance',       panel: GovernancePanel,        badge: 'WS8' },
  { id: 'observability',   label: 'Observability',    panel: ObservabilityPanel,     badge: 'WS9' },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function Phase20OpsCenter() {
  const [activeTab, setActiveTab] = useState('reliability');
  const { data: status } = useQuery({
    queryKey: ['p20-status'], queryFn: () => fetcher(`${API}/status`), refetchInterval: 60_000,
  });
  const s = status as any;

  const activeEntry = TABS.find(t => t.id === activeTab);
  const ActivePanel = activeEntry?.panel;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Phase 20.1 Ops Center</h1>
          <p className="text-gray-500 text-sm mt-1">Enterprise Stabilization & Risk Elimination — Multi-Agent Foundation</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Badge label={`v${s?.version ?? '20.1.0'}`} color="blue" />
          <Badge label="Phase 20.1" color="purple" />
          {s?.workstreams?.ws7_multi_agent?.agents && (
            <Badge label={`Registry stats loaded`} color="green" />
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-800 pb-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1 rounded ${tab.badge.includes('20.1') ? 'bg-purple-800 text-purple-200' : 'bg-gray-700 text-gray-300'}`}>
              {tab.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div className="space-y-6">
        {ActivePanel && <ActivePanel />}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800 pt-4 text-xs text-gray-600 flex justify-between">
        <span>AutoFlowNG Phase 20.1 — Enterprise Stabilization</span>
        <span>Risks Closed: R-P20-01 through R-P20-11</span>
      </div>
    </div>
  );
}
