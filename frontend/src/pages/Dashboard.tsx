/**
 * Dashboard — Enterprise Redesign
 *
 * All existing hooks, API calls, and component imports preserved exactly.
 * Only the visual layer has changed — layout, typography, cards, charts.
 *
 * New visual features:
 *   - 5-KPI top bar with sparkline area charts (recharts)
 *   - 3-column mid section: Workflow Executions chart · System Health · Recent Activity
 *   - Top Workflows ranked list with progress bars
 *   - Resource usage donut-style meters
 *   - All existing Phase 4–8 components (intelligence, timeline, team feed) preserved below
 */

import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { analyticsAPI, workflowsAPI, automationsAPI, systemHealthAPI, resourceUsageAPI } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import { Reveal } from "../components/Reveal";
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
import { TrialCountdownBanner } from "../components/TrialCountdownBanner";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from "recharts";
import { ExecutionVolumeChart } from "../components/analytics/ExecutionCharts";
import { RankedTopWorkflows } from "../components/analytics/RankedTopWorkflows";
import { analyticsApi } from "../api/analyticsApi";
import {
  GitBranch, Zap, Activity, Bot, ArrowRight, Play, TrendingUp, TrendingDown,
  Clock, CheckCircle2, XCircle, RefreshCw, Radio, Link2,
  MoreVertical, Eye, RotateCcw, FileText, X as XIcon,
  Shield, ShieldCheck, AlertTriangle, Database, Cpu, Server,
  BarChart2, Users, Plus,
} from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:       "#060810",
  surface:  "#0C0F1A",
  raised:   "#111520",
  border:   "rgba(255,255,255,0.06)",
  borderHv: "rgba(255,255,255,0.11)",
  text:     "#E2E8FF",
  muted:    "rgba(226,232,255,0.45)",
  faint:    "rgba(226,232,255,0.22)",
  green:    "#00C896",
  blue:     "#38BDF8",
  purple:   "#A78BFA",
  amber:    "#FBBF24",
  red:      "#FB7185",
};

/* ── Skeleton ──────────────────────────────────────────────────────── */
function Sk({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "rgba(255,255,255,0.05)",
      animation: "af-skeleton-pulse 1.8s ease-in-out infinite",
    }} />
  );
}

/* ── Section header ────────────────────────────────────────────────── */
function SectionHeader({ title, sub, action, onAction }: {
  title: string; sub?: string; action?: string; onAction?: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.02em" }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginTop: 1 }}>{sub}</div>}
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            fontSize: 12, color: C.purple, background: "rgba(167,139,250,0.08)",
            border: "1px solid rgba(167,139,250,0.2)", borderRadius: 7,
            padding: "5px 11px", cursor: "pointer", fontWeight: 600,
            fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", gap: 5,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.14)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.08)"; }}
        >
          {action} <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}

/* ── Card wrapper ──────────────────────────────────────────────────── */
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "20px",
      minWidth: 0,
      overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Sparkline ─────────────────────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone" dataKey="v"
          stroke={color} strokeWidth={1.5}
          fill={`url(#spark-${color.replace("#", "")})`}
          dot={false} isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── KPI Card ──────────────────────────────────────────────────────── */
