import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import {
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Shield, Zap,
  Database, Activity, Clock, Server, Brain, Cpu, Layers,
  MemoryStick, GitBranch, Settings, Play, Pause, Eye, Lock
} from "lucide-react";

const API = "/api/phase19";

function useFetch(path: string, opts?: { enabled?: boolean; interval?: number }) {
  return useQuery({
    queryKey: [path],
    queryFn: async () => {
      const r = await fetch(path);
      if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
      return r.json();
    },
    refetchInterval: opts?.interval ?? 15_000,
    enabled: opts?.enabled !== false,
    retry: 2,
  });
}

// ── Status badge helper ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    running:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    active:    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    idle:      "bg-slate-500/20  text-slate-400   border-slate-500/30",
    stopped:   "bg-red-500/20    text-red-400     border-red-500/30",
    error:     "bg-red-500/20    text-red-400     border-red-500/30",
    degraded:  "bg-amber-500/20  text-amber-400   border-amber-500/30",
    pending:   "bg-blue-500/20   text-blue-400    border-blue-500/30",
    suspended: "bg-orange-500/20 text-orange-400  border-orange-500/30",
  };
  const cls = map[status ?? ""] ?? "bg-slate-700/20 text-slate-400 border-slate-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono border rounded ${cls}`}>
      {status ?? "unknown"}
    </span>
  );
}

function scoreColor(v: number) {
  return v >= 0.8 ? "text-emerald-400" : v >= 0.5 ? "text-amber-400" : "text-red-400";
}

