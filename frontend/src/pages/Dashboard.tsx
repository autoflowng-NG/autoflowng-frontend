import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { analyticsAPI, workflowsAPI, automationsAPI } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import { Reveal } from "../components/Reveal";
import { Tilt } from "../components/Tilt";
import { Particles } from "../components/Particles";
import { useLiveEvents, type LiveEvent, type LiveEventType, type LiveEventStatus } from "../hooks/useLiveEvents";
import { OrchestrationPulse, ExecutionGlowBar, PulseRing } from "../components/OrchestrationPulse";
import { AnimatePresence, motion } from "framer-motion";
import { ExecutionDetailDrawer } from "../components/ExecutionDetailDrawer";
import { OrchestrationInsightCard } from "../components/OrchestrationIntelligence";
import { GlobalExecutionTimeline, HistoricalTimeline } from "../components/GlobalExecutionTimeline";
import { ReplayGapIndicator } from "../hooks/useReplayBuffer";
import { PredictiveInsightsPanel } from "../components/PredictiveInsightsPanel";
import { OrgHealthSummary } from "../components/EnterpriseOpsCenter";
import { useOrg } from "../contexts/OrgContext";
import { useOrgExecutionFeed } from "../hooks/useOrgWorkflows";
import { TeamExecutionFeed } from "../components/TeamExecutionFeed";
import {
  GitBranch, Zap, Activity, Bot, ArrowRight, Play, TrendingUp,
  Clock, CheckCircle2, XCircle, RefreshCw, Radio, Link2,
} from "lucide-react";
import { TrialCountdownBanner } from "../components/TrialCountdownBanner";

/* ── Skeleton loader ─────────────────────────────────────────────────── */
function Skeleton({ w = "100%", h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "rgba(255,255,255,0.06)",
      animation: "af-skeleton-pulse 1.8s ease-in-out infinite",
    }} />
  );
}

function StatCardSkeleton() {
  return (
    <div className="af-glass" style={{ borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <Skeleton w={36} h={36} radius={10} />
        <Skeleton w={56} h={22} radius={100} />
      </div>
      <Skeleton w="55%" h={36} radius={6} />
      <div style={{ marginTop: 8 }}><Skeleton w="70%" h={14} /></div>
    </div>
  );
}

/* ── Stat card ──────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color, icon: Icon, delay = 0, loading }: any) {
  if (loading) return <StatCardSkeleton />;
  return (
    <Reveal delay={delay}>
      <Tilt max={4}>
        <div className="af-glass" style={{
          borderRadius: 16, padding: "20px",
          position: "relative", overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 1,
            background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
          }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={16} color={color} />
            </div>
            {sub !== undefined && (
              <div style={{ fontSize: 11, fontWeight: 700, color, background: `${color}15`, borderRadius: 100, padding: "3px 8px", fontFamily: "'DM Mono',monospace" }}>{sub}</div>
            )}
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>{value ?? "—"}</div>
          <div style={{ fontSize: 12, color: "rgba(232,238,255,0.45)", marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
        </div>
      </Tilt>
    </Reveal>
  );
}

/* ── Mini bar chart ─────────────────────────────────────────────────── */
function MiniBarChart({ data, color = "#00C896" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 48 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: "2px 2px 0 0",
          background: `${color}${Math.round((0.15 + 0.65 * v / max) * 255).toString(16).padStart(2, "0")}`,
          height: `${Math.max(4, (v / max) * 100)}%`,
          transition: "height 0.6s cubic-bezier(0.34,1.56,0.64,1)", minWidth: 4,
        }} />
      ))}
    </div>
  );
}

/* ── Live event helpers ──────────────────────────────────────────────── */
const EVENT_META: Record<LiveEventType, { icon: any; color: string }> = {
  workflow_run:       { icon: GitBranch, color: "#00C896" },
  workflow_run_start: { icon: Play,      color: "#38BDF8" },
  workflow_run_end:   { icon: GitBranch, color: "#00C896" },
  automation_trigger: { icon: Zap,       color: "#A78BFA" },
  status_change:      { icon: Activity,  color: "#FBBF24" },
  connection_event:   { icon: Link2,     color: "#38BDF8" },
  generic:            { icon: Radio,     color: "rgba(232,238,255,0.4)" },
};

const STATUS_COLORS: Record<LiveEventStatus, string> = {
  success: "#00C896", failed: "#FB7185", running: "#38BDF8", pending: "#FBBF24",
};
const STATUS_ICONS: Record<LiveEventStatus, any> = {
  success: CheckCircle2, failed: XCircle, running: RefreshCw, pending: Clock,
};

