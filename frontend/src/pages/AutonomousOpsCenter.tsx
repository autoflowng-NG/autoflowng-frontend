/**
 * AutonomousOpsCenter.tsx — Phase 16
 *
 * Operator console for AutoFlowNG's autonomous orchestration layer.
 * Shows mode status, live decisions (scaling / failover / recovery),
 * operational memory timeline, pending approvals, in-flight execution
 * migrations, and Redis federation cluster health.
 *
 * Requires platform-admin role (enforced by /api/autonomous/* upstream).
 */
import { useMemo, useState, useEffect, useRef } from "react";
  import { useWebSocketContext } from "../contexts/WebSocketContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Activity, Zap, GitBranch, Shield, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Brain, Server, Network, Clock, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "advisory" | "approval-required" | "autonomous";
interface StatusPayload {
  phase: number;
  scaling:  { mode: Mode };
  failover: { mode: Mode };
  recovery: { mode: Mode };
  generatedAt: string;
}
interface Decision {
  category: string;
  component?: string;
  action: string;
  confidence: number;
  reason?: string;
  payload?: any;
}

const modeBadge = (mode?: Mode) => {
  const color =
    mode === "autonomous"        ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/40" :
    mode === "approval-required" ? "bg-amber-500/20 text-amber-700 border-amber-500/40"       :
                                   "bg-slate-500/20 text-slate-700 border-slate-500/40";
  return <Badge variant="outline" className={color}>{mode ?? "—"}</Badge>;
};
const conf = (c: number) =>
  c >= 0.85 ? "text-emerald-600" :
  c >= 0.6  ? "text-amber-600"   : "text-slate-500";