function KpiCard({ label, value, change, changeLabel, color, icon: Icon, sparkData, loading }: {
  label: string; value: string | number; change?: number;
  changeLabel?: string; color: string; icon: any;
  sparkData?: number[]; loading?: boolean;
}) {
  const positive = (change ?? 0) >= 0;
  if (loading) {
    return (
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <Sk w={32} h={32} r={8} />
          <Sk w={52} h={20} r={100} />
        </div>
        <Sk w="50%" h={32} r={6} />
        <div style={{ marginTop: 6 }}><Sk w="65%" h={12} /></div>
        <div style={{ marginTop: 10 }}><Sk w="100%" h={44} r={4} /></div>
      </Card>
    );
  }
  return (
    <Card style={{ position: "relative", overflow: "hidden" }}>
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `${color}12`,
          border: `1px solid ${color}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={15} color={color} />
        </div>
        {change !== undefined && (
          <div style={{
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: 700,
            color: positive ? C.green : C.red,
            background: positive ? "rgba(0,200,150,0.08)" : "rgba(251,113,133,0.08)",
            borderRadius: 100, padding: "3px 8px",
            fontFamily: "'DM Mono',monospace",
          }}>
            {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div style={{
        fontSize: "1.75rem", fontWeight: 900,
        fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em",
        color: C.text, lineHeight: 1,
      }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>
        {label}
        {changeLabel && (
          <span style={{ color: C.faint, marginLeft: 4 }}>{changeLabel}</span>
        )}
      </div>
      {sparkData && sparkData.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Sparkline data={sparkData} color={color} />
        </div>
      )}
    </Card>
  );
}

/* ── Status badge ──────────────────────────────────────────────────── */
const STATUS_C: Record<string, string> = {
  success: C.green, failed: C.red, running: C.blue, pending: C.amber,
  completed: C.green, error: C.red, cancelled: "rgba(226,232,255,0.3)",
};
const STATUS_I: Record<string, any> = {
  success: CheckCircle2, failed: XCircle, running: RefreshCw,
  pending: Clock, completed: CheckCircle2, error: XCircle, cancelled: XIcon,
};
function StatusBadge({ status }: { status: string }) {
  const key   = (status || "pending").toLowerCase();
  const color = STATUS_C[key] ?? "rgba(226,232,255,0.3)";
  const Icon  = STATUS_I[key] ?? Clock;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: `${color}12`, borderRadius: 100, padding: "3px 8px",
      border: `1px solid ${color}20`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
      <Icon size={9} color={color}
        style={key === "running" ? { animation: "spin-slow 1s linear infinite" } : undefined}
      />
      <span style={{ fontSize: 9, fontWeight: 800, color, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>{key}</span>
    </span>
  );
}

/* ── Row action menu ───────────────────────────────────────────────── */
function RowActionMenu({ run, onViewDetails }: { run: any; onViewDetails: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const runId = run.id || run.run_id;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const actions = [
    { label: t('dashboard.action_view_details'), icon: Eye,       fn: () => { onViewDetails(); setOpen(false); } },
    { label: t('dashboard.action_rerun'),       icon: RotateCcw, fn: () => { if (runId) nav(`/executions/${runId}`); setOpen(false); } },
    { label: t('dashboard.action_view_logs'),    icon: FileText,  fn: () => { if (runId) nav(`/executions/${runId}`); setOpen(false); } },
    { label: t('dashboard.action_cancel'),       icon: XIcon,     fn: () => setOpen(false), danger: true },
  ];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          padding: "4px 6px", borderRadius: 6, color: C.faint,
          display: "flex", alignItems: "center", transition: "all 0.14s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = C.text; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = C.faint; }}
      >
        <MoreVertical size={13} />
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 300,
          background: "#0C0F1A", border: `1px solid ${C.borderHv}`, borderRadius: 10,
          padding: "4px", minWidth: 152, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          {actions.map(a => (
            <button
              key={a.label}
              onClick={e => { e.stopPropagation(); a.fn(); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "8px 10px",
                background: "none", border: "none", cursor: "pointer",
                borderRadius: 7, color: a.danger ? C.red : C.muted,
                fontSize: 12, fontFamily: "'DM Sans',sans-serif",
                textAlign: "left", transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = a.danger ? "rgba(251,113,133,0.08)" : "rgba(255,255,255,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <a.icon size={11} /> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Runs table ────────────────────────────────────────────────────── */
function RecentRunsTable({ runs, loading, onRowClick }: {
  runs: any[]; loading: boolean; onRowClick: (r: any) => void;
}) {
  const { t } = useTranslation();
  const fmtTs = (ts: any) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const fmtDur = (ms: any) => {
    if (ms === null || ms === undefined) return "—";
    const n = Number(ms);
    if (isNaN(n)) return "—";
    if (n < 1000) return `${n}ms`;
    if (n < 60000) return `${(n / 1000).toFixed(1)}s`;
    return `${Math.floor(n / 60000)}m ${Math.floor((n % 60000) / 1000)}s`;
  };
  const shortId = (id: any) => { const s = String(id ?? ""); return s.length > 10 ? `…${s.slice(-8)}` : s || "—"; };
  const COL = "72px minmax(0,1fr) 92px 60px 88px minmax(0,1fr) 28px";

  return (
    <div className="af-runs-table" style={{ minWidth: 0 }}>
      <SectionHeader title={t('dashboard.recent_workflow_runs')} sub={t('dashboard.execution_history_live')} />
      {/* Header row — hidden on narrow screens in favor of stacked cards */}
      <div className="af-runs-header" style={{
        display: "grid", gridTemplateColumns: COL,
        gap: 8, padding: "4px 10px 8px", minWidth: 0,
        borderBottom: `1px solid ${C.border}`, marginBottom: 4,
      }}>
        {[
          t('dashboard.col_run_id'), t('dashboard.col_workflow'), t('dashboard.col_started'),
          t('dashboard.col_duration'), t('dashboard.col_status'), t('dashboard.col_error'), "",
        ].map((h, idx) => (
          <div key={`${h}-${idx}`} style={{ fontSize: 9, fontWeight: 800, color: C.faint, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{h}</div>
        ))}
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
          {[0, 1, 2, 3].map(i => <Sk key={i} h={40} r={8} />)}
        </div>
      ) : runs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.faint, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
          {t('dashboard.no_recent_runs')}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          {runs.slice(0, 10).map((run: any, i: number) => {
            const st = (run.status || "pending").toLowerCase();
            const sc = STATUS_C[st] ?? "rgba(226,232,255,0.3)";
            return (
              <motion.div
                key={run.id || run.run_id || i}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035, duration: 0.18 }}
                onClick={() => onRowClick(run)}
                className="af-runs-row"
                style={{
                  display: "grid", gridTemplateColumns: COL, gap: 8, minWidth: 0,
                  alignItems: "center", padding: "9px 10px",
                  background: "rgba(255,255,255,0.02)", borderRadius: 8,
                  border: `1px solid rgba(255,255,255,0.04)`, cursor: "pointer",
                  transition: "background 0.14s, border-color 0.14s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${sc}06`; (e.currentTarget as HTMLElement).style.borderColor = `${sc}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.04)"; }}
              >
                <div className="af-runs-id" style={{ fontSize: 10, color: C.blue, fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{shortId(run.id || run.run_id)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{run.workflow_name || run.name || t('dashboard.workflow_run_fallback')}</div>
                <div className="af-runs-started" style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{fmtTs(run.started_at || run.created_at)}</div>
                <div className="af-runs-dur" style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{fmtDur(run.duration || run.duration_ms)}</div>
                <div style={{ minWidth: 0, overflow: "hidden" }}><StatusBadge status={st} /></div>
                <div className="af-runs-err" style={{ fontSize: 10, color: C.red, fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: run.error ? 1 : 0.15, minWidth: 0 }}>{run.error || t('dashboard.error_none')}</div>
                <div onClick={e => e.stopPropagation()} style={{ minWidth: 0 }}><RowActionMenu run={run} onViewDetails={() => onRowClick(run)} /></div>
              </motion.div>
            );
          })}
        </div>
      )}
      <style>{`
        @media (max-width: 620px) {
          .af-runs-header { display: none !important; }
          .af-runs-row {
            grid-template-columns: 1fr auto !important;
            grid-template-areas: "wf status" "id id" "meta meta" "err err";
            row-gap: 4px !important;
          }
          .af-runs-row > div:nth-child(1) { grid-area: id; }
          .af-runs-row > div:nth-child(2) { grid-area: wf; }
          .af-runs-row > div:nth-child(3) { grid-area: meta; }
          .af-runs-row > div:nth-child(4) { display: none; }
          .af-runs-row > div:nth-child(5) { grid-area: status; justify-self: end; }
          .af-runs-row > div:nth-child(6) { grid-area: err; }
          .af-runs-row > div:nth-child(7) { display: none; }
        }
      `}</style>
    </div>
  );
}

/* ── Live event helpers ─────────────────────────────────────────────── */
const EV_META: Record<LiveEventType, { icon: any; color: string }> = {
  workflow_run:       { icon: GitBranch, color: C.green },
  workflow_run_start: { icon: Play,      color: C.blue },
  workflow_run_end:   { icon: GitBranch, color: C.green },
  automation_trigger: { icon: Zap,       color: C.purple },
  status_change:      { icon: Activity,  color: C.amber },
  connection_event:   { icon: Link2,     color: C.blue },
  generic:            { icon: Radio,     color: C.faint },
};
const LS_C: Record<LiveEventStatus, string> = { success: C.green, failed: C.red, running: C.blue, pending: C.amber };
const LS_I: Record<LiveEventStatus, any>    = { success: CheckCircle2, failed: XCircle, running: RefreshCw, pending: Clock };

function relTime(ts: number, t: (key: string, opts?: any) => string) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 5) return t('dashboard.just_now');
  if (d < 60) return t('dashboard.seconds_ago', { count: d });
  if (d < 3600) return t('dashboard.minutes_ago', { count: Math.floor(d / 60) });
  return t('dashboard.hours_ago', { count: Math.floor(d / 3600) });
}

/* ── Live event row ────────────────────────────────────────────────── */
function EventRow({ ev, isNew, onClick }: { ev: LiveEvent; isNew: boolean; onClick?: () => void }) {
  const { t } = useTranslation();
  const meta  = EV_META[ev.type] ?? EV_META.generic;
  const sc    = LS_C[ev.status];
  const SIcon = LS_I[ev.status];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "9px 10px",
        background: isNew ? `${sc}08` : "rgba(255,255,255,0.015)",
        borderRadius: 10,
        border: `1px solid ${isNew ? sc + "22" : "rgba(255,255,255,0.04)"}`,
        transition: "background 1.5s ease, border-color 1.5s ease",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        background: `${meta.color}10`, border: `1px solid ${meta.color}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <meta.icon size={11} color={meta.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
        {ev.detail && <div style={{ fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.detail}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: sc, display: "inline-block" }} />
          <SIcon size={9} color={sc} style={ev.status === "running" ? { animation: "spin-slow 1s linear infinite" } : undefined} />
          <span style={{ fontSize: 8, fontWeight: 800, color: sc, fontFamily: "'DM Mono',monospace" }}>{ev.status.toUpperCase()}</span>
        </div>
        <span style={{ fontSize: 8, color: C.faint, fontFamily: "'DM Mono',monospace" }}>{relTime(ev.ts, t)}</span>
      </div>
    </motion.div>
  );
}

/* ── Live event feed ───────────────────────────────────────────────── */
function LiveEventFeed({ onEventClick }: { onEventClick: (ev: any) => void }) {
  const { t } = useTranslation();
  const { events, isConnected, clearEvents } = useLiveEvents();
  const hasRunning  = events.some(e => e.status === "running");
  const newEventIds = events.slice(0, 3).map(e => e.id);
  useOrgExecutionFeed(20);

  return (
    <Card style={{ overflow: "hidden", position: "relative" }}>
      <ExecutionGlowBar running={hasRunning} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.02em" }}>{t('dashboard.live_orchestration')}</div>
          <div style={{ fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em" }}>{t('dashboard.realtime_events')}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PulseRing active={isConnected} color={C.green} size={8} />
          {events.length > 0 && (
            <button
              onClick={clearEvents}
              style={{ fontSize: 9, color: C.faint, background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Mono',monospace" }}
            >
              {t('dashboard.clear')}
            </button>
          )}
        </div>
      </div>
      <OrchestrationPulse className="orchestration-pulse-strip" />
      <div style={{ marginBottom: 8 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto", scrollbarWidth: "none" }}>
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <motion.div
              key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 8 }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.14)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Radio size={14} color="rgba(0,200,150,0.4)" />
              </div>
              <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Sans',sans-serif", textAlign: "center" }}>
                {isConnected ? t('dashboard.listening_for_events') : t('dashboard.waiting_for_connection')}
              </div>
            </motion.div>
          ) : (
            events.map(ev => (
              <EventRow key={ev.id} ev={ev} isNew={newEventIds.includes(ev.id)} onClick={() => onEventClick(ev)} />
            ))
          )}
        </AnimatePresence>
      </div>
      {events.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
          {events.length} {events.length !== 1 ? t('dashboard.event_count_plural') : t('dashboard.event_count_singular')} · {t('dashboard.live_feed')}
        </div>
      )}
    </Card>
  );
}

/* ── System Health Panel ───────────────────────────────────────────── */
// FIX: this card used to render a static SERVICES array where every
// single entry was hardcoded to render the "Operational" badge — meaning
// the card claimed all 6 services were healthy regardless of actual
// system state, even during a real outage. It now calls
// GET /api/system/health/summary (added in routes/health.js), which
// performs real checks: a live DB query, a Redis ping, BullMQ queue
// health, WebSocket stats, and AI-provider failure tracking — and
// renders whatever that endpoint actually reports.
const SERVICE_META: Record<string, { icon: any; labelKey: string }> = {
  api_gateway:       { icon: Server,    labelKey: "dashboard.svc_api_gateway" },
  workflow_engine:   { icon: GitBranch, labelKey: "dashboard.svc_workflow_engine" },
  ai_services:       { icon: Cpu,       labelKey: "dashboard.svc_ai_services" },
  database:          { icon: Database,  labelKey: "dashboard.svc_database" },
  redis_cluster:     { icon: Activity,  labelKey: "dashboard.svc_redis_cluster" },
  websocket_gateway: { icon: Radio,     labelKey: "dashboard.svc_websocket_gateway" },
};

const STATUS_BADGE_COLOR: Record<string, string> = {
  operational: C.green,
  degraded:    C.amber,
  down:        C.red,
  unknown:     C.faint,
};

function SystemHealth() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["system-health-summary"],
    queryFn:  () => systemHealthAPI.summary().then((d: any) => d.services || []),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const services: Array<{ key: string; status: string }> = data ?? [];
  const statusLabelKey: Record<string, string> = {
    operational: "dashboard.status_operational",
    degraded:    "dashboard.status_degraded",
    down:        "dashboard.status_down",
    unknown:     "dashboard.status_unknown",
  };

  return (
    <Card>
      <SectionHeader title={t('dashboard.system_health')} sub={t('dashboard.all_services')} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {isLoading ? (
          [0, 1, 2, 3, 4, 5].map(i => <Sk key={i} h={40} r={8} />)
        ) : (
          Object.keys(SERVICE_META).map(key => {
            const meta = SERVICE_META[key];
            const svc = services.find(s => s.key === key);
            const status = svc?.status ?? "unknown";
            const color = STATUS_BADGE_COLOR[status] ?? C.faint;
            return (
              <div
                key={key}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", borderRadius: 8,
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: `${color}14`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <meta.icon size={11} color={color} />
                  </div>
                  <span style={{ fontSize: 12, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>{t(meta.labelKey)}</span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color,
                  background: `${color}14`, border: `1px solid ${color}30`,
                  borderRadius: 100, padding: "2px 8px",
                  fontFamily: "'DM Mono',monospace",
                }}>
                  {t(statusLabelKey[status] ?? "dashboard.status_unknown")}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

/* ── Quick Actions ─────────────────────────────────────────────────── */
const ACTIONS = [
  { labelKey: "dashboard.qa_new_workflow",   icon: GitBranch, path: "/workflows",   color: C.green },
  { labelKey: "dashboard.qa_new_automation", icon: Zap,       path: "/automations", color: C.blue },
  { labelKey: "dashboard.qa_ask_ai",         icon: Bot,       path: "/ai-chat",     color: C.purple },
  { labelKey: "dashboard.qa_view_plans",     icon: BarChart2, path: "/plans",       color: C.amber },
];

function QuickActions({ onNav }: { onNav: (path: string) => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 12 }}>
        {t('dashboard.quick_actions')}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ACTIONS.map(a => {
          const label = t(a.labelKey);
          return (
            <button
              key={a.labelKey}
              data-testid={`quick-action-${label.toLowerCase().replace(/\s/g, "-")}`}
              onClick={() => onNav(a.path)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: `${a.color}08`, border: `1px solid ${a.color}20`,
                borderRadius: 9, padding: "10px 14px", cursor: "pointer",
                color: C.text, fontFamily: "'DM Sans',sans-serif",
                fontSize: 13, fontWeight: 500, transition: "all 0.15s", textAlign: "left",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}14`; (e.currentTarget as HTMLElement).style.borderColor = `${a.color}35`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}08`; (e.currentTarget as HTMLElement).style.borderColor = `${a.color}20`; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: `${a.color}12`, border: `1px solid ${a.color}25`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <a.icon size={13} color={a.color} />
              </div>
              {label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Top Workflows ─────────────────────────────────────────────────── */
function TopWorkflows({ workflows, loading, onNav }: { workflows: any[]; loading: boolean; onNav: (p: string) => void }) {
  const { t } = useTranslation();
  const active = workflows.filter((w: any) => w.is_active);
  return (
    <Card>
      <SectionHeader title={t('dashboard.your_workflows')} sub={`${workflows.length} ${t('dashboard.total_suffix')}`} action={t('dashboard.view_all')} onAction={() => onNav("/workflows")} />
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[0, 1, 2, 3].map(i => <Sk key={i} h={44} r={8} />)}
        </div>
      ) : workflows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 0", color: C.faint, fontSize: 13 }}>
          {t('dashboard.no_workflows_yet')}{" "}
          <button onClick={() => onNav("/workflows")} style={{ background: "none", border: "none", color: C.purple, cursor: "pointer", fontWeight: 600 }}>
            {t('dashboard.create_your_first')}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {workflows.slice(0, 5).map((wf: any, i: number) => {
            const isActive = wf.is_active;
            const color = isActive ? C.green : C.faint;
            return (
              <button
                key={wf.id}
                data-testid={`workflow-card-${wf.id}`}
                onClick={() => onNav(`/workflows/${wf.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", background: "rgba(255,255,255,0.02)",
                  borderRadius: 9, border: `1px solid ${C.border}`, cursor: "pointer",
                  textAlign: "left", width: "100%", transition: "all 0.14s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.05)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: `${color}10`, border: `1px solid ${color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color, fontFamily: "'DM Mono',monospace" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{wf.name}</div>
                  <div style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace" }}>{wf.trigger_type || t('dashboard.trigger_manual')}</div>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 800, color,
                  background: `${color}10`, border: `1px solid ${color}20`,
                  borderRadius: 100, padding: "2px 7px",
                  fontFamily: "'DM Mono',monospace",
                }}>
                  {isActive ? t('dashboard.status_active') : t('dashboard.status_paused')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ── Resource Usage ────────────────────────────────────────────────── */
function ResourceMeter({ label, percent, displayValue, color, unlimitedLabel }: {
  label: string; percent: number | null; displayValue: string; color: string; unlimitedLabel: string;
}) {
  const pct = percent ?? 0;
  const r = 26, stroke = 5, circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 70, height: 70 }}>
        <svg width={70} height={70} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={35} cy={35} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          {percent !== null && (
            <circle
              cx={35} cy={35} r={r} fill="none"
              stroke={color} strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circ - filled}`}
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          )}
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: percent !== null ? 14 : 10, fontWeight: 800, color: C.text, fontFamily: "'Syne',sans-serif" }}>
            {percent !== null ? `${percent}%` : "∞"}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
        <div style={{ fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace", marginTop: 1 }}>
          {percent !== null ? displayValue : unlimitedLabel}
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { t } = useTranslation();
  const { activeOrg } = useOrg();

  useEffect(() => {
    if (!activeOrg?.id) return;
    // Backfill any pre-org-fix workflows so they appear in the org view
    // and become deletable. This is a no-op if already done.
    import("../lib/api").then(m => {
      m.default.post("/workflows/cleanup-orphans").catch(() => {
        // Non-critical — ignore errors, will retry next mount
      });
    });
  }, [activeOrg?.id]);

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
  // FIX: the Resource Usage card used to render hardcoded used={72}/58/64
  // values with no backing data at all — see GET /api/dashboard/resource-usage
  // (routes/dashboardResourceUsage.js) for the real computation against the
  // plan limits already defined in config/plans.js.
  const { data: resourceUsage, isLoading: loadingResourceUsage } = useQuery({
    queryKey: ["dashboard-resource-usage"],
    queryFn:  () => resourceUsageAPI.get(),
    staleTime: 60 * 1000,
  });
  const { data: volumeData } = useQuery({
    queryKey: ["execution-volume", "daily"],
    queryFn: () => analyticsApi.getExecutionVolume("daily"),
    staleTime: 60 * 1000,
  });
  const { data: inProgressData } = useQuery({
    queryKey: ["execution-in-progress", "daily"],
    queryFn: () => analyticsApi.getInProgressVolume("daily"),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  // FIX: the header's "All Systems Operational" badge used to render
  // unconditionally regardless of actual system state — same bug class as
  // the System Health card below. It now reflects the same real check.
  const { data: healthSummary } = useQuery({
    queryKey: ["system-health-summary"],
    queryFn:  () => systemHealthAPI.summary().then((d: any) => d.services || []),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
  const allOperational = (healthSummary ?? []).length > 0 &&
    (healthSummary ?? []).every((s: any) => s.status === "operational");
  const anyDown = (healthSummary ?? []).some((s: any) => s.status === "down");

  const workflows   = wfData  || [];
  const automations = amData  || [];
  const activeWF    = workflows.filter((w: any) => w.is_active).length;
  const activeAM    = automations.filter((a: any) => a.enabled).length;

  // BUGFIX: analytics/userStats both used to come back undefined because
  // the backend routes they call (GET /api/analytics, GET /api/user/stats)
  // didn't exist at all — see routes/analytics-engine.js and routes/user.js
  // for the fix. recent_runs/total_events/ai_requests below now read
  // genuine fields from those routes' real responses instead of always
  // falling through to an empty array, 0, or an invented number.
  const recentRuns  = (analytics as any)?.recent_runs ?? [];
  const totalEvents = (analytics as any)?.total_events ?? (userStats as any)?.total_events ?? 0;
  const aiRequests  = (userStats as any)?.ai_requests  ?? (analytics as any)?.ai_requests  ?? 0;
  const successRate: number | null = (analytics as any)?.success_rate ?? null;
  const statsLoading = loadingAnalytics || loadingStats;

  // BUGFIX: every one of these sparkline arrays used to be hardcoded —
  // [12,18,9,24,31,28,40], [2,3,2,4,3,activeWF,activeWF], etc. — invented
  // numbers padded around a single real data point, rendered as if they
  // were a genuine trend line. GET /api/analytics now returns `volume`:
  // real day-bucketed execution counts (see getExecutionVolume in
  // analytics/executionAnalytics.js). All four sparklines below derive
  // from that single real series instead of fabricating history.
  const volumeSeries: Array<{ bucket: string; total: number; successes: number }> =
    (analytics as any)?.volume ?? [];
  const last7 = volumeSeries.slice(-7);
  const totalsSpark    = last7.map(v => v.total);
  const successesSpark = last7.map(v => v.successes);
  const hasVolumeHistory = totalsSpark.length >= 2;

  // "vs last period" comparisons are only shown when there's enough real
  // history to compute them — first half of the window vs second half —
  // rather than a hardcoded change={12} that never reflected reality.
  const pctChange = (series: number[]): number | null => {
    if (series.length < 4) return null;
    const mid = Math.floor(series.length / 2);
    const prevAvg = series.slice(0, mid).reduce((a, b) => a + b, 0) / mid || 0;
    const currAvg = series.slice(mid).reduce((a, b) => a + b, 0) / (series.length - mid) || 0;
    if (prevAvg === 0) return currAvg > 0 ? 100 : 0;
    return Math.round(((currAvg - prevAvg) / prevAvg) * 100);
  };
  const evChange = pctChange(totalsSpark);

  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);

  return (
    <PageTransition variant="slide">
      <TrialCountdownBanner />
      <div style={{ padding: "clamp(16px,3vw,28px)", maxWidth: 1480, margin: "0 auto" }}>

        {/* ── Page header ── */}
        <Reveal>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.purple, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", marginBottom: 6 }}>
                COMMAND CENTER
              </div>
              <h1 style={{
                fontSize: "clamp(1.5rem,3vw,2.2rem)", fontWeight: 900,
                fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em",
                color: C.text, margin: 0, lineHeight: 1.1,
              }}>
                {t('dashboard.welcome', { name: user?.name?.split(" ")[0] || t('dashboard.welcome_fallback_name') })} 👋
              </h1>
              <p style={{ fontSize: 13, color: C.muted, fontFamily: "'DM Sans',sans-serif", margin: "6px 0 0" }}>
                {t('dashboard.subtitle')}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                background: anyDown ? "rgba(239,68,68,0.08)" : allOperational ? "rgba(0,200,150,0.08)" : "rgba(245,158,11,0.08)",
                border: `1px solid ${anyDown ? "rgba(239,68,68,0.2)" : allOperational ? "rgba(0,200,150,0.2)" : "rgba(245,158,11,0.2)"}`,
                borderRadius: 100, padding: "6px 12px",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: anyDown ? C.red : allOperational ? C.green : C.amber,
                  display: "inline-block",
                  boxShadow: `0 0 5px ${anyDown ? C.red : allOperational ? C.green : C.amber}`,
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: anyDown ? C.red : allOperational ? C.green : C.amber,
                  fontFamily: "'DM Mono',monospace",
                }}>
                  {anyDown ? t('dashboard.system_outage_detected') : allOperational ? t('dashboard.all_systems_operational') : t('dashboard.some_systems_degraded')}
                </span>
              </div>
              <button
                onClick={() => nav("/workflows")}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#7C3AED", border: "none", borderRadius: 8,
                  padding: "8px 16px", cursor: "pointer", color: "#fff",
                  fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                  boxShadow: "0 4px 14px rgba(124,58,237,0.35)", transition: "all 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#6D28D9"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#7C3AED"}
              >
                <Plus size={14} /> {t('dashboard.create')}
              </button>
            </div>
          </div>
        </Reveal>

        {/* ── KPI row ── */}
        {/* BUGFIX: every card here used to pass a hardcoded change={N} and
            a fabricated sparkData array (see the removed evSpark/wfSpark/
            amSpark/aiSpark constants above) — including a literal "98.7%"
            for Success Rate regardless of actual execution outcomes.
            Active Workflows/Automations have no real historical count
            series anywhere in the backend (no daily snapshot table exists
            for "how many workflows were active on day N"), so their change/
            sparkline props are simply omitted now rather than invented —
            KpiCard already handles missing change/sparkData gracefully.
            Events (7d) and Success Rate ARE backed by genuine data
            (execution_metrics via GET /api/analytics), so those get a real
            week-over-week % and a real day-bucketed sparkline. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(180px,100%),1fr))", gap: 14, marginBottom: 24 }}>
          <KpiCard loading={loadingWF}    label={t('dashboard.active_workflows')}   value={activeWF}    color={C.purple} icon={GitBranch} />
          <KpiCard loading={loadingAM}    label={t('dashboard.active_automations')} value={activeAM}    color={C.blue}   icon={Zap} />
          <KpiCard loading={statsLoading} label={t('dashboard.events_7d')}        value={totalEvents}
                    change={evChange ?? undefined} changeLabel={evChange !== null ? t('dashboard.vs_prior_period') : undefined}
                    color={C.green} icon={Activity} sparkData={hasVolumeHistory ? totalsSpark : undefined} />
          <KpiCard loading={statsLoading} label={t('dashboard.ai_requests')}        value={aiRequests}  color={C.amber}  icon={Bot} />
          <KpiCard loading={statsLoading} label={t('dashboard.success_rate')}
                    value={successRate !== null ? `${successRate}%` : "—"}
                    color={C.green} icon={CheckCircle2}
                    sparkData={hasVolumeHistory ? successesSpark : undefined} />
        </div>

        {/* ── Enterprise Analytics: Execution Trend Chart + Ranked Top Workflows ── */}
        <div className="af-analytics-row" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) minmax(0,1fr)", gap: 16, marginBottom: 20 }}>
          <div style={{
            background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
            borderRadius: 14, padding: 20,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif", marginBottom: 12 }}>
              Workflow Executions
            </div>
            <ExecutionVolumeChart data={volumeData as any} inProgressData={inProgressData as any} />
          </div>
          <RankedTopWorkflows onNav={nav} />
        </div>

        {/* ── 3-column mid section ── */}
        <div className="af-dash-mid" style={{ display: "grid", gap: 16, marginBottom: 20, alignItems: "start" }}>
          {/* LEFT: Runs table + Live events */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Reveal delay={80}>
              <Card>
                <RecentRunsTable runs={recentRuns} loading={loadingAnalytics} onRowClick={r => setSelectedEvent(r as any)} />
              </Card>
            </Reveal>
            <Reveal delay={120}>
              <LiveEventFeed onEventClick={setSelectedEvent} />
            </Reveal>
          </div>

          {/* CENTER: System health + Quick actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Reveal delay={100}>
              <SystemHealth />
            </Reveal>
            <Reveal delay={150}>
              <QuickActions onNav={nav} />
            </Reveal>
          </div>

          {/* RIGHT: Top workflows + Resource usage */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Reveal delay={110}>
              <TopWorkflows workflows={workflows} loading={loadingWF} onNav={nav} />
            </Reveal>
            <Reveal delay={160}>
              <Card>
                <SectionHeader title={t('dashboard.resource_usage')} sub={t('dashboard.current_billing_period')} />
                <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 4 }}>
                  {loadingResourceUsage ? (
                    [0, 1, 2].map(i => <Sk key={i} h={70} r={35} />)
                  ) : (
                    <>
                      <ResourceMeter
                        label={t('dashboard.res_ai_credits')}
                        percent={resourceUsage?.ai_credits?.percent ?? null}
                        displayValue={`${resourceUsage?.ai_credits?.used ?? 0} / ${resourceUsage?.ai_credits?.limit ?? 0}`}
                        unlimitedLabel={`${resourceUsage?.ai_credits?.used ?? 0} · ${t('dashboard.res_unlimited')}`}
                        color={C.purple}
                      />
                      <ResourceMeter
                        label={t('dashboard.res_storage')}
                        percent={resourceUsage?.storage?.percent ?? null}
                        displayValue={`${resourceUsage?.storage?.used ?? 0}GB / ${resourceUsage?.storage?.limit ?? 0}GB`}
                        unlimitedLabel={`${resourceUsage?.storage?.used ?? 0}GB · ${t('dashboard.res_unlimited')}`}
                        color={C.amber}
                      />
                      <ResourceMeter
                        label={t('dashboard.res_executions')}
                        percent={resourceUsage?.executions?.percent ?? null}
                        displayValue={`${resourceUsage?.executions?.used ?? 0} / ${resourceUsage?.executions?.limit ?? 0}`}
                        unlimitedLabel={`${resourceUsage?.executions?.used ?? 0} · ${t('dashboard.res_unlimited')}`}
                        color={C.green}
                      />
                    </>
                  )}
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <button
                    onClick={() => nav("/plans")}
                    style={{
                      width: "100%", padding: "8px", borderRadius: 8, cursor: "pointer",
                      background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
                      color: C.purple, fontSize: 12, fontWeight: 600,
                      fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.14)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.08)"}
                  >
                    {t('dashboard.manage_plan')}
                  </button>
                </div>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Phase 4–8 components (unchanged) ── */}
        <OrgHealthSummary />
        <OrchestrationInsightCard />
        <div style={{ marginTop: 16 }}><PredictiveInsightsPanel /></div>
        <div style={{ marginTop: 16 }}><TeamExecutionFeed onSelectRun={run => setSelectedEvent(run as any)} /></div>
        <div style={{ marginTop: 20 }}><GlobalExecutionTimeline /></div>
        <div style={{ marginTop: 16 }}><HistoricalTimeline /></div>
        <div style={{ marginTop: 12 }}><ReplayGapIndicator /></div>

        <ExecutionDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      </div>

      <style>{`
        .af-analytics-row {
          grid-template-columns: minmax(0,1.7fr) minmax(0,1fr);
        }
        @media (max-width: 900px) {
          .af-analytics-row { grid-template-columns: 1fr; }
        }
        .af-dash-mid {
          grid-template-columns: minmax(0,1.8fr) minmax(0,1fr) minmax(0,1fr);
        }
        @media (max-width: 1200px) {
          .af-dash-mid { grid-template-columns: minmax(0,1.4fr) minmax(0,1fr); }
        }
        @media (max-width: 800px) {
          .af-dash-mid { grid-template-columns: 1fr; }
        }
        .orchestration-pulse-strip { margin-bottom: 2px; }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes af-skeleton-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </PageTransition>
  );
}
