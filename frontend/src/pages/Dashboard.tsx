import { useState, useRef, useEffect } from "react";
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
  MoreVertical, Eye, RotateCcw, FileText, X as XIcon,
} from "lucide-react";
import { TrialCountdownBanner } from "../components/TrialCountdownBanner";

/* \u2500\u2500 Skeleton loader \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u2500\u2500 Stat card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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
          <div style={{ fontSize: "1.8rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>{value ?? "\u2014"}</div>
          <div style={{ fontSize: 12, color: "rgba(232,238,255,0.45)", marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
        </div>
      </Tilt>
    </Reveal>
  );
}

/* \u2500\u2500 Mini bar chart \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function MiniBarChart({ data, color = "#00C896" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 56 }}>
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

/* \u2500\u2500 Status badge: colored dot + icon + label \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const STATUS_COLORS: Record<string, string> = {
  success: "#00C896", failed: "#FB7185", running: "#38BDF8", pending: "#FBBF24",
  completed: "#00C896", error: "#FB7185", cancelled: "rgba(232,238,255,0.3)",
};
const STATUS_ICONS: Record<string, any> = {
  success: CheckCircle2, failed: XCircle, running: RefreshCw, pending: Clock,
  completed: CheckCircle2, error: XCircle, cancelled: XIcon,
};

function StatusBadge({ status }: { status: string }) {
  const key   = (status || "pending").toLowerCase();
  const color = STATUS_COLORS[key] ?? "rgba(232,238,255,0.3)";
  const Icon  = STATUS_ICONS[key]  ?? Clock;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${color}12`, borderRadius: 100, padding: "3px 8px", border: `1px solid ${color}22` }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <Icon size={9} color={color} style={key === "running" ? { animation: "spin-slow 1s linear infinite" } : undefined} />
      <span style={{ fontSize: 9, fontWeight: 800, color, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>{key}</span>
    </div>
  );
}

/* \u2500\u2500 Row action dropdown \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function RowActionMenu({ run, onViewDetails }: { run: any; onViewDetails: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const runId = run.id || run.run_id;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const actions: { label: string; icon: any; action: () => void; danger?: boolean }[] = [
    { label: "View Details", icon: Eye,       action: () => { onViewDetails(); setOpen(false); } },
    { label: "Re-run",       icon: RotateCcw, action: () => { if (runId) nav(`/executions/${runId}`); setOpen(false); } },
    { label: "View Logs",    icon: FileText,  action: () => { if (runId) nav(`/executions/${runId}`); setOpen(false); } },
    { label: "Cancel",       icon: XIcon,     action: () => setOpen(false), danger: true },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, color: "rgba(232,238,255,0.3)", display: "flex", alignItems: "center", transition: "all 0.14s" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "#E8EEFF"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "rgba(232,238,255,0.3)"; }}
      >
        <MoreVertical size={13} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 300, background: "#0D1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "4px", minWidth: 152, boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }}>
          {actions.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={e => { e.stopPropagation(); a.action(); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, color: a.danger ? "#FB7185" : "rgba(232,238,255,0.7)", fontSize: 12, fontFamily: "'DM Sans',sans-serif", textAlign: "left", transition: "background 0.12s" }}
                onMouseEnter={e => (e.currentTarget.style.background = a.danger ? "rgba(251,113,133,0.08)" : "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <Icon size={11} /> {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* \u2500\u2500 Recent Workflow Runs table \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function RecentRunsTable({ runs, loading, onRowClick }: { runs: any[]; loading: boolean; onRowClick: (run: any) => void }) {
  function fmtTs(ts: any): string {
    if (!ts) return "\u2014";
    const d = new Date(typeof ts === "number" ? ts : ts);
    if (isNaN(d.getTime())) return "\u2014";
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function fmtDur(ms: any): string {
    if (ms === null || ms === undefined) return "\u2014";
    const n = Number(ms);
    if (isNaN(n)) return "\u2014";
    if (n < 1000)  return `${n}ms`;
    if (n < 60000) return `${(n / 1000).toFixed(1)}s`;
    return `${Math.floor(n / 60000)}m ${Math.floor((n % 60000) / 1000)}s`;
  }
  function shortId(id: any): string {
    const s = String(id ?? "");
    if (!s || s === "undefined" || s === "null") return "\u2014";
    return s.length > 10 ? `\u2026${s.slice(-8)}` : s;
  }

  const COL = "90px 1fr 118px 80px 100px 1fr 32px";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Recent Workflow Runs</div>
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>EXECUTION HISTORY · LIVE DATA</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: COL, gap: 8, padding: "5px 10px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}>
        {["RUN ID", "WORKFLOW", "STARTED", "DURATION", "STATUS", "ERROR", ""].map(h => (
          <div key={h} style={{ fontSize: 9, fontWeight: 800, color: "rgba(232,238,255,0.22)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em" }}>{h}</div>
        ))}
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          {[0,1,2,3].map(i => <Skeleton key={i} h={42} radius={8} />)}
        </div>
      ) : runs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 0", color: "rgba(232,238,255,0.18)", fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>No recent runs yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {runs.slice(0, 10).map((run: any, i: number) => {
            const status = (run.status || "pending").toLowerCase();
            const sColor = STATUS_COLORS[status] ?? "rgba(232,238,255,0.3)";
            return (
              <motion.div
                key={run.id || run.run_id || i}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                onClick={() => onRowClick(run)}
                style={{ display: "grid", gridTemplateColumns: COL, gap: 8, alignItems: "center", padding: "10px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.14s, border-color 0.14s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${sColor}06`; (e.currentTarget as HTMLElement).style.borderColor = `${sColor}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.04)"; }}
              >
                <div style={{ fontSize: 10, color: "#38BDF8", fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortId(run.id || run.run_id)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.workflow_name || run.name || "Workflow run"}</div>
                <div style={{ fontSize: 10, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>{fmtTs(run.started_at || run.created_at || run.ts)}</div>
                <div style={{ fontSize: 10, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace" }}>{fmtDur(run.duration || run.duration_ms)}</div>
                <div><StatusBadge status={status} /></div>
                <div style={{ fontSize: 10, color: "#FB7185", fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: run.error ? 1 : 0.15 }}>{run.error || "none"}</div>
                <div onClick={e => e.stopPropagation()}><RowActionMenu run={run} onViewDetails={() => onRowClick(run)} /></div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* \u2500\u2500 Live event helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const EVENT_META: Record<LiveEventType, { icon: any; color: string }> = {
  workflow_run:       { icon: GitBranch, color: "#00C896" },
  workflow_run_start: { icon: Play,      color: "#38BDF8" },
  workflow_run_end:   { icon: GitBranch, color: "#00C896" },
  automation_trigger: { icon: Zap,       color: "#A78BFA" },
  status_change:      { icon: Activity,  color: "#FBBF24" },
  connection_event:   { icon: Link2,     color: "#38BDF8" },
  generic:            { icon: Radio,     color: "rgba(232,238,255,0.4)" },
};
const LIVE_STATUS_COLORS: Record<LiveEventStatus, string> = {
  success: "#00C896", failed: "#FB7185", running: "#38BDF8", pending: "#FBBF24",
};
const LIVE_STATUS_ICONS: Record<LiveEventStatus, any> = {
  success: CheckCircle2, failed: XCircle, running: RefreshCw, pending: Clock,
};

function relTime(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 5)    return "just now";
  if (d < 60)   return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

/* \u2500\u2500 Event row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function EventRow({ ev, isNew, onClick }: { ev: LiveEvent; isNew: boolean; onClick?: () => void }) {
  const meta   = EVENT_META[ev.type] ?? EVENT_META.generic;
  const sColor = LIVE_STATUS_COLORS[ev.status];
  const SIcon  = LIVE_STATUS_ICONS[ev.status];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      data-testid={`live-event-${ev.id}`}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", background: isNew ? `${sColor}08` : "rgba(255,255,255,0.015)", borderRadius: 10, border: `1px solid ${isNew ? sColor + "22" : "rgba(255,255,255,0.04)"}`, transition: "background 1.5s ease, border-color 1.5s ease", position: "relative", overflow: "hidden", cursor: onClick ? "pointer" : "default" }}
    >
      {isNew && (
        <motion.div initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} transition={{ duration: 1.2, delay: 0.1 }}
          style={{ position: "absolute", inset: 0, background: `${sColor}12`, borderRadius: 10, pointerEvents: "none" }} />
      )}
      <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: `${meta.color}12`, border: `1px solid ${meta.color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <meta.icon size={11} color={meta.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#E8EEFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
        {ev.detail && <div style={{ fontSize: 9, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.detail}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: sColor, flexShrink: 0 }} />
          <SIcon size={9} color={sColor} style={ev.status === "running" ? { animation: "spin-slow 1s linear infinite" } : undefined} />
          <span style={{ fontSize: 8, fontWeight: 800, color: sColor, fontFamily: "'DM Mono',monospace" }}>{ev.status.toUpperCase()}</span>
        </div>
        <span style={{ fontSize: 8, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>{relTime(ev.ts)}</span>
      </div>
    </motion.div>
  );
}

/* \u2500\u2500 Live event feed panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function LiveEventFeed({ onEventClick }: { onEventClick: (ev: any) => void }) {
  const { events, isConnected, clearEvents } = useLiveEvents();
  const hasRunning  = events.some(e => e.status === "running");
  const newEventIds = events.slice(0, 3).map(e => e.id);
  useOrgExecutionFeed(20); // keep org feed wired for parent components

  return (
    <div className="af-glass" style={{ borderRadius: 18, padding: "20px", overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.06)" }}>
      <ExecutionGlowBar running={hasRunning} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Live Orchestration</div>
          <div style={{ fontSize: 9, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>REALTIME EVENTS</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PulseRing active={isConnected} color="#00C896" size={8} />
          {events.length > 0 && (
            <button onClick={clearEvents} data-testid="btn-clear-events" style={{ fontSize: 9, color: "rgba(232,238,255,0.3)", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>clear</button>
          )}
        </div>
      </div>
      <OrchestrationPulse className="orchestration-pulse-strip" />
      <div style={{ marginBottom: 10 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 260, overflowY: "auto", scrollbarWidth: "none" }}>
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 0", gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Radio size={14} color="rgba(0,200,150,0.4)" />
              </div>
              <div style={{ fontSize: 11, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Sans',sans-serif", textAlign: "center" }}>
                {isConnected ? "Listening for orchestration events\u2026" : "Waiting for connection\u2026"}
              </div>
            </motion.div>
          ) : (
            events.map(ev => <EventRow key={ev.id} ev={ev} isNew={newEventIds.includes(ev.id)} onClick={() => onEventClick(ev)} />)
          )}
        </AnimatePresence>
      </div>
      {events.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 9, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Mono',monospace" }}>
          {events.length} event{events.length !== 1 ? "s" : ""} · live feed
        </div>
      )}
    </div>
  );
}

/* \u2500\u2500 Compact workflow list row (dot + two-line text + hover) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function WorkflowCompactRow({ wf, onClick }: { wf: any; onClick: () => void }) {
  const dotColor = wf.is_active ? "#00C896" : "rgba(255,255,255,0.15)";
  return (
    <button
      data-testid={`workflow-card-${wf.id}`}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", textAlign: "left", width: "100%", transition: "background 0.15s, border-color 0.15s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,200,150,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,200,150,0.12)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.04)"; }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0, boxShadow: wf.is_active ? `0 0 5px ${dotColor}` : "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{wf.name}</div>
        <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>{wf.trigger_type || "manual"}</div>
      </div>
      <div style={{ fontSize: 10, color: wf.is_active ? "#00C896" : "rgba(232,238,255,0.22)", fontWeight: 700, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{wf.is_active ? "ACTIVE" : "PAUSED"}</div>
      <Play size={10} color="rgba(232,238,255,0.2)" />
    </button>
  );
}

/* \u2500\u2500 Dashboard \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
export default function Dashboard() {
  const { user } = useAuth();
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
  const recentRuns  = (analytics as any)?.recent_runs  || [];
  const events7d    = (analytics as any)?.events_7d    || [];
  const totalEvents = (analytics as any)?.total_events || (userStats as any)?.total_events || 0;

  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const statsLoading = loadingAnalytics || loadingStats;

  return (
    <PageTransition variant="slide">
      <TrialCountdownBanner />
      <div style={{ padding: "clamp(16px, 3vw, 32px)", maxWidth: 1440, margin: "0 auto", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 600, height: 600, background: "radial-gradient(ellipse at 80% 10%, rgba(0,200,150,0.05) 0%, transparent 60%)", pointerEvents: "none" }} />
        <Particles opacity={0.2} count={20} />

        {/* Header */}
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>COMMAND CENTER</div>
            <h1 style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", marginBottom: 6 }}>
              Welcome, {user?.name?.split(" ")[0] || "there"} 👋
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Sans',sans-serif" }}>
              Your orchestration is running. Here's what's happening.
            </p>
          </div>
        </Reveal>

        {/* Metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(200px,100%),1fr))", gap: 16, marginBottom: 28 }}>
          <StatCard loading={statsLoading || loadingWF}    label="Active Workflows"   value={activeWF}    color="#00C896" icon={GitBranch} sub={`${workflows.length} total`}   delay={0}   />
          <StatCard loading={statsLoading || loadingAM}    label="Active Automations" value={activeAM}    color="#38BDF8" icon={Zap}       sub={`${automations.length} total`} delay={60}  />
          <StatCard loading={statsLoading}                 label="Events (7d)"        value={totalEvents} color="#A78BFA" icon={Activity}  sub="+12%"                          delay={120} />
          <StatCard loading={statsLoading} label="AI Requests" value={(userStats as any)?.ai_requests || (analytics as any)?.ai_requests || "\u2014"} color="#FBBF24" icon={Bot} sub="today" delay={180} />
        </div>

        {/* Two-column body */}
        <div className="af-body-grid" style={{ display: "grid", gap: 20, marginBottom: 24, alignItems: "start" }}>

          {/* LEFT: Event Volume chart + Detailed Runs Table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Reveal delay={100}>
              <div className="af-glass" style={{ borderRadius: 18, padding: "24px", overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Event Volume</div>
                    <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>LAST 7 DAYS</div>
                  </div>
                  <TrendingUp size={16} color="#00C896" />
                </div>
                {loadingAnalytics ? <Skeleton w="100%" h={56} radius={6} /> : (
                  <MiniBarChart data={events7d.length > 0 ? events7d : [12, 18, 9, 24, 31, 28, 40]} color="#00C896" />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                    <span key={d} style={{ fontSize: 9, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>{d}</span>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="af-glass" style={{ borderRadius: 18, padding: "24px", border: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
                <RecentRunsTable runs={recentRuns} loading={loadingAnalytics} onRowClick={r => setSelectedEvent(r as any)} />
              </div>
            </Reveal>
          </div>

          {/* RIGHT: Live Events + Quick Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Reveal delay={140}>
              <LiveEventFeed onEventClick={setSelectedEvent} />
            </Reveal>

            <Reveal delay={210}>
              <div className="af-glass" style={{ borderRadius: 18, padding: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 12 }}>QUICK ACTIONS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "New Workflow",   icon: GitBranch, path: "/workflows",   color: "#00C896" },
                    { label: "New Automation", icon: Zap,       path: "/automations", color: "#38BDF8" },
                    { label: "Ask AI",         icon: Bot,       path: "/ai-chat",          color: "#A78BFA" },
                    { label: "View Plans",     icon: Activity,  path: "/plans",       color: "#FBBF24" },
                  ].map(a => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.label}
                        data-testid={`quick-action-${a.label.toLowerCase().replace(/\s/g, "-")}`}
                        onClick={() => nav(a.path)}
                        style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${a.color}25`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, transition: "all 0.18s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}10`; (e.currentTarget as HTMLElement).style.borderColor = `${a.color}40`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = `${a.color}25`; }}
                      >
                        <Icon size={14} color={a.color} /> {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Your Workflows — full width */}
        <Reveal delay={270}>
          <div className="af-glass" style={{ borderRadius: 18, padding: "24px", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Your Workflows</div>
                {loadingWF ? <Skeleton w={60} h={10} /> : <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{workflows.length} TOTAL</div>}
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(280px,100%),1fr))", gap: 8 }}>
                {workflows.slice(0, 6).map((wf: any) => (
                  <WorkflowCompactRow key={wf.id} wf={wf} onClick={() => nav(`/workflows/${wf.id}`)} />
                ))}
              </div>
            )}
          </div>
        </Reveal>

        {/* Responsive grid */}
        <style>{`
          .af-body-grid { grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); }
          @media (max-width: 1000px) { .af-body-grid { grid-template-columns: 1fr; } }
          .orchestration-pulse-strip { margin-bottom: 2px; }
        `}</style>

        {/* Phase 6 */}
        <OrgHealthSummary />
        {/* Phase 4 */}
        <OrchestrationInsightCard />
        <div style={{ marginTop: 16 }}><PredictiveInsightsPanel /></div>
        {/* Phase 8 */}
        <div style={{ marginTop: 16 }}><TeamExecutionFeed onSelectRun={run => setSelectedEvent(run as any)} /></div>
        <div style={{ marginTop: 20 }}><GlobalExecutionTimeline /></div>
        <div style={{ marginTop: 16 }}><HistoricalTimeline /></div>
        <div style={{ marginTop: 12 }}><ReplayGapIndicator /></div>

        <ExecutionDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      </div>
    </PageTransition>
  );
}