export default function AutonomousOpsCenter() {

    const { subscribe } = useWebSocketContext();
    const activeGoalRef = useRef<string | null>(null);

    // Wire goal:complete and agent:progress WebSocket events
    useEffect(() => {
      const unsubGoal = subscribe('goal:complete', (event: any) => {
        if (activeGoalRef.current && event.goalId !== activeGoalRef.current) return;
        queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
      });

      const unsubProgress = subscribe('agent:progress', (event: any) => {
        if (activeGoalRef.current && event.goalId !== activeGoalRef.current) return;
        queryClient.invalidateQueries({ queryKey: ['autonomous-decisions'] });
      });

      return () => { unsubGoal(); unsubProgress(); };
    }, []);

  
  const qc = useQueryClient();
  const [tab, setTab] = useState("decisions");

  const statusQ = useQuery<StatusPayload>({
    queryKey: ["autonomous", "status"],
    queryFn:  async () => (await api.get("/api/autonomous/status")).data,
    refetchInterval: 15_000,
  });

  const decisionsQ = useQuery({
    queryKey: ["autonomous", "decisions"],
    queryFn:  async () => (await api.get("/api/autonomous/decisions")).data as {
      decisions: Decision[]; recommendations: Decision[]; generatedAt: string;
    },
    refetchInterval: 20_000,
  });

  const memoryQ = useQuery({
    queryKey: ["autonomous", "memory"],
    queryFn:  async () => (await api.get("/api/autonomous/memory?limit=50")).data,
    refetchInterval: 30_000,
  });

  const migrationsQ = useQuery({
    queryKey: ["autonomous", "migrations"],
    queryFn:  async () => (await api.get("/api/autonomous/migrations?limit=50")).data,
    refetchInterval: 20_000,
  });

  const approvalsQ = useQuery({
    queryKey: ["autonomous", "approvals"],
    queryFn:  async () => (await api.get("/api/autonomous/approvals?status=pending")).data,
    refetchInterval: 15_000,
  });

  const federationQ = useQuery({
    queryKey: ["autonomous", "federation"],
    queryFn:  async () => (await api.get("/api/autonomous/federation/clusters")).data,
    refetchInterval: 60_000,
  });

  const refreshDecisions = useMutation({
    mutationFn: async () => (await api.post("/api/autonomous/decisions/refresh")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["autonomous", "decisions"] }),
  });

  const approveM = useMutation({
    mutationFn: async (id: number) => (await api.post(`/api/autonomous/approvals/${id}/approve`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["autonomous", "approvals"] }),
  });
  const rejectM = useMutation({
    mutationFn: async (id: number) => (await api.post(`/api/autonomous/approvals/${id}/reject`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["autonomous", "approvals"] }),
  });

  const decisions       = decisionsQ.data?.decisions ?? [];
  const recommendations = decisionsQ.data?.recommendations ?? [];
  const memoryEvents    = memoryQ.data?.events ?? [];
  const migrations      = migrationsQ.data?.migrations ?? [];
  const approvals       = approvalsQ.data?.approvals ?? [];
  const clusters        = federationQ.data?.clusters ?? [];

  const counts = useMemo(() => ({
    decisions: decisions.length,
    recs:      recommendations.length,
    pending:   approvals.length,
    inflight:  migrations.filter((m: any) => !["completed", "failed"].includes(m.status)).length,
  }), [decisions, recommendations, approvals, migrations]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <Brain className="h-3 w-3" /> Phase 16 · Autonomous Orchestration
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Autonomous Operations Center</h1>
            <p className="mt-1 text-sm text-slate-600">
              AutoFlowNG decides, executes, verifies and learns. You stay in control.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refreshDecisions.mutate()}
            disabled={refreshDecisions.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshDecisions.isPending ? "animate-spin" : ""}`} />
            Refresh decisions
          </Button>
        </div>

        {/* Mode strip */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ModeCard icon={<Zap className="h-4 w-4" />}     title="Scaling"  mode={statusQ.data?.scaling.mode}  />
          <ModeCard icon={<Network className="h-4 w-4" />} title="Failover" mode={statusQ.data?.failover.mode} />
          <ModeCard icon={<Shield className="h-4 w-4" />}  title="Recovery" mode={statusQ.data?.recovery.mode} />
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Counter label="Active decisions"      value={counts.decisions} icon={<Activity className="h-4 w-4" />} />
          <Counter label="Recommendations"       value={counts.recs}      icon={<Brain className="h-4 w-4" />} />
          <Counter label="Awaiting approval"     value={counts.pending}   icon={<Clock className="h-4 w-4" />} tone={counts.pending ? "warn" : "ok"} />
          <Counter label="In-flight migrations"  value={counts.inflight}  icon={<GitBranch className="h-4 w-4" />} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="decisions">Decisions</TabsTrigger>
            <TabsTrigger value="approvals">Approvals {counts.pending ? <Badge className="ml-2">{counts.pending}</Badge> : null}</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="migrations">Migrations</TabsTrigger>
            <TabsTrigger value="federation">Federation</TabsTrigger>
          </TabsList>

          <TabsContent value="decisions" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Live decisions</CardTitle>
                <CardDescription>High-confidence actions ready to execute (or already executing in autonomous mode).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {decisions.length === 0 && <Empty>No live decisions — system is healthy.</Empty>}
                {decisions.map((d, i) => <DecisionRow key={i} d={d} />)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendations</CardTitle>
                <CardDescription>Low-confidence or advisory-only signals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recommendations.length === 0 && <Empty>None.</Empty>}
                {recommendations.map((d, i) => <DecisionRow key={i} d={d} />)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approvals">
            <Card>
              <CardHeader>
                <CardTitle>Pending approvals</CardTitle>
                <CardDescription>Autonomous actions awaiting operator sign-off.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {approvals.length === 0 && <Empty>No pending approvals.</Empty>}
                {approvals.map((a: any) => (
                  <div key={a.id} className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{a.category}</Badge>
                        <span className="font-mono text-sm">{a.action}</span>
                      </div>
                      <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(a.payload, null, 2)}</pre>
                    </div>
                    <div className="ml-3 flex shrink-0 flex-col gap-2">
                      <Button size="sm" onClick={() => approveM.mutate(a.id)} disabled={approveM.isPending}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejectM.mutate(a.id)} disabled={rejectM.isPending}>
                        <XCircle className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memory">
            <Card>
              <CardHeader>
                <CardTitle>Operational memory</CardTitle>
                <CardDescription>Persistent record of every autonomous decision and outcome.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100">
                  {memoryEvents.length === 0 && <Empty>No events recorded yet.</Empty>}
                  {memoryEvents.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
                      <OutcomeDot outcome={e.outcome} />
                      <span className="w-40 truncate text-slate-500">{new Date(e.created_at).toLocaleString()}</span>
                      <Badge variant="outline">{e.category}</Badge>
                      <span className="font-mono">{e.action}</span>
                      {e.fault_class && <Badge variant="secondary">{e.fault_class}</Badge>}
                      <span className="ml-auto text-xs text-slate-500">{e.outcome}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="migrations">
            <Card>
              <CardHeader>
                <CardTitle>Execution migrations</CardTitle>
                <CardDescription>Checkpoint-based transfers between workers and regions.</CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr><th className="py-2">Execution</th><th>From</th><th>To</th><th>Status</th><th>Reason</th><th>Updated</th></tr>
                  </thead>
                  <tbody>
                    {migrations.length === 0 && (
                      <tr><td colSpan={6}><Empty>No migrations on record.</Empty></td></tr>
                    )}
                    {migrations.map((m: any) => (
                      <tr key={m.id} className="border-t border-slate-100">
                        <td className="py-2 font-mono text-xs">{m.execution_id}</td>
                        <td className="text-xs">{m.from_node_id}</td>
                        <td className="text-xs">{m.to_node_id}</td>
                        <td><MigrationStatus s={m.status} /></td>
                        <td className="text-xs text-slate-500">{m.reason ?? "—"}</td>
                        <td className="text-xs text-slate-500">{new Date(m.updated_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="federation">
            <Card>
              <CardHeader>
                <CardTitle>Redis federation</CardTitle>
                <CardDescription>Migration-readiness model. Federation is not active until cutover.</CardDescription>
              </CardHeader>
              <CardContent>
                {clusters.length === 0 && <Empty>No federation clusters registered. Operating on shared Redis.</Empty>}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {clusters.map((c: any) => (
                    <div key={c.clusterId} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-slate-500" />
                          <span className="font-medium">{c.clusterId}</span>
                          <Badge variant="outline">{c.role}</Badge>
                        </div>
                        <span className="text-xs text-slate-500">{c.regionId}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">{c.endpoint}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <Stat label="Score" value={c.health?.score?.toFixed?.(2) ?? "—"} />
                        <Stat label="RTT"   value={c.health?.rttMs != null ? `${c.health.rttMs}ms` : "—"} />
                        <Stat label="Lag"   value={c.health?.lagMs != null ? `${c.health.lagMs}ms` : "—"} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function ModeCard({ icon, title, mode }: { icon: React.ReactNode; title: string; mode?: Mode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-slate-100 p-2">{icon}</div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">{title}</div>
            <div className="text-base font-semibold">{mode ?? "—"}</div>
          </div>
        </div>
        {modeBadge(mode)}
      </CardContent>
    </Card>
  );
}

function Counter({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "ok" | "warn" }) {
  const ring = tone === "warn" ? "ring-amber-200" : "ring-slate-200";
  return (
    <div className={`rounded-lg bg-white p-4 ring-1 ${ring}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">{icon}{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function DecisionRow({ d }: { d: Decision }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <Activity className="mt-0.5 h-4 w-4 text-slate-400" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{d.category}</Badge>
          {d.component && <span className="text-xs text-slate-500">{d.component}</span>}
          <span className="font-mono text-sm">{d.action}</span>
          <span className={`ml-2 text-xs ${conf(d.confidence)}`}>
            confidence {(d.confidence * 100).toFixed(0)}%
          </span>
        </div>
        {d.reason && <div className="mt-1 text-xs text-slate-600">{d.reason}</div>}
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 text-slate-300" />
    </div>
  );
}

function OutcomeDot({ outcome }: { outcome: string }) {
  const color =
    outcome === "success"            ? "bg-emerald-500" :
    outcome === "failure"            ? "bg-rose-500"    :
    outcome === "awaiting_approval"  ? "bg-amber-500"   :
    outcome === "advisory"           ? "bg-slate-400"   : "bg-slate-300";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function MigrationStatus({ s }: { s: string }) {
  const map: Record<string, string> = {
    planned:      "bg-slate-100 text-slate-700",
    preparing:    "bg-blue-100 text-blue-700",
    transferring: "bg-blue-100 text-blue-700",
    resuming:     "bg-blue-100 text-blue-700",
    verifying:    "bg-blue-100 text-blue-700",
    completed:    "bg-emerald-100 text-emerald-700",
    failed:       "bg-rose-100 text-rose-700",
  };
  return <span className={`rounded px-2 py-0.5 text-xs ${map[s] ?? "bg-slate-100"}`}>{s}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 px-2 py-1">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">{children}</div>;
}
