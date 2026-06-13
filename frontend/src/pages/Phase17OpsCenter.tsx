/**
 * Phase17OpsCenter.tsx — Phase 17
 *
 * Operator console for the Self-Improving Autonomous Orchestration OS.
 * Seven dashboards (one tab each) layered over the Phase 16 Ops Center:
 *
 *   1. Checkpoint Intelligence
 *   2. Migration Intelligence
 *   3. Autonomous Learning
 *   4. Governance
 *   5. Federation Readiness
 *   6. Chaos Testing
 *   7. Decision Quality
 *
 * All panels are read-only by default; mutating actions require platform-admin.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Brain, Database, GitMerge, ShieldCheck, Network, Bug, Gauge,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity, Play, StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number | string | null | undefined, d = 2) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toFixed(d);
const pct = (n: number | string | null | undefined) =>
  n == null ? "—" : `${(Number(n) * 100).toFixed(1)}%`;
const ago = (iso?: string) => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
};

const scoreBadge = (s?: number) => {
  if (s == null) return <Badge variant="outline">—</Badge>;
  const cls =
    s >= 0.85 ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/40" :
    s >= 0.6  ? "bg-amber-500/20 text-amber-700 border-amber-500/40"       :
                "bg-rose-500/20 text-rose-700 border-rose-500/40";
  return <Badge variant="outline" className={cls}>{(s * 100).toFixed(0)}%</Badge>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Checkpoint Intelligence
// ─────────────────────────────────────────────────────────────────────────────
function CheckpointTab() {
  const qc = useQueryClient();
  const summary = useQuery({
    queryKey: ["p17", "chkpt", "summary"],
    queryFn: async () => (await api.get("/api/phase17/checkpoints/summary")).data,
    refetchInterval: 15_000,
  });
  const coverage = useQuery({
    queryKey: ["p17", "chkpt", "coverage"],
    queryFn: async () => (await api.get("/api/phase17/checkpoints/coverage")).data,
  });
  const audit = useMutation({
    mutationFn: async () => (await api.post("/api/phase17/checkpoints/audit")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p17", "chkpt"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Checkpoint Intelligence</h2>
          <p className="text-sm text-slate-500">
            Per-node-type checkpoint volume, compression, and integrity audit.
          </p>
        </div>
        <Button onClick={() => audit.mutate()} disabled={audit.isPending}>
          {audit.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Run integrity audit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supported node types</CardTitle>
          <CardDescription>Workstream 1 — universal coverage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(coverage.data?.supportedNodeTypes || []).map((t: string) => (
              <Badge key={t} variant="outline" className="bg-slate-500/10">{t}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>24h checkpoint volume</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th>Node type</th><th>Count</th><th>Compressed</th><th>Bytes</th></tr>
            </thead>
            <tbody>
              {(summary.data?.rows || []).map((r: any) => (
                <tr key={r.node_type} className="border-t">
                  <td className="py-2">{r.node_type || "—"}</td>
                  <td>{r.count}</td>
                  <td>{r.compressed}</td>
                  <td>{r.bytes ?? "—"}</td>
                </tr>
              ))}
              {!summary.data?.rows?.length && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-500">No checkpoints in window.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {audit.data && (
        <Card>
          <CardHeader><CardTitle>Last audit</CardTitle></CardHeader>
          <CardContent className="text-sm">
            Audited <b>{audit.data.audited}</b> · OK <b className="text-emerald-600">{audit.data.ok}</b> · Failed <b className="text-rose-600">{audit.data.failed}</b>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Migration Intelligence
// ─────────────────────────────────────────────────────────────────────────────
function MigrationTab() {
  const [executionId, setExecutionId] = useState("");
  const [kind, setKind] = useState("worker");
  const confidence = useQuery({
    queryKey: ["p17", "mig", "conf", executionId, kind],
    queryFn: async () => (await api.get(`/api/phase17/migrations/v2/confidence?executionId=${executionId}&kind=${kind}`)).data,
    enabled: !!executionId,
  });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Migration Intelligence</h2>
        <p className="text-sm text-slate-500">
          Pre-flight confidence scoring, retries, rollback, and per-attempt health.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Score a migration</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <input
              className="border rounded px-3 py-2 text-sm flex-1 min-w-[240px]"
              placeholder="execution-id"
              value={executionId}
              onChange={e => setExecutionId(e.target.value)}
            />
            <select className="border rounded px-3 py-2 text-sm"
              value={kind} onChange={e => setKind(e.target.value)}>
              <option>worker</option><option>node</option><option>region</option><option>failover</option>
            </select>
          </div>
          {confidence.data && (
            <div className="text-sm">
              Confidence: {scoreBadge(confidence.data.confidence)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Autonomous Learning
// ─────────────────────────────────────────────────────────────────────────────
function LearningTab() {
  const qc = useQueryClient();
  const recs = useQuery({
    queryKey: ["p17", "learn", "recs"],
    queryFn: async () => (await api.get("/api/phase17/learning/recommendations")).data,
    refetchInterval: 30_000,
  });
  const cycle = useMutation({
    mutationFn: async () => (await api.post("/api/phase17/learning/cycle")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p17", "learn"] }),
  });
  const updateStatus = useMutation({
    mutationFn: async (p: { id: number; status: string }) =>
      (await api.post(`/api/phase17/learning/recommendations/${p.id}/status`, { status: p.status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p17", "learn"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Autonomous Learning</h2>
          <p className="text-sm text-slate-500">Pattern detection · fault clustering · recommendations</p>
        </div>
        <Button onClick={() => cycle.mutate()} disabled={cycle.isPending}>
          {cycle.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
          Run learning cycle
        </Button>
      </div>
      {cycle.data && (
        <Card><CardContent className="text-sm py-4">
          Detected <b>{cycle.data.detected}</b> patterns · Recommended <b>{cycle.data.recommended}</b> actions
          (scanned {cycle.data.scanned})
        </CardContent></Card>
      )}
      <Card>
        <CardHeader><CardTitle>Open recommendations</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(recs.data?.recommendations || []).map((r: any) => (
              <div key={r.id} className="border rounded p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.category}</Badge>
                    <span className="font-medium">{r.action}</span>
                    {scoreBadge(Number(r.confidence))}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    basis: {r.basis} · {ago(r.created_at)} ago
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "adopted" })}>Adopt</Button>
                  <Button size="sm" variant="ghost"   onClick={() => updateStatus.mutate({ id: r.id, status: "dismissed" })}>Dismiss</Button>
                </div>
              </div>
            ))}
            {!recs.data?.recommendations?.length && (
              <div className="text-sm text-slate-500 text-center py-8">No open recommendations.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Governance
// ─────────────────────────────────────────────────────────────────────────────
function GovernanceTab() {
  const qc = useQueryClient();
  const policies = useQuery({
    queryKey: ["p17", "gov", "policies"],
    queryFn: async () => (await api.get("/api/phase17/governance/policies")).data,
  });
  const decisions = useQuery({
    queryKey: ["p17", "gov", "decisions"],
    queryFn: async () => (await api.get("/api/phase17/governance/decisions?limit=100")).data,
    refetchInterval: 15_000,
  });
  const reload = useMutation({
    mutationFn: async () => (await api.post("/api/phase17/governance/reload")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p17", "gov"] }),
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Governance</h2>
          <p className="text-sm text-slate-500">Environment · cluster · tenant policies · guardrails</p>
        </div>
        <Button variant="outline" onClick={() => reload.mutate()}>
          <RefreshCw className="h-4 w-4 mr-2" />Reload policies
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Policies ({policies.data?.policies?.length || 0})</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th>Scope</th><th>Category</th><th>Action</th><th>Mode</th><th>Min conf</th><th>Cap/h</th><th>Enabled</th></tr>
            </thead>
            <tbody>
              {(policies.data?.policies || []).map((p: any) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{p.scope}:{p.scope_id}</td>
                  <td>{p.category}</td><td>{p.action}</td>
                  <td><Badge variant="outline">{p.mode}</Badge></td>
                  <td>{fmt(p.min_confidence, 2)}</td>
                  <td>{p.max_per_hour}</td>
                  <td>{p.enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}</td>
                </tr>
              ))}
              {!policies.data?.policies?.length && (
                <tr><td colSpan={7} className="py-6 text-center text-slate-500">No policies yet — defaults are permissive in non-prod, advisory in prod.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent decisions</CardTitle></CardHeader>
        <CardContent className="max-h-96 overflow-auto">
          <div className="space-y-2 text-sm">
            {(decisions.data?.decisions || []).slice(0, 50).map((d: any) => (
              <div key={d.id} className="flex justify-between border-b py-1.5">
                <span>
                  <Badge variant="outline" className="mr-2">{d.outcome}</Badge>
                  {d.category}/{d.action} @ {d.scope}:{d.scope_id}
                </span>
                <span className="text-slate-500">{ago(d.created_at)} ago</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Federation Readiness
// ─────────────────────────────────────────────────────────────────────────────
function FederationTab() {
  const qc = useQueryClient();
  const readiness = useQuery({
    queryKey: ["p17", "fed", "readiness"],
    queryFn: async () => (await api.get("/api/phase17/federation/readiness")).data,
    refetchInterval: 15_000,
  });
  const validation = useQuery({
    queryKey: ["p17", "fed", "validate"],
    queryFn: async () => (await api.get("/api/phase17/federation/validate")).data,
    refetchInterval: 30_000,
  });
  const snapshot = useMutation({
    mutationFn: async () => (await api.post("/api/phase17/federation/snapshot")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p17", "fed"] }),
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Federation Readiness</h2>
          <p className="text-sm text-slate-500">Redis federation validation, health scoring, and failover planning (read-only).</p>
        </div>
        <Button onClick={() => snapshot.mutate()} disabled={snapshot.isPending}>
          {snapshot.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Network className="h-4 w-4 mr-2" />}
          Take snapshot
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="py-4">
          <div className="text-xs text-slate-500">Readiness</div>
          <div className="text-2xl font-semibold mt-1">{scoreBadge(readiness.data?.score)}</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="text-xs text-slate-500">Clusters</div>
          <div className="text-2xl font-semibold mt-1">{readiness.data?.total ?? "—"}</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="text-xs text-slate-500">Healthy</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600">{readiness.data?.healthy ?? "—"}</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="text-xs text-slate-500">Validation</div>
          <div className="mt-1">{validation.data?.ok ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <AlertTriangle className="h-6 w-6 text-amber-600" />}</div>
        </CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Issues</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {(validation.data?.issues || []).map((i: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <Badge variant="outline" className={
                  i.severity === "critical" ? "bg-rose-500/20 text-rose-700" : "bg-amber-500/20 text-amber-700"
                }>{i.severity}</Badge>
                {i.code}{i.cluster ? ` · ${i.cluster}` : ""}
              </div>
            ))}
            {!validation.data?.issues?.length && <div className="text-slate-500">No structural issues detected.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Chaos
// ─────────────────────────────────────────────────────────────────────────────
function ChaosTab() {
  const qc = useQueryClient();
  const scenarios = useQuery({
    queryKey: ["p17", "chaos", "scenarios"],
    queryFn: async () => (await api.get("/api/phase17/chaos/scenarios")).data,
  });
  const runs = useQuery({
    queryKey: ["p17", "chaos", "runs"],
    queryFn: async () => (await api.get("/api/phase17/chaos/runs?limit=50")).data,
    refetchInterval: 5_000,
  });
  const [scenario, setScenario] = useState("worker_crash");
  const [target, setTarget]     = useState("");
  const start = useMutation({
    mutationFn: async () => (await api.post("/api/phase17/chaos/runs", { scenario, target })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p17", "chaos"] }),
  });
  const end = useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/phase17/chaos/runs/${id}/end`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p17", "chaos"] }),
  });
  const allowed = scenarios.data?.allowed;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Chaos Testing</h2>
          <p className="text-sm text-slate-500">Bounded, reversible disturbance to validate autonomous response.</p>
        </div>
        <Badge variant="outline" className={allowed ? "bg-emerald-500/20 text-emerald-700" : "bg-slate-500/20"}>
          {allowed ? "enabled" : "disabled (set CHAOS_ENABLED=true)"}
        </Badge>
      </div>
      <Card>
        <CardHeader><CardTitle>Start a run</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap items-center">
            <select className="border rounded px-3 py-2 text-sm" value={scenario} onChange={e => setScenario(e.target.value)}>
              {(scenarios.data?.scenarios || []).map((s: string) => <option key={s}>{s}</option>)}
            </select>
            <input className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
              placeholder="target (worker id, cluster id, region…)" value={target} onChange={e => setTarget(e.target.value)} />
            <Button onClick={() => start.mutate()} disabled={!allowed || start.isPending}>
              <Play className="h-4 w-4 mr-2" />Start
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th>Scenario</th><th>Target</th><th>Status</th><th>MTTD</th><th>MTTR</th><th>Passed</th><th></th></tr>
            </thead>
            <tbody>
              {(runs.data?.runs || []).map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">{r.scenario}</td>
                  <td>{r.target ?? "—"}</td>
                  <td><Badge variant="outline">{r.status}</Badge></td>
                  <td>{r.mttd_ms ?? "—"}</td>
                  <td>{r.mttr_ms ?? "—"}</td>
                  <td>{r.passed === true ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                       r.passed === false ? <XCircle className="h-4 w-4 text-rose-600" /> : "—"}</td>
                  <td>{r.status === "running" && (
                    <Button size="sm" variant="ghost" onClick={() => end.mutate(r.id)}>
                      <StopCircle className="h-4 w-4 mr-1" />End
                    </Button>
                  )}</td>
                </tr>
              ))}
              {!runs.data?.runs?.length && (
                <tr><td colSpan={7} className="py-6 text-center text-slate-500">No runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Decision Quality
// ─────────────────────────────────────────────────────────────────────────────
function DecisionTab() {
  const qc = useQueryClient();
  const ranks = useQuery({
    queryKey: ["p17", "dec", "ranks"],
    queryFn: async () => (await api.get("/api/phase17/decisions/ranks")).data,
    refetchInterval: 30_000,
  });
  const summary = useQuery({
    queryKey: ["p17", "dec", "quality"],
    queryFn: async () => (await api.get("/api/phase17/decisions/quality?sinceHours=24")).data,
    refetchInterval: 30_000,
  });
  const rerank = useMutation({
    mutationFn: async () => (await api.post("/api/phase17/decisions/rerank")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["p17", "dec"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Decision Quality</h2>
          <p className="text-sm text-slate-500">Strategy ranking · retirement · calibration · adaptive selection.</p>
        </div>
        <Button onClick={() => rerank.mutate()} disabled={rerank.isPending}>
          {rerank.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Gauge className="h-4 w-4 mr-2" />}
          Re-rank now
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>24h quality summary</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th>Category</th><th>Total</th><th>OK</th><th>Fail</th><th>Avg pred conf</th><th>Avg latency</th></tr>
            </thead>
            <tbody>
              {(summary.data?.summary || []).map((s: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="py-2">{s.category}</td>
                  <td>{s.total}</td><td className="text-emerald-600">{s.ok}</td>
                  <td className="text-rose-600">{s.fail}</td>
                  <td>{fmt(s.avg_pred_conf, 2)}</td><td>{s.avg_latency_ms ?? "—"}ms</td>
                </tr>
              ))}
              {!summary.data?.summary?.length && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">No observed decisions in window.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Strategy ranks</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th>Category</th><th>Strategy</th><th>Score</th><th>Samples</th><th>Calib err</th><th>Retired</th></tr>
            </thead>
            <tbody>
              {(ranks.data?.ranks || []).map((r: any, i: number) => (
                <tr key={i} className={`border-t ${r.retired ? "opacity-60" : ""}`}>
                  <td className="py-2">{r.category}</td>
                  <td>{r.strategy}</td>
                  <td>{scoreBadge(Number(r.score))}</td>
                  <td>{r.sample_count}</td>
                  <td>{fmt(r.calibration_err, 3)}</td>
                  <td>{r.retired ? <XCircle className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</td>
                </tr>
              ))}
              {!ranks.data?.ranks?.length && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">No strategies ranked yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────
export default function Phase17OpsCenter() {
  const status = useQuery({
    queryKey: ["p17", "status"],
    queryFn: async () => (await api.get("/api/phase17/status")).data,
    refetchInterval: 30_000,
  });

  const tabs = useMemo(() => [
    { id: "checkpoint", label: "Checkpoint",  icon: Database,     el: <CheckpointTab /> },
    { id: "migration",  label: "Migration",   icon: GitMerge,     el: <MigrationTab  /> },
    { id: "learning",   label: "Learning",    icon: Brain,        el: <LearningTab   /> },
    { id: "governance", label: "Governance",  icon: ShieldCheck,  el: <GovernanceTab /> },
    { id: "federation", label: "Federation",  icon: Network,      el: <FederationTab /> },
    { id: "chaos",      label: "Chaos",       icon: Bug,          el: <ChaosTab      /> },
    { id: "decision",   label: "Decisions",   icon: Gauge,        el: <DecisionTab   /> },
  ], []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header>
          <Badge variant="outline" className="bg-indigo-500/20 text-indigo-700 border-indigo-500/40 gap-1">
            <Activity className="h-3 w-3" /> Phase 17 · Self-Improving Autonomous OS
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Phase 17 Operations Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            8 workstreams · {status.data?.chaos?.allowed ? "chaos enabled" : "chaos disabled"} ·
            generated {ago(status.data?.at)} ago
          </p>
        </header>

        <Tabs defaultValue="checkpoint" className="space-y-6">
          <TabsList className="flex flex-wrap">
            {tabs.map(t => (
              <TabsTrigger key={t.id} value={t.id} className="gap-2">
                <t.icon className="h-4 w-4" />{t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map(t => (
            <TabsContent key={t.id} value={t.id} className="mt-4">{t.el}</TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
