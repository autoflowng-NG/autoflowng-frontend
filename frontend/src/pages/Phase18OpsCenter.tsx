import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Shield, Zap, Database, Activity, Clock, Server } from "lucide-react";

const API = "/api/phase18";

function useFetch(path: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [path],
    queryFn: async () => {
      const r = await fetch(path);
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    refetchInterval: 15000,
    enabled: opts?.enabled !== false,
  });
}

// ── Production Readiness Panel ───────────────────────────────────────────────
function ProductionReadinessDashboard() {
  const { data, isLoading, refetch } = useFetch(`${API}/readiness`);

  const scoreColor = (v: number) =>
    v >= 0.8 ? "text-emerald-400" : v >= 0.5 ? "text-amber-400" : "text-red-400";

  const gates = data?.scores ?? {};
  const gateLabels: Record<string, string> = {
    schedulerDistributed: "Distributed Scheduler",
    checkpointCoverage: "Checkpoint Coverage",
    retentionActive: "Retention Active",
    federationPlanned: "Federation Planned",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Production Readiness Score</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-8 text-center">Calculating readiness…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-900/60 border-slate-700">
            <CardContent className="pt-6 flex flex-col items-center">
              <div className={`text-6xl font-bold ${scoreColor(data?.score ?? 0)}`}>
                {Math.round((data?.score ?? 0) * 100)}%
              </div>
              <div className="mt-2 text-slate-400 text-sm">Overall Score</div>
              <Badge className={`mt-3 ${data?.ready ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                {data?.ready ? "PRODUCTION READY" : "NOT READY"}
              </Badge>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Readiness Gates</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(gates).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">{gateLabels[key] ?? key}</span>
                  {(val as number) >= 0.8
                    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                    : (val as number) >= 0.4
                    ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Checkpoint Coverage ───────────────────────────────────────────────────────
function CheckpointCoverageDashboard() {
  const { data, isLoading, refetch } = useFetch(`${API}/checkpoints/coverage`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Checkpoint Coverage</h3>
        <div className="flex items-center gap-3">
          {data && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{data.coveragePct}% covered</Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
        </div>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-8 text-center">Loading coverage data…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(data?.supportedNodeTypes ?? []).map((nt: string) => {
              const row = data?.byNodeType?.find((r: any) => r.node_type === nt);
              const covered = !!row;
              return (
                <Card key={nt} className={`bg-slate-900/60 border ${covered ? "border-emerald-700/40" : "border-red-700/40"}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-slate-300">{nt}</span>
                      {covered ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                    {row && (
                      <div className="mt-1 text-xs text-slate-500">{row.total_checkpoints} checkpoints</div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {data?.missingNodeTypes?.length > 0 && (
            <Card className="bg-amber-900/20 border-amber-700/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Missing coverage: {data.missingNodeTypes.join(", ")}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Autonomous Effectiveness ───────────────────────────────────────────────────
function AutonomousEffectivenessDashboard() {
  const { data: stats, isLoading } = useFetch(`${API}/outcomes/stats`);
  const { data: recent } = useFetch(`${API}/outcomes/recent`);

  const engines = ["scaling", "failover", "recovery", "migration"];
  const engineColors: Record<string, string> = {
    scaling: "blue", failover: "purple", recovery: "emerald", migration: "amber",
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Autonomous Effectiveness</h3>
      {isLoading ? (
        <div className="text-slate-400 py-8 text-center">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {engines.map(eng => {
            const rows = (stats?.byEngineOutcome ?? []).filter((r: any) => r.source_engine === eng);
            const success = rows.find((r: any) => r.outcome === "success")?.count ?? 0;
            const failure = rows.find((r: any) => r.outcome === "failure")?.count ?? 0;
            const total   = success + failure;
            const rate    = total > 0 ? Math.round((success / total) * 100) : null;
            const col     = engineColors[eng];
            return (
              <Card key={eng} className="bg-slate-900/60 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize text-slate-300 flex items-center gap-2">
                    <Zap className={`w-4 h-4 text-${col}-400`} />{eng} Engine
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rate !== null ? (
                    <>
                      <div className={`text-3xl font-bold text-${col}-400`}>{rate}%</div>
                      <div className="text-xs text-slate-500 mt-1">{success} success / {failure} failure (last 24h)</div>
                      <Progress value={rate} className="mt-2 h-1" />
                    </>
                  ) : (
                    <div className="text-slate-500 text-sm">No outcomes recorded yet</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Separator className="border-slate-700" />
      <h4 className="text-sm font-medium text-slate-400">Recent Outcome Events</h4>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {(recent ?? []).slice(0, 20).map((ev: any) => (
          <div key={ev.id} className="flex items-center gap-2 text-xs text-slate-400 py-1 border-b border-slate-800">
            <Badge className={`text-xs py-0 ${ev.outcome === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{ev.outcome}</Badge>
            <span className="text-slate-500">{ev.source_engine}</span>
            <span className="ml-auto text-slate-600">{new Date(ev.wired_at).toLocaleTimeString()}</span>
          </div>
        ))}
        {(!recent || recent.length === 0) && <div className="text-slate-500 text-xs py-2">No outcome events yet</div>}
      </div>
    </div>
  );
}

// ── Scheduler Leader Dashboard ────────────────────────────────────────────────
function SchedulerLeaderDashboard() {
  const { data, isLoading, refetch } = useFetch(`${API}/scheduler/status`);
  const { data: history } = useFetch(`${API}/scheduler/history`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Distributed Scheduler Leader</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-8 text-center">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader><CardTitle className="text-sm text-slate-300">Current Leader</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                <span className="font-mono text-sm text-white">{data?.current?.holder_id ?? data?.holderId ?? "—"}</span>
              </div>
              <div className="text-xs text-slate-500">Backend: <span className="text-slate-300">{data?.current?.backend ?? data?.backend ?? "—"}</span></div>
              <div className="text-xs text-slate-500">Host: <span className="text-slate-300">{data?.current?.holder_host ?? "—"}</span></div>
              {data?.current?.renewed_at && (
                <div className="text-xs text-slate-500">Last heartbeat: <span className="text-slate-300">{new Date(data.current.renewed_at).toLocaleTimeString()}</span></div>
              )}
              <Badge className={data?.isLeader ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-700 text-slate-400"}>
                {data?.isLeader ? "THIS POD IS LEADER" : "FOLLOWER"}
              </Badge>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader><CardTitle className="text-sm text-slate-300">Lease Config</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-400">
              <div>Lease key: <span className="font-mono text-slate-300">{data?.leaseKey ?? "—"}</span></div>
              <div>TTL: <span className="text-slate-300">{data?.leaseTtlS ?? "—"}s</span></div>
            </CardContent>
          </Card>
        </div>
      )}
      <h4 className="text-sm font-medium text-slate-400 mt-2">Lease History</h4>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {(history ?? []).slice(0, 15).map((row: any) => (
          <div key={row.id} className="flex items-center gap-2 text-xs text-slate-400 py-1 border-b border-slate-800">
            <span className="font-mono text-slate-300">{row.holder_id}</span>
            <Badge className="text-xs py-0 bg-slate-800 text-slate-400">{row.backend}</Badge>
            <span className="ml-auto text-slate-600">{new Date(row.renewed_at).toLocaleTimeString()}</span>
          </div>
        ))}
        {(!history || history.length === 0) && <div className="text-slate-500 text-xs py-2">No lease history</div>}
      </div>
    </div>
  );
}

// ── Federation Execution Dashboard ────────────────────────────────────────────
function FederationExecutionDashboard() {
  const qc = useQueryClient();
  const { data: plans, isLoading, refetch } = useFetch(`${API}/federation/plans`);

  const createPlan = useMutation({
    mutationFn: async (mode: string) => {
      const r = await fetch(`${API}/federation/plans`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`${API}/federation/plans`] }); },
  });

  const statusColor: Record<string, string> = {
    draft: "text-slate-400", validated: "text-blue-400", approved: "text-purple-400",
    executing: "text-amber-400", completed: "text-emerald-400", rolled_back: "text-orange-400", failed: "text-red-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Federation Execution</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => createPlan.mutate("dry_run")} disabled={createPlan.isPending}>
            + Dry Run Plan
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-8 text-center">Loading federation plans…</div>
      ) : (
        <div className="space-y-2">
          {(plans ?? []).map((p: any) => (
            <Card key={p.plan_id} className="bg-slate-900/60 border-slate-700">
              <CardContent className="pt-3 pb-3 flex items-center gap-3">
                <Database className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-slate-300 truncate">{p.plan_id}</div>
                  <div className="text-xs text-slate-500">{p.mode} · {new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`text-xs font-medium ${statusColor[p.status] ?? "text-slate-400"}`}>{p.status.toUpperCase()}</span>
              </CardContent>
            </Card>
          ))}
          {(!plans || plans.length === 0) && (
            <div className="text-slate-500 text-sm py-6 text-center">No federation plans yet. Create a dry run to start.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Retention Dashboard ────────────────────────────────────────────────────────
function RetentionDashboard() {
  const qc = useQueryClient();
  const { data: stats, isLoading } = useFetch(`${API}/retention/stats`);

  const runSweep = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/retention/sweep`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`${API}/retention/stats`] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Retention & Lifecycle</h3>
        <Button variant="outline" size="sm" onClick={() => runSweep.mutate()} disabled={runSweep.isPending}>
          {runSweep.isPending ? "Sweeping…" : "Run Retention Sweep"}
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-8 text-center">Loading retention data…</div>
      ) : (
        <div className="space-y-2">
          {(stats?.tables ?? []).map((t: any) => (
            <Card key={t.table_name} className="bg-slate-900/60 border-slate-700">
              <CardContent className="pt-3 pb-3 flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-mono text-xs text-slate-300">{t.table_name}</div>
                  <div className="text-xs text-slate-500">Retain {t.retention_days}d · {t.last7Days?.total_deleted ?? 0} deleted (7d)</div>
                </div>
                <Badge className={t.enabled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-700 text-slate-500"}>
                  {t.enabled ? "active" : "disabled"}
                </Badge>
              </CardContent>
            </Card>
          ))}
          {(!stats?.tables || stats.tables.length === 0) && (
            <div className="text-slate-500 text-sm py-6 text-center">No retention configuration found. Run schema migration first.</div>
          )}
        </div>
      )}
      {runSweep.data && (
        <Card className="bg-emerald-900/20 border-emerald-700/30">
          <CardContent className="pt-3">
            <div className="text-xs text-emerald-400">
              Sweep {runSweep.data.sweepId}: {runSweep.data.totalDeleted} rows deleted in {runSweep.data.durationMs}ms
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Phase18OpsCenter() {
  const { data: status } = useFetch(`${API}/status`);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">PHASE 18</Badge>
          </div>
          <h1 className="text-3xl font-bold text-white">Production Autonomous OS</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Distributed Orchestration · Universal Checkpointing · Autonomous Outcome Learning ·
            Federation Execution · Production Chaos · Retention Management
          </p>
          {status && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <Badge className="bg-slate-800 text-slate-300">{status.workstreams} workstreams</Badge>
              {status.scheduler && (
                <Badge className={status.scheduler.isLeader ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-slate-700 text-slate-400"}>
                  Scheduler: {status.scheduler.isLeader ? "LEADER" : "FOLLOWER"}
                </Badge>
              )}
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="readiness">
          <TabsList className="bg-slate-900 border border-slate-700 mb-6 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="readiness" className="data-[state=active]:bg-slate-700">
              <Shield className="w-3.5 h-3.5 mr-1.5" />Readiness
            </TabsTrigger>
            <TabsTrigger value="checkpoints" className="data-[state=active]:bg-slate-700">
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Checkpoints
            </TabsTrigger>
            <TabsTrigger value="effectiveness" className="data-[state=active]:bg-slate-700">
              <Activity className="w-3.5 h-3.5 mr-1.5" />Effectiveness
            </TabsTrigger>
            <TabsTrigger value="scheduler" className="data-[state=active]:bg-slate-700">
              <Server className="w-3.5 h-3.5 mr-1.5" />Scheduler
            </TabsTrigger>
            <TabsTrigger value="federation" className="data-[state=active]:bg-slate-700">
              <Database className="w-3.5 h-3.5 mr-1.5" />Federation
            </TabsTrigger>
            <TabsTrigger value="retention" className="data-[state=active]:bg-slate-700">
              <Clock className="w-3.5 h-3.5 mr-1.5" />Retention
            </TabsTrigger>
          </TabsList>

          <TabsContent value="readiness">
            <Card className="bg-slate-900/40 border-slate-700">
              <CardContent className="pt-6"><ProductionReadinessDashboard /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="checkpoints">
            <Card className="bg-slate-900/40 border-slate-700">
              <CardContent className="pt-6"><CheckpointCoverageDashboard /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="effectiveness">
            <Card className="bg-slate-900/40 border-slate-700">
              <CardContent className="pt-6"><AutonomousEffectivenessDashboard /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="scheduler">
            <Card className="bg-slate-900/40 border-slate-700">
              <CardContent className="pt-6"><SchedulerLeaderDashboard /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="federation">
            <Card className="bg-slate-900/40 border-slate-700">
              <CardContent className="pt-6"><FederationExecutionDashboard /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="retention">
            <Card className="bg-slate-900/40 border-slate-700">
              <CardContent className="pt-6"><RetentionDashboard /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
