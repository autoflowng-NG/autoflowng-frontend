/**
 * IntelligenceOpsCenter.tsx — Phase 9C
 *
 * The Intelligence Operations Center is the unified command console for all
 * AI-powered capabilities introduced in Phase 9C:
 *   - AI Planner (optimization plans)
 *   - AI Reasoning Engine (causal chain traces)
 *   - Predictive Intelligence (failure & degradation forecasts)
 *   - Integration Audit (per-platform health report)
 *   - Security Audit summary
 *   - Phase 10A Readiness
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Brain, Zap, TrendingUp, Shield, CheckCircle, AlertTriangle,
  XCircle, ChevronRight, RefreshCw, Play, X, Clock, BarChart2,
  Activity, Eye, Link2, ArrowRight, Cpu, GitBranch, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

/* ── helpers ──────────────────────────────────────────────────────────── */

function riskColor(level: string) {
  if (level === "high")   return "text-red-400";
  if (level === "medium") return "text-amber-400";
  return "text-emerald-400";
}

function impactBadge(impact: string) {
  const variants: Record<string, string> = {
    high:   "bg-red-500/15 text-red-400 border-red-500/30",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    low:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  return variants[impact] || variants.low;
}

function healthIcon(status: string) {
  if (status === "healthy")       return <CheckCircle className="h-4 w-4 text-emerald-400" />;
  if (status === "not_connected") return <XCircle className="h-4 w-4 text-zinc-500" />;
  return <AlertTriangle className="h-4 w-4 text-amber-400" />;
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-panels
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Planner Panel ─────────────────────────────────────────────────── */
function PlannerPanel() {
  const { toast }   = useToast();
  const qc          = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["planner-plans"],
    queryFn:  () => api.get("/api/planner/plans").then(r => r.data),
    staleTime: 60_000,
  });

  const generate = useMutation({
    mutationFn: () => api.post("/api/planner/generate", {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-plans"] }); toast({ title: "Plans generated" }); },
  });

  const applyPlan = useMutation({
    mutationFn: (id: number) => api.post(`/api/planner/plans/${id}/apply`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-plans"] }),
  });

  const dismissPlan = useMutation({
    mutationFn: (id: number) => api.post(`/api/planner/plans/${id}/dismiss`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-plans"] }),
  });

  const plans: any[] = data?.plans || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">AI Optimization Plans</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{plans.length} active plans · ranked by impact</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-[#7c3aed]/40 text-[#a78bfa] hover:bg-[#7c3aed]/10"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
          Generate Plans
        </Button>
      </div>

      <ScrollArea className="h-[420px] pr-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-5 w-5 animate-spin text-[#7c3aed]" />
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <CheckCircle className="h-8 w-8 text-emerald-500/50" />
            <p className="text-sm text-zinc-500">No pending plans. Generate a new analysis.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan: any) => (
              <div key={plan.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${impactBadge(plan.impact_estimate)}`}>
                        {plan.impact_estimate} impact
                      </span>
                      <span className="text-xs text-zinc-500">{plan.effort_estimate} effort</span>
                      <span className="text-xs text-zinc-500">·</span>
                      <span className="text-xs text-zinc-500">{(plan.confidence * 100).toFixed(0)}% confidence</span>
                    </div>
                    <p className="text-sm font-medium text-white mt-1.5 leading-snug">{plan.title}</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{plan.description}</p>
                  </div>
                </div>

                {plan.actions?.length > 0 && (
                  <div className="space-y-1.5">
                    {plan.actions.slice(0, 3).map((action: any, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <ArrowRight className="h-3 w-3 text-[#7c3aed] mt-0.5 shrink-0" />
                        <span className="text-xs text-zinc-300 leading-relaxed">{action.action}</span>
                        {action.priority === "critical" && (
                          <span className="text-[10px] font-medium text-red-400 uppercase shrink-0">critical</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 text-[#a78bfa] border border-[#7c3aed]/30"
                    onClick={() => applyPlan.mutate(plan.id)}
                    disabled={applyPlan.isPending}
                  >
                    <Play className="h-3 w-3 mr-1" /> Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
                    onClick={() => dismissPlan.mutate(plan.id)}
                  >
                    <X className="h-3 w-3 mr-1" /> Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ── Reasoning Panel ───────────────────────────────────────────────── */
function ReasoningPanel() {
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reasoning-sessions"],
    queryFn:  () => api.get("/api/reasoning/sessions?limit=10").then(r => r.data),
    staleTime: 60_000,
  });

  const platformReasoning = useQuery({
    queryKey: ["reasoning-platform"],
    queryFn:  () => api.get("/api/reasoning/platform").then(r => r.data),
    staleTime: 120_000,
  });

  const platform = platformReasoning.data?.reasoning;
  const sessions: any[] = data?.sessions || [];

  const NODE_COLORS: Record<string, string> = {
    trigger:     "bg-blue-500/15 border-blue-500/40 text-blue-300",
    cause:       "bg-red-500/15 border-red-500/40 text-red-300",
    effect:      "bg-amber-500/15 border-amber-500/40 text-amber-300",
    correlation: "bg-purple-500/15 border-purple-500/40 text-purple-300",
    evidence:    "bg-zinc-500/15 border-zinc-500/40 text-zinc-300",
    conclusion:  "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  };

  return (
    <div className="space-y-4">
      {/* Platform Reasoning */}
      {platform && (
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-[#7c3aed]" />
            <span className="text-sm font-semibold text-white">Platform Reasoning</span>
            <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">live</Badge>
          </div>
          <p className="text-xs text-zinc-400 mb-3">{platform.conclusion}</p>
          <div className="flex flex-wrap gap-2">
            {platform.chain?.slice(0, 3).map((node: any, i: number) => (
              <div key={i} className={`text-[10px] px-2 py-1 rounded-full border ${NODE_COLORS[node.type] || NODE_COLORS.evidence}`}>
                {node.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Reasoning Sessions</h3>
        <span className="text-xs text-zinc-500">{sessions.length} stored</span>
      </div>

      <ScrollArea className="h-[340px] pr-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-24"><RefreshCw className="h-5 w-5 animate-spin text-[#7c3aed]" /></div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <Brain className="h-8 w-8 text-zinc-600" />
            <p className="text-xs text-zinc-500">No reasoning sessions yet. Run a workflow to generate analysis.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s: any) => (
              <div
                key={s.id}
                className={`rounded-lg border p-3 cursor-pointer transition-all ${selected?.id === s.id ? "border-[#7c3aed]/50 bg-[#7c3aed]/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}
                onClick={() => setSelected(selected?.id === s.id ? null : s)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{s.question}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {s.subject_type} · {s.chain?.length || 0} nodes · {(s.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-zinc-500 transition-transform ${selected?.id === s.id ? "rotate-90" : ""}`} />
                </div>

                {selected?.id === s.id && s.chain?.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                    {s.chain.map((node: any, i: number) => (
                      <div key={i} className={`rounded-lg border p-2.5 ${NODE_COLORS[node.type] || NODE_COLORS.evidence}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{node.type}</span>
                          <span className="text-xs font-medium">{node.label}</span>
                        </div>
                        <p className="text-[11px] opacity-80 leading-relaxed">{node.description}</p>
                        {node.evidence?.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {node.evidence.map((e: string, j: number) => (
                              <p key={j} className="text-[10px] opacity-60 font-mono">· {e}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ── Predictive Panel ──────────────────────────────────────────────── */
function PredictivePanel() {
  const { toast }   = useToast();
  const qc          = useQueryClient();

  const { data: riskData } = useQuery({
    queryKey: ["predictive-risk"],
    queryFn:  () => api.get("/api/predictive/risk-score").then(r => r.data),
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["predictions"],
    queryFn:  () => api.get("/api/predictive/predictions?limit=20").then(r => r.data),
    staleTime: 60_000,
  });

  const generate = useMutation({
    mutationFn: () => api.post("/api/predictive/generate", {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["predictions", "predictive-risk"] }); toast({ title: "Predictions refreshed" }); },
  });

  const resolve = useMutation({
    mutationFn: (id: number) => api.post(`/api/predictive/predictions/${id}/resolve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["predictions", "predictive-risk"] }),
  });

  const predictions: any[] = data?.predictions || [];
  const riskScore           = riskData?.platform_risk_score || 0;
  const riskColor           = riskScore >= 60 ? "text-red-400" : riskScore >= 30 ? "text-amber-400" : "text-emerald-400";
  const riskBg              = riskScore >= 60 ? "bg-red-500" : riskScore >= 30 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-4">
      {/* Risk Score Gauge */}
      <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#7c3aed]" />
            <span className="text-sm font-semibold text-white">Platform Risk Score</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-[#a78bfa]"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="flex items-end gap-4">
          <span className={`text-5xl font-black tabular-nums ${riskColor}`}>{riskScore}</span>
          <div className="flex-1 pb-2">
            <Progress value={riskScore} className="h-2 bg-zinc-800" style={{ "--progress-color": riskScore >= 60 ? "#ef4444" : riskScore >= 30 ? "#f59e0b" : "#10b981" } as any} />
            <p className="text-xs text-zinc-500 mt-1">{riskData?.high_risk_count || 0} high-risk predictions · {predictions.length} total</p>
          </div>
        </div>
      </div>

      {/* Predictions list */}
      <ScrollArea className="h-[340px] pr-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-24"><RefreshCw className="h-5 w-5 animate-spin text-[#7c3aed]" /></div>
        ) : predictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <CheckCircle className="h-8 w-8 text-emerald-500/50" />
            <p className="text-xs text-zinc-500">No active predictions. Platform looks healthy.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {predictions.map((p: any) => (
              <div key={p.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${impactBadge(p.impact)}`}>
                        {p.impact} impact
                      </span>
                      <span className="text-xs text-zinc-500">{(p.probability * 100).toFixed(0)}% probability</span>
                      <span className="text-xs text-zinc-500">·</span>
                      <Clock className="h-3 w-3 text-zinc-500" />
                      <span className="text-xs text-zinc-500">{p.horizon_hours}h horizon</span>
                    </div>
                    <p className="text-sm font-medium text-white leading-snug">{p.title}</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{p.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-zinc-600 hover:text-zinc-300 shrink-0"
                    onClick={() => resolve.mutate(p.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Progress
                  value={p.probability * 100}
                  className="h-1 bg-zinc-800"
                />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ── Integration Audit Panel ───────────────────────────────────────── */
function IntegrationAuditPanel() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["integration-audit"],
    queryFn:  () => api.get("/api/integration-audit/report").then(r => r.data),
    staleTime: 120_000,
  });

  const summary = data?.summary;
  const integrations: any[] = (data?.integrations || []).filter((i: any) => i.exists || i.missing === false).length > 0
    ? data.integrations.filter((i: any) => i.exists)
    : data?.integrations || [];

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      {summary && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Connected",      value: summary.connected,        color: "text-white" },
            { label: "Healthy",        value: summary.healthy,          color: "text-emerald-400" },
            { label: "At Risk",        value: summary.at_risk,          color: "text-amber-400" },
            { label: "Security Issues",value: summary.security_issues,  color: "text-red-400" },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
              <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Platform Integrations</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-[#a78bfa]"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <ScrollArea className="h-[360px] pr-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-24"><RefreshCw className="h-5 w-5 animate-spin text-[#7c3aed]" /></div>
        ) : (
          <div className="space-y-2">
            {(data?.integrations || []).map((intg: any) => (
              <div key={intg.platform} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  {healthIcon(intg.health_status)}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white capitalize">{intg.platform.replace("_", " ")}</p>
                    {intg.weaknesses?.length > 0 && (
                      <p className="text-[10px] text-amber-400 truncate">{intg.weaknesses[0]}</p>
                    )}
                    {intg.security_concerns?.length > 0 && (
                      <p className="text-[10px] text-red-400 truncate">{intg.security_concerns[0]}</p>
                    )}
                    {intg.health_status === "not_connected" && (
                      <p className="text-[10px] text-zinc-600">Not connected</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {intg.production_ready && (
                    <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 h-5">prod-ready</Badge>
                  )}
                  {intg.exists && intg.metrics && (
                    <span className="text-[10px] text-zinc-500 tabular-nums">
                      {(intg.metrics.error_rate * 100).toFixed(0)}% err
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════════════════════════════════ */

export default function IntelligenceOpsCenter() {
  const [tab, setTab] = useState("planner");

  const TABS = [
    { value: "planner",   label: "AI Planner",   icon: Zap,        description: "Optimization plans" },
    { value: "reasoning", label: "Reasoning",     icon: Brain,      description: "Causal chains" },
    { value: "predictive",label: "Predictive",    icon: TrendingUp, description: "Risk forecasts" },
    { value: "audit",     label: "Int. Audit",    icon: Shield,     description: "Platform health" },
  ];

  return (
    <div className="min-h-full bg-[#04060F] text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/30">
              <Cpu className="h-4.5 w-4.5 text-[#a78bfa]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Intelligence Operations Center</h1>
              <p className="text-xs text-zinc-500">Phase 9C · AI Planner · Reasoning · Predictive · Integration Audit</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs border-[#7c3aed]/40 text-[#a78bfa]">v9.3.0</Badge>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 px-6 pt-5">
        {[
          { label: "AI Planner",     desc: "Optimization engine",    icon: Zap,        color: "from-violet-600/20" },
          { label: "Reasoning",      desc: "Causal chain analysis",  icon: Brain,      color: "from-blue-600/20" },
          { label: "Predictive",     desc: "Failure forecasting",    icon: TrendingUp, color: "from-amber-600/20" },
          { label: "Audit",          desc: "Integration health",     icon: Shield,     color: "from-emerald-600/20" },
        ].map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => setTab(kpi.label === "AI Planner" ? "planner" : kpi.label === "Reasoning" ? "reasoning" : kpi.label === "Predictive" ? "predictive" : "audit")}
            className={`rounded-xl border p-4 text-left transition-all ${
              (tab === "planner" && kpi.label === "AI Planner") ||
              (tab === "reasoning" && kpi.label === "Reasoning") ||
              (tab === "predictive" && kpi.label === "Predictive") ||
              (tab === "audit" && kpi.label === "Audit")
                ? "border-[#7c3aed]/50 bg-[#7c3aed]/10"
                : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
            }`}
          >
            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${kpi.color} to-transparent border border-white/10 flex items-center justify-center mb-2`}>
              <kpi.icon className="h-4 w-4 text-white/70" />
            </div>
            <p className="text-sm font-semibold text-white">{kpi.label}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{kpi.desc}</p>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="px-6 pt-5 pb-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-zinc-900/50 border border-white/5 mb-5">
            {TABS.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="data-[state=active]:bg-[#7c3aed]/20 data-[state=active]:text-[#a78bfa]">
                <t.icon className="h-3.5 w-3.5 mr-1.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="planner">
            <Card className="border-white/5 bg-white/[0.02]">
              <CardContent className="pt-5">
                <PlannerPanel />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reasoning">
            <Card className="border-white/5 bg-white/[0.02]">
              <CardContent className="pt-5">
                <ReasoningPanel />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictive">
            <Card className="border-white/5 bg-white/[0.02]">
              <CardContent className="pt-5">
                <PredictivePanel />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card className="border-white/5 bg-white/[0.02]">
              <CardContent className="pt-5">
                <IntegrationAuditPanel />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