// ── WS1 — Platform Readiness ──────────────────────────────────────────────────
function PlatformReadiness() {
  const { data, isLoading, refetch } = useFetch(`${API}/platform/readiness`);
  const checks = data?.checks ?? [];
  const score  = data?.score ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Platform Readiness — WS1</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-8 text-center text-sm">Running readiness checks…</div>
      ) : (
        <>
          <Card className="bg-slate-900/60 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-bold font-mono ${scoreColor(score)}`}>
                  {Math.round(score * 100)}%
                </div>
                <div className="flex-1">
                  <Progress value={score * 100} className="h-3" />
                  <p className="text-xs text-slate-400 mt-1">
                    Overall readiness — {checks.filter((c: any) => c.passed).length}/{checks.length} checks passed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {checks.map((c: any) => (
              <div key={c.name} className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-lg border border-slate-700">
                {c.passed
                  ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  : <XCircle    className="w-4 h-4 text-red-400    shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  {c.message && <p className="text-xs text-slate-400 truncate">{c.message}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── WS2 — AI Provider Registry ────────────────────────────────────────────────
function ProviderRegistry() {
  const { data, isLoading, refetch } = useFetch(`${API}/providers`);
  const providers = data?.providers ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">AI Provider Registry — WS2</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-8 text-center text-sm">Loading providers…</div>
      ) : providers.length === 0 ? (
        <div className="text-slate-500 py-8 text-center text-sm">No providers registered</div>
      ) : (
        <div className="grid gap-3">
          {providers.map((p: any) => (
            <Card key={p.id} className="bg-slate-900/60 border-slate-700">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Brain className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{p.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.type} · {p.base_url ?? "default endpoint"}</p>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <Separator className="my-3 bg-slate-700" />
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-white font-mono">{p.latency_ms ?? "—"}</p>
                    <p className="text-xs text-slate-400">Latency ms</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold font-mono ${scoreColor((p.success_rate ?? 100) / 100)}`}>
                      {p.success_rate?.toFixed(1) ?? "100.0"}%
                    </p>
                    <p className="text-xs text-slate-400">Success Rate</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white font-mono">{p.total_calls ?? 0}</p>
                    <p className="text-xs text-slate-400">Total Calls</p>
                  </div>
                </div>
                {p.models?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.models.map((m: string) => (
                      <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WS3 — Tool Registry ───────────────────────────────────────────────────────
function ToolRegistry() {
  const { data, isLoading, refetch } = useFetch(`${API}/tools`);
  const tools = data?.tools ?? [];
  const stats  = data?.stats ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Tool Registry — WS3</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Registered", value: stats.total ?? tools.length, icon: Layers },
          { label: "Enabled",    value: stats.enabled ?? 0,          icon: CheckCircle },
          { label: "Built-In",   value: stats.builtin ?? 0,          icon: Cpu },
          { label: "Calls Today",value: stats.calls_today ?? 0,      icon: Activity },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-slate-900/60 border-slate-700">
            <CardContent className="pt-3 pb-3 text-center">
              <Icon className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-white font-mono">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-4 text-center text-sm">Loading tools…</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/60 text-slate-400 text-left">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Calls</th>
                <th className="px-4 py-2 font-medium">Avg ms</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((t: any) => (
                <tr key={t.name} className="border-t border-slate-700 hover:bg-slate-800/30">
                  <td className="px-4 py-2 font-mono text-white">{t.name}</td>
                  <td className="px-4 py-2 text-slate-300">{t.category}</td>
                  <td className="px-4 py-2"><StatusBadge status={t.enabled ? "active" : "stopped"} /></td>
                  <td className="px-4 py-2 font-mono text-slate-300">{t.total_calls ?? 0}</td>
                  <td className="px-4 py-2 font-mono text-slate-300">{t.avg_duration_ms?.toFixed(1) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── WS4 — Agent Runtime ───────────────────────────────────────────────────────
function AgentRuntime() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useFetch(`${API}/agents`);
  const agents = data?.agents ?? [];

  const spawnMut = useMutation({
    mutationFn: (payload: { agent_type: string; capability: string }) =>
      fetch(`${API}/agents/spawn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(r => r.json()),
    onSuccess: () => { refetch(); },
  });

  const [spawnType, setSpawnType] = useState("task_runner");
  const [spawnCap,  setSpawnCap]  = useState("workflow_execution");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Agent Runtime — WS4</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>
      {/* Spawn panel */}
      <Card className="bg-slate-900/60 border-amber-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
            <Play className="w-4 h-4" />Spawn Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            <select
              value={spawnType}
              onChange={e => setSpawnType(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white rounded px-3 py-1.5 text-sm"
            >
              {["task_runner","tool_caller","orchestrator","validator","monitor"].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select
              value={spawnCap}
              onChange={e => setSpawnCap(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white rounded px-3 py-1.5 text-sm"
            >
              {["workflow_execution","tool_invocation","ai_inference","data_retrieval","notification_dispatch"].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              onClick={() => spawnMut.mutate({ agent_type: spawnType, capability: spawnCap })}
              disabled={spawnMut.isPending}
            >
              {spawnMut.isPending ? "Spawning…" : "Spawn"}
            </Button>
          </div>
          {spawnMut.isSuccess && (
            <p className="text-xs text-emerald-400">✓ Agent spawned — ID: {spawnMut.data?.agent_id}</p>
          )}
          {spawnMut.isError && (
            <p className="text-xs text-red-400">✗ Spawn failed</p>
          )}
        </CardContent>
      </Card>
      {isLoading ? (
        <div className="text-slate-400 py-4 text-center text-sm">Loading agents…</div>
      ) : agents.length === 0 ? (
        <div className="text-slate-500 py-8 text-center text-sm">No agents running</div>
      ) : (
        <div className="grid gap-3">
          {agents.map((a: any) => (
            <Card key={a.id} className="bg-slate-900/60 border-slate-700">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="font-mono text-sm text-white">{a.id}</p>
                      <p className="text-xs text-slate-400">{a.agent_type} · {a.capability}</p>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 text-center text-xs">
                  <div>
                    <p className="font-bold text-white font-mono">{a.tasks_completed ?? 0}</p>
                    <p className="text-slate-400">Completed</p>
                  </div>
                  <div>
                    <p className={`font-bold font-mono ${scoreColor((a.success_rate ?? 100) / 100)}`}>
                      {((a.success_rate ?? 100)).toFixed(1)}%
                    </p>
                    <p className="text-slate-400">Success</p>
                  </div>
                  <div>
                    <p className="font-bold text-white font-mono">{a.avg_duration_ms?.toFixed(0) ?? "—"}</p>
                    <p className="text-slate-400">Avg ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WS5 — Memory Store ────────────────────────────────────────────────────────
function MemoryStore() {
  const { data, isLoading, refetch } = useFetch(`${API}/memory/stats`);
  const stats = data?.stats ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Agent Memory — WS5</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-4 text-center text-sm">Loading memory stats…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Sessions",    value: stats.total_sessions    ?? 0,    icon: Database },
            { label: "Active Sessions",   value: stats.active_sessions   ?? 0,    icon: Activity },
            { label: "Short-Term Items",  value: stats.short_term_count  ?? 0,    icon: Clock },
            { label: "Long-Term Items",   value: stats.long_term_count   ?? 0,    icon: MemoryStick },
            { label: "Bytes Stored",      value: stats.total_bytes       ?? 0,    icon: Database },
            { label: "Retrieval Avg ms",  value: stats.retrieval_avg_ms?.toFixed(1) ?? "—", icon: Zap },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="bg-slate-900/60 border-slate-700">
              <CardContent className="pt-3 pb-3 text-center">
                <Icon className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white font-mono">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Context manager status */}
      <Card className="bg-slate-900/60 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            <Brain className="w-4 h-4 text-amber-400" />Context Manager Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.context_manager ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400">Active Contexts</p>
                <p className="font-bold text-white font-mono">{data.context_manager.active_count ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-400">Window Utilisation</p>
                <p className="font-bold text-white font-mono">
                  {(((data.context_manager.avg_utilisation ?? 0)) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No context data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── WS6/7 — Governance & Policy ───────────────────────────────────────────────
function GovernancePanel() {
  const { data, isLoading, refetch } = useFetch(`${API}/governance/status`);
  const policies  = data?.policies   ?? [];
  const boundaries = data?.boundaries ?? [];
  const violations = data?.recent_violations ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Governance & Safety — WS6/7</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-4 text-center text-sm">Loading governance data…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Active Policies",    value: policies.length,   icon: Shield },
              { label: "Safety Boundaries",  value: boundaries.length, icon: Lock },
              { label: "Recent Violations",  value: violations.length, icon: AlertTriangle },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="bg-slate-900/60 border-slate-700">
                <CardContent className="pt-3 pb-3 text-center">
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${label.includes("Violation") && value > 0 ? "text-red-400" : "text-amber-400"}`} />
                  <p className={`text-2xl font-bold font-mono ${label.includes("Violation") && value > 0 ? "text-red-400" : "text-white"}`}>{value}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {violations.length > 0 && (
            <Card className="bg-red-950/30 border-red-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />Recent Policy Violations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {violations.slice(0, 5).map((v: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white">{v.policy_name ?? "Unknown policy"}</p>
                        <p className="text-slate-400 text-xs">{v.agent_id} · {v.action} · {v.ts ?? v.created_at}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {policies.slice(0, 6).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-lg border border-slate-700">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{p.policy_name}</p>
                  <p className="text-xs text-slate-400">{p.policy_type} · {p.scope}</p>
                </div>
                <Badge variant={p.enabled ? "default" : "secondary"} className="text-xs shrink-0">
                  {p.enabled ? "on" : "off"}
                </Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── WS8 — Telemetry ───────────────────────────────────────────────────────────
function TelemetryPanel() {
  const { data, isLoading, refetch } = useFetch(`${API}/telemetry/overview`, { interval: 10_000 });
  const overview = data ?? {};
  const top = (data?.top_agents ?? []).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Agent Telemetry — WS8</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-4 text-center text-sm">Loading telemetry…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Tasks Executed",   value: overview.total_executions   ?? 0, icon: Play },
              { label: "Success Rate",     value: `${((overview.success_rate ?? 1) * 100).toFixed(1)}%`, icon: CheckCircle },
              { label: "Avg Duration ms",  value: overview.avg_duration_ms?.toFixed(1) ?? "—", icon: Clock },
              { label: "Active Agents",    value: overview.active_agents      ?? 0, icon: Cpu },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="bg-slate-900/60 border-slate-700">
                <CardContent className="pt-3 pb-3 text-center">
                  <Icon className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-white font-mono">{value}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {top.length > 0 && (
            <Card className="bg-slate-900/60 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />Top Agents by Task Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 text-left border-b border-slate-700">
                        <th className="pb-2 font-medium">Agent ID</th>
                        <th className="pb-2 font-medium">Tasks</th>
                        <th className="pb-2 font-medium">Success</th>
                        <th className="pb-2 font-medium">Avg ms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top.map((a: any) => (
                        <tr key={a.agent_id} className="border-t border-slate-700/50">
                          <td className="py-2 font-mono text-xs text-white">{a.agent_id}</td>
                          <td className="py-2 font-mono text-slate-300">{a.total_tasks}</td>
                          <td className={`py-2 font-mono ${scoreColor((a.success_rate ?? 1))}`}>
                            {((a.success_rate ?? 1) * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 font-mono text-slate-300">{a.avg_ms?.toFixed(1) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Scheduler Health ──────────────────────────────────────────────────────────
function SchedulerHealth() {
  const { data, isLoading, refetch } = useFetch(`${API}/scheduler/status`);
  const cycles = data?.cycles ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Phase 19 Scheduler</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="pt-3 pb-3 text-center">
            <GitBranch className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white font-mono">{data?.cycle_count ?? 0}</p>
            <p className="text-xs text-slate-400">Total Cycles Run</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="pt-3 pb-3 text-center">
            <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white font-mono">{data?.healthy_cycles ?? 0}</p>
            <p className="text-xs text-slate-400">Healthy Cycles</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="pt-3 pb-3 text-center">
            <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-2xl font-bold font-mono text-white">{data?.failed_cycles ?? 0}</p>
            <p className="text-xs text-slate-400">Failed Cycles</p>
          </CardContent>
        </Card>
      </div>
      {isLoading ? (
        <div className="text-slate-400 py-4 text-center text-sm">Loading cycle data…</div>
      ) : cycles.length > 0 ? (
        <div className="overflow-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/60 text-slate-400 text-left">
                <th className="px-4 py-2 font-medium">Cycle</th>
                <th className="px-4 py-2 font-medium">Last Run</th>
                <th className="px-4 py-2 font-medium">Duration ms</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c: any) => (
                <tr key={c.name} className="border-t border-slate-700 hover:bg-slate-800/30">
                  <td className="px-4 py-2 font-mono text-xs text-white">{c.name}</td>
                  <td className="px-4 py-2 text-slate-300 text-xs">{c.last_run ?? "never"}</td>
                  <td className="px-4 py-2 font-mono text-slate-300">{c.duration_ms ?? "—"}</td>
                  <td className="px-4 py-2"><StatusBadge status={c.status ?? "idle"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-slate-500 text-sm text-center py-4">No cycle data yet — scheduler may still be warming up</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Phase19OpsCenter() {
  const { data: summary } = useFetch(`${API}/overview`, { interval: 30_000 });

  const statusColor = (s?: string) =>
    s === "nominal"  ? "text-emerald-400" :
    s === "degraded" ? "text-amber-400"   :
    s === "critical" ? "text-red-400"     : "text-slate-400";

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-xl">
            <Brain className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              AutoFlowNG v19.0.0
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Autonomous Intelligence Foundation · Phase 19 Operations Center</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className={`text-lg font-bold font-mono ${statusColor(summary?.overall_status)}`}>
                {summary?.overall_status?.toUpperCase() ?? "LOADING"}
              </p>
              <p className="text-xs text-slate-400">System Status</p>
            </div>
            <div className={`w-3 h-3 rounded-full animate-pulse ${
              summary?.overall_status === "nominal"  ? "bg-emerald-400" :
              summary?.overall_status === "degraded" ? "bg-amber-400"   :
              summary?.overall_status === "critical" ? "bg-red-400"     : "bg-slate-500"
            }`} />
          </div>
        </div>

        {/* KPI strip */}
        {summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3"
          >
            {[
              { label: "Agents Running",    value: summary.agents_running    ?? 0 },
              { label: "Tasks Today",       value: summary.tasks_today       ?? 0 },
              { label: "Providers Online",  value: summary.providers_online  ?? 0 },
              { label: "Tools Enabled",     value: summary.tools_enabled     ?? 0 },
              { label: "Policy Checks",     value: summary.policy_checks     ?? 0 },
              { label: "Scheduler Cycles",  value: summary.scheduler_cycles  ?? 0 },
            ].map(({ label, value }) => (
              <Card key={label} className="bg-slate-900/40 border-slate-800">
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold text-white font-mono">{value}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="readiness" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-700 flex-wrap h-auto gap-1 p-1">
          {[
            { value: "readiness",   label: "Readiness",   icon: CheckCircle },
            { value: "providers",   label: "AI Providers",icon: Brain },
            { value: "tools",       label: "Tools",       icon: Layers },
            { value: "agents",      label: "Agents",      icon: Cpu },
            { value: "memory",      label: "Memory",      icon: MemoryStick },
            { value: "governance",  label: "Governance",  icon: Shield },
            { value: "telemetry",   label: "Telemetry",   icon: Activity },
            { value: "scheduler",   label: "Scheduler",   icon: GitBranch },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-slate-400 flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="readiness">
          <Card className="bg-slate-900/40 border-slate-700">
            <CardContent className="pt-6"><PlatformReadiness /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers">
          <Card className="bg-slate-900/40 border-slate-700">
            <CardContent className="pt-6"><ProviderRegistry /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card className="bg-slate-900/40 border-slate-700">
            <CardContent className="pt-6"><ToolRegistry /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card className="bg-slate-900/40 border-slate-700">
            <CardContent className="pt-6"><AgentRuntime /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory">
          <Card className="bg-slate-900/40 border-slate-700">
            <CardContent className="pt-6"><MemoryStore /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance">
          <Card className="bg-slate-900/40 border-slate-700">
            <CardContent className="pt-6"><GovernancePanel /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telemetry">
          <Card className="bg-slate-900/40 border-slate-700">
            <CardContent className="pt-6"><TelemetryPanel /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduler">
          <Card className="bg-slate-900/40 border-slate-700">
            <CardContent className="pt-6"><SchedulerHealth /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