function relTime(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 5)    return "just now";
  if (d < 60)   return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

/* ── Event row ───────────────────────────────────────────────────────── */
function EventRow({ ev, isNew, onClick }: { ev: LiveEvent; isNew: boolean; onClick?: () => void }) {
  const meta   = EVENT_META[ev.type] ?? EVENT_META.generic;
  const sColor = STATUS_COLORS[ev.status];
  const SIcon  = STATUS_ICONS[ev.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      data-testid={`live-event-${ev.id}`}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
        background: isNew ? `${sColor}08` : "rgba(255,255,255,0.015)",
        borderRadius: 10,
        border: `1px solid ${isNew ? sColor + "22" : "rgba(255,255,255,0.04)"}`,
        transition: "background 1.5s ease, border-color 1.5s ease",
        position: "relative", overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {isNew && (
        <motion.div
          initial={{ opacity: 0.6 }} animate={{ opacity: 0 }}
          transition={{ duration: 1.2, delay: 0.1 }}
          style={{ position: "absolute", inset: 0, background: `${sColor}12`, borderRadius: 10, pointerEvents: "none" }}
        />
      )}
      {/* Type icon */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: `${meta.color}12`, border: `1px solid ${meta.color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <meta.icon size={12} color={meta.color} />
      </div>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
        {ev.detail && <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.detail}</div>}
      </div>
      {/* Status */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <SIcon size={10} color={sColor} style={ev.status === "running" ? { animation: "spin-slow 1s linear infinite" } : undefined} />
          <span style={{ fontSize: 9, fontWeight: 800, color: sColor, fontFamily: "'DM Mono',monospace" }}>{ev.status.toUpperCase()}</span>
        </div>
        <span style={{ fontSize: 9, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>{relTime(ev.ts)}</span>
      </div>
    </motion.div>
  );
}

/* ── Live event feed panel ───────────────────────────────────────────── */
function LiveEventFeed({ onEventClick }: { onEventClick: (ev: any) => void }) {
  const { events, wsStatus, isConnected, clearEvents } = useLiveEvents();
  const { activeOrg } = useOrg();
  const { data: orgExecutions = [] } = useOrgExecutionFeed(20);
  const newEventIds = events.slice(0, 3).map(e => e.id);
  const hasRunning  = events.some(e => e.status === "running");

  return (
    <div className="af-glass" style={{
      borderRadius: 18, padding: "24px", overflow: "hidden",
      position: "relative", border: "1px solid rgba(255,255,255,0.06)",
      height: "100%",
    }}>
      <ExecutionGlowBar running={hasRunning} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Live Orchestration</div>
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>REALTIME EVENTS</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PulseRing active={isConnected} color="#00C896" size={8} />
          {events.length > 0 && (
            <button
              onClick={clearEvents}
              data-testid="btn-clear-events"
              style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Mono',monospace" }}
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Orchestration pulse strip */}
      <OrchestrationPulse className="orchestration-pulse-strip" />
      <div style={{ marginBottom: 14 }} />

      {/* Events */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 6,
        maxHeight: 320, overflowY: "auto",
        scrollbarWidth: "none",
      }}>
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 10 }}
            >
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Radio size={16} color="rgba(0,200,150,0.4)" />
              </div>
              <div style={{ fontSize: 12, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Sans',sans-serif", textAlign: "center" }}>
                {isConnected ? "Listening for orchestration events…" : "Waiting for connection…"}
              </div>
            </motion.div>
          ) : (
            events.map(ev => <EventRow key={ev.id} ev={ev} isNew={newEventIds.includes(ev.id)} onClick={() => onEventClick(ev)} />)
          )}
        </AnimatePresence>
      </div>

      {events.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 10, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Mono',monospace" }}>
          {events.length} event{events.length !== 1 ? "s" : ""} · live feed
        </div>
      )}
    </div>
  );
}

/* ── Recent runs feed ────────────────────────────────────────────────── */
function RecentRunsFeed({ runs }: { runs: any[] }) {
  const STATUS_MAP: any = {
    success: { color: "#00C896", icon: CheckCircle2 },
    failed:  { color: "#FB7185", icon: XCircle },
    running: { color: "#38BDF8", icon: RefreshCw },
    pending: { color: "#FBBF24", icon: Clock },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {runs.slice(0, 5).map((run: any, i: number) => {
        const st   = STATUS_MAP[run.status] ?? STATUS_MAP.pending;
        const Icon = st.icon;
        return (
          <div key={run.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.04)" }}>
            <Icon size={13} color={st.color} style={run.status === "running" ? { animation: "spin-slow 1s linear infinite" } : undefined} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{run.workflow_name || run.name || "Workflow run"}</div>
              <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>{run.duration ? `${run.duration}ms` : ""}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: st.color, background: `${st.color}15`, borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{run.status}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Dashboard ──────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user, token } = useAuth();
  const nav = useNavigate();

  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: queryKeys.analytics("7d"),
    queryFn:  () => analyticsAPI.get("7d"),
    staleTime: 2 * 60 * 1000,
  });
  const { data: wfData, isLoading: loadingWF } = useQuery({
    queryKey: queryKeys.workflows,
    queryFn:  () => workflowsAPI.list().then((d: any) => d.workflows || []),
  });
  const { data: amData, isLoading: loadingAM } = useQuery({
    queryKey: queryKeys.automations,
    queryFn:  () => automationsAPI.list().then((d: any) => d.automations || []),
  });
  const { data: userStats, isLoading: loadingStats } = useQuery({
    queryKey: queryKeys.userStats,
    queryFn:  () => import("../lib/api").then(m => m.authAPI.stats()),
  });

  const workflows   = wfData  || [];
  const automations = amData  || [];
  const activeWF    = workflows.filter((w: any) => w.is_active).length;
  const activeAM    = automations.filter((a: any) => a.enabled).length;
  const recentRuns  = (analytics as any)?.recent_runs || [];
  const events7d    = (analytics as any)?.events_7d   || [];
  const totalEvents = (analytics as any)?.total_events || (userStats as any)?.total_events || 0;
  const authToken   = token();
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);

  const statsLoading = loadingAnalytics || loadingStats;

  return (
    <PageTransition variant="slide">
      <TrialCountdownBanner />
      <div style={{ padding: "clamp(16px, 3vw, 32px)", maxWidth: 1280, margin: "0 auto", position: "relative" }}>
        {/* Ambient glow */}
        <div style={{ position: "absolute", top: 0, right: 0, width: 600, height: 600, background: "radial-gradient(ellipse at 80% 10%, rgba(0,200,150,0.05) 0%, transparent 60%)", pointerEvents: "none" }} />
        <Particles opacity={0.2} count={20} />

        {/* Header */}
        <Reveal>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>COMMAND CENTER</div>
            <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", marginBottom: 6 }}>
              Welcome, {user?.name?.split(" ")[0] || "there"} 👋
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Sans',sans-serif" }}>
              Your orchestration is running. Here's what's happening.
            </p>
          </div>
        </Reveal>

        {/* Stats grid — auto-fit responsive */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(200px,100%),1fr))", gap: 16, marginBottom: 28 }}>
          <StatCard loading={statsLoading || loadingWF}    label="Active Workflows"   value={activeWF}    color="#00C896" icon={GitBranch} sub={`${workflows.length} total`}   delay={0}   />
          <StatCard loading={statsLoading || loadingAM}    label="Active Automations" value={activeAM}    color="#38BDF8" icon={Zap}       sub={`${automations.length} total`} delay={60}  />
          <StatCard loading={statsLoading}                 label="Events (7d)"        value={totalEvents} color="#A78BFA" icon={Activity}  sub="+12%"                          delay={120} />
          <StatCard loading={statsLoading}                 label="AI Requests" value={(userStats as any)?.ai_requests || (analytics as any)?.ai_requests || "—"} color="#FBBF24" icon={Bot} sub="today" delay={180} />
        </div>

        {/* Charts + Live Feed — responsive: single col on mobile, 3-col on wide */}
        <div className="af-dashboard-grid" style={{ display: "grid", gap: 20, marginBottom: 24, alignItems: "start" }}>

          {/* Event volume chart */}
          <Reveal delay={100}>
            <div className="af-glass" style={{ borderRadius: 18, padding: "24px", overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Event Volume</div>
                  <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>LAST 7 DAYS</div>
                </div>
                <TrendingUp size={16} color="#00C896" />
              </div>
              {loadingAnalytics ? (
                <Skeleton w="100%" h={48} radius={6} />
              ) : (
                <MiniBarChart data={events7d.length > 0 ? events7d : [12, 18, 9, 24, 31, 28, 40]} color="#00C896" />
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                  <span key={d} style={{ fontSize: 9, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>{d}</span>
                ))}
              </div>

              {recentRuns.length > 0 && (
                <>
                  <div style={{ margin: "20px 0 12px", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em" }}>RECENT RUNS</div>
                  </div>
                  <RecentRunsFeed runs={recentRuns} />
                </>
              )}
            </div>
          </Reveal>

          {/* Live event feed — spans 2 cols on wide */}
          <Reveal delay={140} style={{ gridColumn: "span 2" }}>
            <LiveEventFeed onEventClick={setSelectedEvent} />
          </Reveal>
        </div>

        {/* Quick actions */}
        <Reveal delay={200}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 14 }}>QUICK ACTIONS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(180px,100%),1fr))", gap: 12 }}>
              {[
                { label: "New Workflow",   icon: GitBranch, path: "/workflows",   color: "#00C896" },
                { label: "New Automation", icon: Zap,       path: "/automations", color: "#38BDF8" },
                { label: "Ask AI",         icon: Bot,       path: "/ai",          color: "#A78BFA" },
                { label: "View Plans",     icon: Activity,  path: "/plans",       color: "#FBBF24" },
              ].map(a => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    data-testid={`quick-action-${a.label.toLowerCase().replace(/\s/g, "-")}`}
                    onClick={() => nav(a.path)}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${a.color}25`, borderRadius: 12, padding: "12px 16px", cursor: "pointer", color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, transition: "all 0.18s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}10`; (e.currentTarget as HTMLElement).style.borderColor = `${a.color}40`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = `${a.color}25`; }}
                  >
                    <Icon size={15} color={a.color} /> {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Workflows preview */}
        <Reveal delay={240}>
          <div className="af-glass" style={{ borderRadius: 18, padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Your Workflows</div>
                {loadingWF
                  ? <Skeleton w={60} h={10} />
                  : <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{workflows.length} TOTAL</div>
                }
              </div>
              <button
                onClick={() => nav("/workflows")}
                data-testid="link-all-workflows"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 8, padding: "6px 12px", color: "#00C896", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}
              >
                View all <ArrowRight size={12} />
              </button>
            </div>

            {loadingWF ? (
              <Stagger>
                {[0,1,2].map(i => <StaggerItem key={i}><div style={{ marginBottom: 8 }}><Skeleton h={44} radius={10} /></div></StaggerItem>)}
              </Stagger>
            ) : workflows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(232,238,255,0.2)", fontSize: 14 }}>
                No workflows yet.{" "}
                <button onClick={() => nav("/workflows")} style={{ background: "none", border: "none", color: "#00C896", cursor: "pointer", fontWeight: 600 }}>Create your first →</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {workflows.slice(0, 5).map((wf: any) => (
                  <button
                    key={wf.id}
                    data-testid={`workflow-card-${wf.id}`}
                    onClick={() => nav(`/workflows/${wf.id}`)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", textAlign: "left", transition: "all 0.18s" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,200,150,0.04)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: wf.is_active ? "#00C896" : "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{wf.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>{wf.trigger_type || "manual"}</div>
                    </div>
                    <div style={{ fontSize: 11, color: wf.is_active ? "#00C896" : "rgba(232,238,255,0.25)", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{wf.is_active ? "ACTIVE" : "PAUSED"}</div>
                    <Play size={12} color="rgba(232,238,255,0.3)" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* Responsive grid CSS */}
      <style>{`
        .af-dashboard-grid {
          grid-template-columns: minmax(260px,1fr) minmax(0,1fr) minmax(0,1fr);
        }
        @media (max-width: 900px) {
          .af-dashboard-grid { grid-template-columns: 1fr; }
          .af-dashboard-grid > *[style*="span 2"] { grid-column: span 1 !important; }
        }
        .orchestration-pulse-strip { margin-bottom: 2px; }
      `}</style>
      {/* Phase 6 — Enterprise health summary */}
      <OrgHealthSummary />

      {/* Phase 4 — Intelligence + Timeline */}
      <OrchestrationInsightCard />
      <div style={{ marginTop: 16 }}>
        <PredictiveInsightsPanel />
      </div>
      {/* Phase 8: Team execution feed (org workspace only) */}
      <div style={{ marginTop: 16 }}>
        <TeamExecutionFeed onSelectRun={(run) => setSelectedEvent(run)} />
      </div>

      <div style={{ marginTop: 20 }}>
        <GlobalExecutionTimeline />
      </div>
      <div style={{ marginTop: 16 }}>
        <HistoricalTimeline />
      </div>
      <div style={{ marginTop: 12 }}>
        <ReplayGapIndicator />
      </div>
      <ExecutionDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </PageTransition>
  );
}
