/**
 * AutoFlowNG — Campaign Agents (Phase 42A–46 Unified UI)
 *
 * The standalone home for the entire Campaign Agent system.
 * Consolidates: Campaign Analytics, Cockpit (lifecycle/approvals/briefs),
 * Publishing Gates, Budget & Risk Intelligence, and Ad Account management.
 *
 * Extracted from: MediaCloudPage.tsx (CampaignAnalyticsPanel + PublishingGateTab)
 * Absorbed from:  Phase45OpsCenter.tsx (lifecycle, approvals, escalations)
 * New:            Launch panel, Budget & Risk tab, unified Ad Accounts tab
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, BarChart3, Shield, Send, Target, TrendingUp, TrendingDown,
  Play, Pause, CheckCircle, XCircle, AlertTriangle, Clock,
  ChevronDown, ChevronUp, RotateCcw, Plus, Zap, DollarSign,
  Eye, MousePointer, ShoppingCart, Activity, RefreshCw,
  CreditCard, Link, Settings, ExternalLink, X, Check,
  ArrowLeft, CheckCircle2, Loader2, AlertCircle, Building2, Unplug,
  TrendingUp as TrendUp, MousePointerClick, BarChart2,
  Megaphone, PauseCircle, PlayCircle, FileText, Pencil,
  Package, ChevronRight,
} from 'lucide-react';
import { adPlatformAPI, API_BASE_URL, tokenStore } from '../lib/api';
import { PlatformSVGIcon } from '../components/PlatformIcons';
import { PageTransition } from '../components/PageTransition';
import { Reveal } from '../components/Reveal';
import { useToast } from '@/hooks/use-toast';

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:      "#060810",
  surface: "#0C0F1A",
  raised:  "#111520",
  border:  "rgba(255,255,255,0.06)",
  borderH: "rgba(255,255,255,0.11)",
  text:    "#E2E8FF",
  muted:   "rgba(226,232,255,0.45)",
  faint:   "rgba(226,232,255,0.22)",
  green:   "#00C896",
  blue:    "#38BDF8",
  purple:  "#A78BFA",
  amber:   "#FBBF24",
  red:     "#FB7185",
};

const FONT_HEAD = "'Syne',sans-serif";
const FONT_BODY = "'DM Sans',sans-serif";
const FONT_MONO = "'DM Mono',monospace";

/* ── API helper ────────────────────────────────────────────────────── */
const API = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('autoflowng_token') || ''}`,
      ...(opts?.headers || {}),
    },
  }).then(r => r.json());

/* ── Types ─────────────────────────────────────────────────────────── */

interface BlockingAsset {
  id:                string;
  name:              string;
  status:            string;
  review_request_id: string | null;
}

interface GateStatus {
  gated:            boolean;
  reason?:          string;
  blocking_assets?: BlockingAsset[];
}

interface PublishingJob {
  id:                     string;
  campaign_id?:           string;
  status:                 string;
  target_platforms:       string[];
  created_at:             string;
  requires_asset_approval?: boolean;
  blocked_reason?:        { reason: string; blocking_assets: BlockingAsset[] } | null;
  gate?:                  GateStatus | null;
  gateLoading?:           boolean;
}

interface Campaign {
  id: string;
  name: string;
  lifecycle_state: string;
  approval_mode: string;
  current_state_entered_at: string;
}

interface ApprovalItem {
  id: string;
  campaign_id: string;
  campaign_name?: string;
  risk_score: number;
  risk_category: string;
  contributing_factors: ContributingFactor[];
  policy_version: string;
  force_escalation_reasons: string[];
  assigned_role: string;
  sla_due_at: string;
  sla_breached: boolean;
  status: string;
  created_at: string;
}

interface EscalationItem {
  id: string;
  campaign_id: string;
  campaign_name?: string;
  source: string;
  risk_score: number | null;
  contributing_factors: ContributingFactor[];
  force_escalation_reasons: string[];
  status: string;
  created_at: string;
}

interface ContributingFactor {
  factor: string;
  weight: number;
  dimension: string;
  matched: boolean;
}

/* ── Shared primitives (copied verbatim from MediaCloudPage design system) ── */

function Spinner({ color = C.amber, size = 28 }: { color?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${color}30`, borderTopColor: color,
      animation: "af-spin 0.8s linear infinite",
    }} />
  );
}

function Card({ children, style = {}, accent }: { children: React.ReactNode; style?: React.CSSProperties; accent?: string }) {
  return (
    <div style={{
      position: "relative", background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 20, overflow: "hidden", ...style,
    }}>
      {accent && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
        }} />
      )}
      {children}
    </div>
  );
}

function SectionLabel({ children, color = C.amber }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color, fontFamily: FONT_MONO, letterSpacing: "0.1em", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function PageHeader({ label, title, sub, color = C.amber, right }: {
  label: string; title: string; sub?: string; color?: string; right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
      <div>
        <SectionLabel color={color}>{label}</SectionLabel>
        <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 900, fontFamily: FONT_HEAD, letterSpacing: "-0.04em", color: C.text, margin: 0 }}>
          {title}
        </h1>
        {sub && <p style={{ fontSize: 13, color: C.muted, marginTop: 5, fontFamily: FONT_BODY }}>{sub}</p>}
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{right}</div>}
    </div>
  );
}

function StatPill({ icon: Icon, value, label, color }: { icon: any; value: number | string; label: string; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: `${color}08`, border: `1px solid ${color}20`,
      borderRadius: 10, padding: "10px 16px",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: `${color}12`, border: `1px solid ${color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={13} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: FONT_HEAD, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: C.faint, fontFamily: FONT_MONO, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

function StatusDotBadge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 700, color,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 100, padding: "3px 9px",
      fontFamily: FONT_MONO, textTransform: "capitalize",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function BtnPrimary({ children, onClick, disabled, style = {}, color = C.green, full }: any) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: color, border: "none", borderRadius: 8,
        padding: "9px 16px", color: "#06120D",
        fontSize: 12.5, fontWeight: 700, cursor: disabled ? "default" : "pointer",
        fontFamily: FONT_BODY, opacity: disabled ? 0.55 : 1,
        width: full ? "100%" : undefined, transition: "filter 0.14s",
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
    >
      {children}
    </button>
  );
}

function BtnSecondary({ children, onClick, disabled, style = {}, color = C.purple, full }: any) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: `${color}0D`, border: `1px solid ${color}30`, borderRadius: 8,
        padding: "9px 16px", color,
        fontSize: 12.5, fontWeight: 600, cursor: disabled ? "default" : "pointer",
        fontFamily: FONT_BODY, opacity: disabled ? 0.5 : 1,
        width: full ? "100%" : undefined, transition: "background 0.14s",
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = `${color}18`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}0D`; }}
    >
      {children}
    </button>
  );
}

function BtnDanger({ children, onClick, disabled, style = {}, full }: any) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.28)", borderRadius: 8,
        padding: "9px 16px", color: C.red,
        fontSize: 12.5, fontWeight: 600, cursor: disabled ? "default" : "pointer",
        fontFamily: FONT_BODY, opacity: disabled ? 0.4 : 1,
        width: full ? "100%" : undefined, transition: "background 0.14s",
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = "rgba(251,113,133,0.16)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(251,113,133,0.08)"; }}
    >
      {children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { full?: boolean }) {
  const { style, full, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        width: full ? "100%" : undefined,
        background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 12px", color: C.text,
        fontSize: 12.5, fontFamily: FONT_BODY, outline: "none",
        boxSizing: "border-box", transition: "border-color 0.15s",
        ...style,
      }}
      onFocus={e => (e.currentTarget.style.borderColor = "rgba(251,191,36,0.4)")}
      onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { style, children, ...rest } = props;
  return (
    <select
      {...rest}
      style={{
        background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 12px", color: C.text,
        fontSize: 12.5, fontFamily: FONT_BODY, outline: "none",
        cursor: "pointer", ...style,
      }}
    >
      {children}
    </select>
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { style, ...rest } = props;
  return (
    <textarea
      {...rest}
      style={{
        width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 12px", color: C.text,
        fontSize: 12.5, fontFamily: FONT_BODY, outline: "none",
        resize: "none", boxSizing: "border-box", ...style,
      }}
    />
  );
}

function EmptyState({ icon: Icon, title, sub, color = C.amber }: { icon: any; title: string; sub: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 20px", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}12`, border: `1px solid ${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: "0 0 5px", fontFamily: FONT_HEAD }}>{title}</p>
        <p style={{ color: C.faint, fontSize: 12.5, margin: 0, fontFamily: FONT_BODY, maxWidth: 320 }}>{sub}</p>
      </div>
    </div>
  );
}

function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 10px", color: C.muted, cursor: page > 1 ? "pointer" : "default", opacity: page > 1 ? 1 : 0.3, fontSize: 12 }}>←</button>
      <span style={{ color: C.faint, fontSize: 11.5, fontFamily: FONT_MONO }}>{page} / {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 10px", color: C.muted, cursor: page < totalPages ? "pointer" : "default", opacity: page < totalPages ? 1 : 0.3, fontSize: 12 }}>→</button>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function TrendArrow({ pct, hasPrior }: { pct: number; hasPrior: boolean }) {
  if (!hasPrior) return <span style={{ color: C.faint, fontSize: 10 }}>—</span>;
  const up    = pct >= 0;
  const color = up ? C.green : C.red;
  return (
    <span style={{ color, fontSize: 10.5, fontFamily: FONT_MONO, fontWeight: 700 }}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

const fmtNum = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M'
  : n >= 1_000   ? (n / 1_000).toFixed(1) + 'K'
  : String(n);

const fmtUSD = (n: number) =>
  n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'K' : '$' + n.toFixed(2);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function categoryColor(cat: string): string {
  return ({
    low:      'bg-emerald-900 text-emerald-300 border-emerald-700',
    medium:   'bg-yellow-900 text-yellow-300 border-yellow-700',
    high:     'bg-orange-900 text-orange-300 border-orange-700',
    critical: 'bg-red-900 text-red-300 border-red-700',
  } as Record<string, string>)[cat] ?? 'bg-gray-800 text-gray-300 border-gray-700';
}

function stateColor(state: string): string {
  const colors: Record<string, string> = {
    DRAFT:             C.faint,
    PLANNING:          C.blue,
    GENERATING:        C.purple,
    AWAITING_APPROVAL: C.amber,
    PENDING_APPROVAL:  C.amber,
    SCHEDULED:         C.blue,
    PUBLISHING:        C.purple,
    LIVE:              C.green,
    MONITORING:        C.green,
    COMPLETED:         C.green,
    ARCHIVED:          C.faint,
    CANCELLED:         C.faint,
    FAILED:            C.red,
  };
  return colors[state] ?? C.faint;
}

/* ── Phase 45 subcomponents ─────────────────────────────────────────── */

function RiskBadge({ score, category, forceEscalation }: { score: number; category: string; forceEscalation?: boolean }) {
  const catColors: Record<string, { bg: string; color: string }> = {
    low:      { bg: 'rgba(16,185,129,0.12)', color: '#34D399' },
    medium:   { bg: 'rgba(251,191,36,0.12)', color: C.amber   },
    high:     { bg: 'rgba(249,115,22,0.12)', color: '#F97316' },
    critical: { bg: 'rgba(251,113,133,0.12)', color: C.red    },
  };
  const style = catColors[category] ?? { bg: 'rgba(255,255,255,0.06)', color: C.faint };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 5,
      background: style.bg, color: style.color,
      fontSize: 10.5, fontFamily: FONT_MONO, fontWeight: 700,
    }}>
      {forceEscalation && <span title="Force escalation flag">⚡</span>}
      {score} · {category}
    </span>
  );
}

function ContributingFactorsList({ factors }: { factors: ContributingFactor[] }) {
  if (!factors || factors.length === 0) return <span style={{ color: C.faint, fontSize: 11.5, fontFamily: FONT_BODY }}>No risk factors</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
      {factors.map((f) => (
        <span key={f.factor} style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 7px', color: C.muted, fontFamily: FONT_MONO }}>
          {f.factor} <span style={{ color: C.amber }}>+{f.weight}</span>
        </span>
      ))}
    </div>
  );
}

function SLATimer({ dueAt, breached }: { dueAt: string; breached: boolean }) {
  const remaining = new Date(dueAt).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(remaining / 3600000));
  const mins  = Math.max(0, Math.floor((remaining % 3600000) / 60000));
  if (breached) return <span style={{ color: C.red, fontSize: 11, fontFamily: FONT_MONO, fontWeight: 700 }}>SLA BREACHED</span>;
  if (remaining <= 0) return <span style={{ color: C.amber, fontSize: 11, fontFamily: FONT_MONO }}>Overdue</span>;
  return (
    <span style={{ fontSize: 11, color: remaining < 3600000 ? C.amber : C.faint, fontFamily: FONT_MONO }}>
      {hours}h {mins}m remaining
    </span>
  );
}

/* ── Tab configuration ──────────────────────────────────────────────── */

type CampaignTab = 'overview' | 'cockpit' | 'gates' | 'budget' | 'adaccounts';

const TAB_DEFS: { id: CampaignTab; label: string; icon: any; color: string }[] = [
  { id: 'overview',   label: 'Overview',      icon: BarChart3,   color: C.amber  },
  { id: 'cockpit',    label: 'Cockpit',        icon: Bot,         color: C.purple },
  { id: 'gates',      label: 'Approval Gates', icon: Shield,      color: C.green  },
  { id: 'budget',     label: 'Budget & Risk',  icon: TrendingUp,  color: C.blue   },
  { id: 'adaccounts', label: 'Ad Accounts',    icon: CreditCard,  color: C.amber  },
];

/* ══════════════════════════════════════════════════════════════════════
   TAB 1 — OVERVIEW (CampaignAnalyticsPanel + Quick Launch)
══════════════════════════════════════════════════════════════════════ */
function OverviewTab() {
  const [data,         setData]        = useState<any | null>(null);
  const [loading,      setLoading]     = useState(true);
  const [days,         setDays]        = useState(7);
  const [expanded,     setExpanded]    = useState<string | null>(null);
  const [drillData,    setDrillData]   = useState<Record<string, any>>({});
  const [drillLoading, setDrillLoading]= useState<Record<string, boolean>>({});

  const [launchPrompt, setLaunchPrompt] = useState('');
  const [launching,    setLaunching]    = useState(false);
  const [launchResult, setLaunchResult] = useState<string | null>(null);
  const [launchError,  setLaunchError]  = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    API(`/campaigns/analytics/summary?days=${days}`)
      .then(r  => { if (!cancelled) { setData(r); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const toggleExpand = async (campaignId: string) => {
    if (expanded === campaignId) { setExpanded(null); return; }
    setExpanded(campaignId);
    if (drillData[campaignId]) return;
    setDrillLoading(prev => ({ ...prev, [campaignId]: true }));
    try {
      const r = await API(`/campaigns/analytics/${campaignId}?days=${days}`);
      setDrillData(prev => ({ ...prev, [campaignId]: r }));
    } catch {
      // graceful
    } finally {
      setDrillLoading(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchResult(null);
    setLaunchError(null);
    try {
      const res = await API('/campaign-agent/launch', {
        method: 'POST',
        body: JSON.stringify({ prompt: launchPrompt }),
      });
      if (res.error) throw new Error(res.error);
      setLaunchResult(`Campaign started — ID: ${res.campaignId}. Assets will appear in the Cockpit tab.`);
      setLaunchPrompt('');
    } catch (err: any) {
      setLaunchError(err.message || 'Launch failed');
    } finally {
      setLaunching(false);
    }
  };

  const KPI_CARD: React.CSSProperties = {
    background: C.raised, borderRadius: 10, padding: '12px 16px',
    border: `1px solid ${C.border}`, flex: '1 1 130px', minWidth: 0,
  };

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Quick Launch */}
      <Card accent={C.purple} style={{ marginBottom: 24, borderColor: 'rgba(167,139,250,0.25)' }}>
        <SectionLabel color={C.purple}>QUICK LAUNCH</SectionLabel>
        <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: '0 0 12px', fontFamily: FONT_HEAD }}>
          Launch a New Campaign
        </p>
        <TextArea
          rows={3}
          placeholder="Describe your campaign goal… e.g. 'Promote our new product to Lagos university students on Meta and TikTok with a ₦50,000 daily budget'"
          value={launchPrompt}
          onChange={(e: any) => setLaunchPrompt(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <BtnPrimary
          color={C.purple}
          onClick={handleLaunch}
          disabled={launching || !launchPrompt.trim()}
        >
          <Zap size={13} /> {launching ? 'Launching…' : 'Launch Autonomous Campaign'}
        </BtnPrimary>
        {launchResult && (
          <p style={{ color: C.green, fontSize: 12, marginTop: 10, fontFamily: FONT_BODY }}>
            ✓ {launchResult}
          </p>
        )}
        {launchError && (
          <p style={{ color: C.red, fontSize: 12, marginTop: 10, fontFamily: FONT_BODY }}>
            {launchError}
          </p>
        )}
      </Card>

      {/* Header + time filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: 0, fontFamily: FONT_HEAD }}>Campaign Performance</p>
          <p style={{ color: C.faint, fontSize: 11.5, margin: '3px 0 0', fontFamily: FONT_BODY }}>
            Real data from campaign_performance_metrics — trend vs prior period
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '5px 13px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
              background: days === d ? C.amber : 'rgba(255,255,255,0.07)',
              color:      days === d ? '#1a1305' : C.muted,
              fontWeight: 600, fontFamily: FONT_BODY, transition: 'all 0.15s',
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Org-level roll-up */}
      {data?.totals && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {[
            { label: 'VIEWS',       value: fmtNum(data.totals.views),       color: C.blue   },
            { label: 'CLICKS',      value: fmtNum(data.totals.clicks),      color: C.green  },
            { label: 'CONVERSIONS', value: fmtNum(data.totals.conversions), color: C.purple },
            { label: 'SPEND',       value: fmtUSD(data.totals.spend_usd),   color: C.amber  },
          ].map(pill => (
            <div key={pill.label} style={{ ...KPI_CARD, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: C.faint, fontSize: 9.5, fontFamily: FONT_MONO }}>{pill.label}</span>
              <span style={{ color: pill.color, fontSize: 20, fontWeight: 800, fontFamily: FONT_HEAD }}>{pill.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Per-campaign list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}><Spinner /></div>
      ) : !data?.campaigns?.length ? (
        <EmptyState icon={Bot} title="No campaign data yet" sub="Campaign Agent jobs will populate metrics here once they run. Launch a campaign to see performance." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.campaigns.map((camp: any) => {
            const m      = camp.metrics;
            const t      = camp.trends;
            const isOpen = expanded === String(camp.campaign_id);
            const drill  = drillData[String(camp.campaign_id)];
            const dl     = drillLoading[String(camp.campaign_id)];
            const statusColor = camp.campaign_status === 'active'  ? C.green
                              : camp.campaign_status === 'paused'  ? C.amber
                              : camp.campaign_status === 'failed'  ? C.red : C.muted;
            return (
              <div key={camp.campaign_id} style={{ background: C.surface, border: `1px solid ${isOpen ? C.borderH : C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div onClick={() => toggleExpand(String(camp.campaign_id))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ color: C.text, fontWeight: 700, fontSize: 13.5, fontFamily: FONT_HEAD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{camp.campaign_name}</span>
                      <span style={{ fontSize: 10, fontFamily: FONT_MONO, padding: '2px 8px', borderRadius: 20, background: `${statusColor}18`, color: statusColor }}>{camp.campaign_status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Views',  value: fmtNum(m.views),         trend: t.views_pct       },
                        { label: 'Clicks', value: fmtNum(m.clicks),        trend: t.clicks_pct      },
                        { label: 'Conv.',  value: fmtNum(m.conversions),   trend: t.conversions_pct },
                        { label: 'Spend',  value: fmtUSD(m.spend_usd),     trend: t.spend_pct       },
                        { label: 'ROAS',   value: m.avg_roas.toFixed(2),   trend: t.roas_pct        },
                      ].map(kpi => (
                        <div key={kpi.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ color: C.faint, fontSize: 9.5, fontFamily: FONT_MONO }}>{kpi.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ color: C.text, fontSize: 13, fontWeight: 700, fontFamily: FONT_MONO }}>{kpi.value}</span>
                            <TrendArrow pct={kpi.trend} hasPrior={t.has_prior_data} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {(camp.platforms ?? []).map((p: string) => (
                        <span key={p} style={{ fontSize: 9.5, fontFamily: FONT_MONO, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: C.muted }}>{p}</span>
                      ))}
                    </div>
                    {isOpen ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px' }}>
                    {dl ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner /></div>
                    ) : drill?.by_platform?.length ? (
                      <>
                        <p style={{ color: C.faint, fontSize: 10.5, fontFamily: FONT_MONO, margin: '0 0 10px' }}>PLATFORM BREAKDOWN — LAST {days} DAYS</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {drill.by_platform.map((p: any) => (
                            <div key={p.platform} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.raised, borderRadius: 8, padding: '10px 14px' }}>
                              <span style={{ color: C.amber, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, minWidth: 90 }}>{p.platform.toUpperCase()}</span>
                              <div style={{ display: 'flex', gap: 18, flex: 1, flexWrap: 'wrap' }}>
                                {[
                                  { label: 'Views',  val: fmtNum(p.views)                   },
                                  { label: 'Clicks', val: fmtNum(p.clicks)                  },
                                  { label: 'Conv.',  val: fmtNum(p.conversions)              },
                                  { label: 'Spend',  val: fmtUSD(p.spend_usd)               },
                                  { label: 'CTR',    val: (p.avg_ctr * 100).toFixed(2) + '%' },
                                  { label: 'ROAS',   val: p.avg_roas.toFixed(2)             },
                                ].map(kpi => (
                                  <div key={kpi.label}>
                                    <span style={{ color: C.faint, fontSize: 9, fontFamily: FONT_MONO }}>{kpi.label} </span>
                                    <span style={{ color: C.text,  fontSize: 12, fontFamily: FONT_MONO, fontWeight: 700 }}>{kpi.val}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ color: C.faint, fontSize: 12, fontFamily: FONT_BODY }}>No platform breakdown data for this period.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TAB 2 — COCKPIT (Phase45OpsCenter absorbed, paths corrected)
══════════════════════════════════════════════════════════════════════ */
function CockpitTab({ orgId }: { orgId: string }) {
  const [section, setSection] = useState<'lifecycle' | 'approval' | 'escalation' | 'brief'>('lifecycle');

  const [campaigns,       setCampaigns]       = useState<Campaign[]>([]);
  const [approvalQueue,   setApprovalQueue]   = useState<ApprovalItem[]>([]);
  const [escalationQueue, setEscalationQueue] = useState<EscalationItem[]>([]);

  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [briefText,      setBriefText]      = useState('');
  const [briefCampaignId, setBriefCampaignId] = useState('');
  const [briefResult,    setBriefResult]    = useState<any>(null);
  const [briefLoading,   setBriefLoading]   = useState(false);
  const [briefError,     setBriefError]     = useState<string | null>(null);
  const [actioningItem,  setActioningItem]  = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const { subscribe } = useWebSocketContext();

  const fetchCampaigns = useCallback(async () => {
    if (!orgId) return;
    setLoading(true); setError(null);
    try {
      const data = await API(`/platform/campaigns/orgs/${orgId}/campaigns/lifecycle?limit=50`);
      setCampaigns(data.items ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const fetchApprovalQueue = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await API(`/platform/campaigns/orgs/${orgId}/approval-queue?limit=50`);
      setApprovalQueue(data.items ?? []);
    } catch { /* graceful */ }
  }, [orgId]);

  const fetchEscalationQueue = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await API(`/platform/campaigns/orgs/${orgId}/escalation-queue?limit=50`);
      setEscalationQueue(data.items ?? []);
    } catch { /* graceful */ }
  }, [orgId]);

  useEffect(() => {
    fetchCampaigns();
    fetchApprovalQueue();
    fetchEscalationQueue();
    const t = setInterval(() => { fetchApprovalQueue(); fetchEscalationQueue(); }, 30000);
    return () => clearInterval(t);
  }, [fetchCampaigns, fetchApprovalQueue, fetchEscalationQueue]);

  useEffect(() => {
    const unsub = subscribe('publish:complete', (_event: any) => {
      fetchCampaigns(); fetchApprovalQueue(); fetchEscalationQueue();
    });
    return () => unsub();
  }, [subscribe, fetchCampaigns, fetchApprovalQueue, fetchEscalationQueue]);

  const handleApprovalAction = async (itemId: string, action: string) => {
    if (!overrideReason && ['force_publish', 'force_block', 'reject'].includes(action)) {
      alert('Please provide a reason for this action.');
      return;
    }
    setActioningItem(itemId);
    try {
      await API(`/platform/campaigns/approval-queue/${itemId}/action`, {
        method: 'POST',
        body:   JSON.stringify({ action, reason: overrideReason }),
      });
      setOverrideReason('');
      fetchApprovalQueue(); fetchEscalationQueue();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActioningItem(null);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await API(`/campaigns/${id}/approve`, { method: 'PATCH', body: '{}' });
      fetchCampaigns();
    } catch (err: any) { alert(`Approve failed: ${err.message}`); }
  };

  const handlePause = async (id: string) => {
    try {
      await API(`/campaigns/${id}/pause`, { method: 'PATCH', body: '{}' });
      fetchCampaigns();
    } catch (err: any) { alert(`Pause failed: ${err.message}`); }
  };

  const handleResume = async (id: string) => {
    try {
      await API(`/campaigns/${id}/resume`, { method: 'PATCH', body: '{}' });
      fetchCampaigns();
    } catch (err: any) { alert(`Resume failed: ${err.message}`); }
  };

  const handleBriefSubmit = async () => {
    if (!briefText.trim() || !briefCampaignId.trim()) {
      setBriefError('Campaign ID and brief text are required');
      return;
    }
    setBriefLoading(true); setBriefError(null); setBriefResult(null);
    try {
      const result = await API(`/campaigns/${briefCampaignId}/brief`, {
        method: 'POST',
        body:   JSON.stringify({ brief_text: briefText, auto_advance: true }),
      });
      setBriefResult(result);
      fetchCampaigns();
    } catch (err: any) {
      setBriefError(err.message);
    } finally {
      setBriefLoading(false);
    }
  };

  const sections = [
    { key: 'lifecycle',  label: 'Lifecycle',       count: campaigns.length       },
    { key: 'approval',   label: 'Approval Queue',  count: approvalQueue.length   },
    { key: 'escalation', label: 'Escalations',     count: escalationQueue.length },
    { key: 'brief',      label: 'Submit Brief',    count: null                   },
  ] as const;

  return (
    <div>
      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 2 }}>
        {sections.map(s => (
          <button key={s.key} onClick={() => setSection(s.key as any)} style={{
            padding: '7px 14px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer',
            background: section === s.key ? `${C.purple}18` : 'none',
            color:      section === s.key ? C.purple : C.muted,
            fontWeight: 600, fontSize: 12.5, fontFamily: FONT_BODY,
            borderBottom: section === s.key ? `2px solid ${C.purple}` : '2px solid transparent',
            marginBottom: -2, transition: 'all 0.14s',
          }}>
            {s.label}
            {s.count != null && s.count > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10, background: section === s.key ? C.purple : 'rgba(255,255,255,0.1)', color: section === s.key ? '#fff' : C.muted, borderRadius: 9, padding: '1px 6px', fontFamily: FONT_MONO }}>
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Section A: Lifecycle ────────────────────────────────────── */}
      {section === 'lifecycle' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: 0, fontFamily: FONT_HEAD }}>Campaign Lifecycle Overview</p>
            <button onClick={fetchCampaigns} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, fontSize: 12, fontFamily: FONT_BODY }}>
              ↻ Refresh
            </button>
          </div>
          {error && <div style={{ background: 'rgba(251,113,133,0.08)', border: `1px solid rgba(251,113,133,0.25)`, borderRadius: 10, padding: '12px 16px', color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner /></div>
          ) : campaigns.length === 0 ? (
            <EmptyState icon={Bot} title="No campaigns yet" sub="Submit a brief in the Submit Brief tab to create a campaign." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {campaigns.map((c) => {
                const sc = stateColor(c.lifecycle_state);
                const isPendingApproval = c.lifecycle_state === 'PENDING_APPROVAL' || c.lifecycle_state === 'AWAITING_APPROVAL';
                const isLiveOrActive = ['LIVE', 'MONITORING', 'PUBLISHING'].includes(c.lifecycle_state);
                const isPaused = c.lifecycle_state === 'PAUSED';
                return (
                  <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ color: C.text, fontWeight: 700, fontSize: 13.5, fontFamily: FONT_HEAD }}>{c.name ?? c.id}</span>
                          <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: C.faint }}>{c.id.slice(0, 8)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11.5, fontFamily: FONT_MONO, fontWeight: 700, color: sc }}>{c.lifecycle_state}</span>
                          <span style={{ fontSize: 10.5, background: 'rgba(255,255,255,0.06)', color: C.faint, borderRadius: 5, padding: '2px 7px', fontFamily: FONT_MONO }}>{c.approval_mode}</span>
                          <span style={{ fontSize: 10.5, color: C.faint, fontFamily: FONT_BODY }}>{relativeTime(c.current_state_entered_at)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isPendingApproval && c.approval_mode === 'assisted' && (
                          <BtnPrimary color={C.green} onClick={() => handleApprove(c.id)} style={{ padding: '6px 12px', fontSize: 11.5 }}>
                            <CheckCircle size={12} /> Approve Plan
                          </BtnPrimary>
                        )}
                        {isLiveOrActive && (
                          <BtnSecondary color={C.amber} onClick={() => handlePause(c.id)} style={{ padding: '6px 12px', fontSize: 11.5 }}>
                            <Pause size={12} /> Pause
                          </BtnSecondary>
                        )}
                        {isPaused && (
                          <BtnPrimary color={C.blue} onClick={() => handleResume(c.id)} style={{ padding: '6px 12px', fontSize: 11.5 }}>
                            <Play size={12} /> Resume
                          </BtnPrimary>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Section B: Approval Queue ──────────────────────────────── */}
      {section === 'approval' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: 0, fontFamily: FONT_HEAD }}>Approval Queue</p>
            <button onClick={fetchApprovalQueue} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, fontSize: 12 }}>↻ Refresh</button>
          </div>
          {approvalQueue.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No pending approvals" sub="Campaigns requiring approval will appear here." color={C.green} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {approvalQueue.map(item => (
                <div key={item.id} style={{ background: C.surface, border: `1px solid ${item.sla_breached ? 'rgba(251,113,133,0.25)' : C.border}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <RiskBadge score={item.risk_score} category={item.risk_category} forceEscalation={item.force_escalation_reasons?.length > 0} />
                        <span style={{ fontSize: 10.5, color: C.faint, fontFamily: FONT_MONO }}>v{item.policy_version}</span>
                        <span style={{ fontSize: 10.5, background: 'rgba(255,255,255,0.05)', color: C.muted, borderRadius: 5, padding: '2px 7px', fontFamily: FONT_MONO }}>{item.assigned_role}</span>
                        {item.sla_breached && <span style={{ fontSize: 10.5, background: 'rgba(251,113,133,0.1)', color: C.red, borderRadius: 5, padding: '2px 7px', fontFamily: FONT_MONO, fontWeight: 700 }}>SLA BREACHED</span>}
                      </div>
                      <p style={{ color: C.text, fontSize: 13, fontWeight: 600, margin: '0 0 6px', fontFamily: FONT_BODY }}>Campaign: {item.campaign_name ?? item.campaign_id}</p>
                      <ContributingFactorsList factors={item.contributing_factors} />
                      {item.force_escalation_reasons?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                          {item.force_escalation_reasons.map(r => (
                            <span key={r} style={{ fontSize: 10.5, background: 'rgba(251,113,133,0.1)', border: `1px solid rgba(251,113,133,0.25)`, borderRadius: 5, padding: '2px 7px', color: C.red, fontFamily: FONT_MONO }}>⚡ {r}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <SLATimer dueAt={item.sla_due_at} breached={item.sla_breached} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                      <Input
                        placeholder="Reason (required for force actions)…"
                        value={overrideReason}
                        onChange={(e: any) => setOverrideReason(e.target.value)}
                        style={{ fontSize: 11.5 }}
                        full
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                        <BtnPrimary color={C.green} onClick={() => handleApprovalAction(item.id, 'approve')} disabled={actioningItem === item.id} style={{ padding: '5px 10px', fontSize: 11 }}>
                          Approve
                        </BtnPrimary>
                        <BtnDanger onClick={() => handleApprovalAction(item.id, 'reject')} disabled={actioningItem === item.id} style={{ padding: '5px 10px', fontSize: 11 }}>
                          Reject
                        </BtnDanger>
                        <BtnSecondary color={C.amber} onClick={() => handleApprovalAction(item.id, 'approve_with_exception')} disabled={actioningItem === item.id} style={{ padding: '5px 10px', fontSize: 11 }}>
                          + Exception
                        </BtnSecondary>
                        <BtnSecondary color={C.red} onClick={() => handleApprovalAction(item.id, 'escalate')} disabled={actioningItem === item.id} style={{ padding: '5px 10px', fontSize: 11 }}>
                          Escalate
                        </BtnSecondary>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Section C: Escalation Queue ────────────────────────────── */}
      {section === 'escalation' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ color: C.red, fontWeight: 700, fontSize: 14, margin: 0, fontFamily: FONT_HEAD }}>Escalation Queue</p>
            <button onClick={fetchEscalationQueue} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, fontSize: 12 }}>↻ Refresh</button>
          </div>
          {escalationQueue.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="No open escalations" sub="Escalated campaigns will appear here for senior review." color={C.red} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {escalationQueue.map(item => (
                <div key={item.id} style={{ background: 'rgba(251,113,133,0.04)', border: `1px solid rgba(251,113,133,0.2)`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10.5, background: 'rgba(251,113,133,0.12)', border: `1px solid rgba(251,113,133,0.25)`, color: C.red, borderRadius: 5, padding: '2px 8px', fontFamily: FONT_MONO, fontWeight: 700, textTransform: 'uppercase' }}>
                          {item.source.replace(/_/g, ' ')}
                        </span>
                        {item.risk_score != null && <RiskBadge score={item.risk_score} category="critical" />}
                      </div>
                      <p style={{ color: C.text, fontSize: 13, fontWeight: 600, margin: '0 0 6px', fontFamily: FONT_BODY }}>Campaign: {item.campaign_name ?? item.campaign_id}</p>
                      {item.force_escalation_reasons?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                          {item.force_escalation_reasons.map(r => (
                            <span key={r} style={{ fontSize: 10.5, background: 'rgba(251,113,133,0.1)', border: `1px solid rgba(251,113,133,0.25)`, borderRadius: 5, padding: '2px 7px', color: C.red, fontFamily: FONT_MONO }}>⚡ {r}</span>
                          ))}
                        </div>
                      )}
                      <ContributingFactorsList factors={item.contributing_factors} />
                      <p style={{ color: C.faint, fontSize: 11, margin: '8px 0 0', fontFamily: FONT_BODY }}>{relativeTime(item.created_at)}</p>
                    </div>
                    <span style={{ fontSize: 11, color: C.red, fontFamily: FONT_MONO, fontWeight: 700, whiteSpace: 'nowrap' }}>Requires senior_approver</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Section D: Submit Campaign Brief ───────────────────────── */}
      {section === 'brief' && (
        <div style={{ maxWidth: 620 }}>
          <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: '0 0 8px', fontFamily: FONT_HEAD }}>Submit Campaign Brief</p>
          <p style={{ color: C.faint, fontSize: 13, margin: '0 0 20px', fontFamily: FONT_BODY }}>
            Enter a plain-text campaign brief. The system will parse it, generate a plan, create assets, and route through the risk engine automatically.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ color: C.faint, fontSize: 11, fontFamily: FONT_MONO, margin: '0 0 6px' }}>CAMPAIGN ID</p>
              <Input
                full
                value={briefCampaignId}
                onChange={(e: any) => setBriefCampaignId(e.target.value)}
                placeholder="e.g. camp-550e8400-e29b-41d4-a716-446655440000"
              />
            </div>
            <div>
              <p style={{ color: C.faint, fontSize: 11, fontFamily: FONT_MONO, margin: '0 0 6px' }}>CAMPAIGN BRIEF</p>
              <TextArea
                rows={6}
                value={briefText}
                onChange={(e: any) => setBriefText(e.target.value)}
                placeholder="Describe your campaign in plain English. Include goal, target audience, budget, duration, and platforms if known."
              />
            </div>
            {briefError && <div style={{ background: 'rgba(251,113,133,0.08)', border: `1px solid rgba(251,113,133,0.25)`, borderRadius: 10, padding: '12px 16px', color: C.red, fontSize: 13 }}>{briefError}</div>}
            <BtnPrimary color={C.amber} onClick={handleBriefSubmit} disabled={briefLoading}>
              <Send size={13} /> {briefLoading ? 'Processing…' : 'Submit Brief'}
            </BtnPrimary>
            {briefResult && (
              <Card accent={C.green}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <CheckCircle size={16} color={C.green} />
                  <span style={{ color: C.green, fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY }}>Brief Submitted</span>
                  <span style={{ fontSize: 12, fontFamily: FONT_MONO, fontWeight: 700, color: stateColor(briefResult.lifecycle_state) }}>→ {briefResult.lifecycle_state}</span>
                </div>
                {briefResult.brief && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ color: C.faint, fontSize: 10.5, fontFamily: FONT_MONO, margin: '0 0 4px' }}>PARSED BRIEF</p>
                    <p style={{ color: C.text, fontSize: 13, margin: '0 0 4px', fontFamily: FONT_BODY }}>{briefResult.brief.goal}</p>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: C.faint, fontFamily: FONT_BODY }}>
                      <span>KPI: {briefResult.brief.primary_kpi}</span>
                      <span>Confidence: {Math.round((briefResult.brief.confidence ?? 0) * 100)}%</span>
                      {briefResult.brief.budget?.total && <span>Budget: ${briefResult.brief.budget.total.toLocaleString()}</span>}
                    </div>
                  </div>
                )}
                {briefResult.generation && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, fontFamily: FONT_BODY }}>
                    <span style={{ color: C.green }}>✓ {briefResult.generation.generated?.length ?? 0} generated</span>
                    {briefResult.generation.failed?.length > 0 && <span style={{ color: C.red }}>✗ {briefResult.generation.failed.length} failed</span>}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TAB 3 — APPROVAL GATES (PublishingGateTab moved, API path corrected)
   Uses GET /api/campaigns/:id/jobs (not the non-existent /api/publishing/jobs)
══════════════════════════════════════════════════════════════════════ */
function GatesTab() {
  const [campaigns,      setCampaigns]      = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState('');
  const [jobs,           setJobs]           = useState<PublishingJob[]>([]);
  const [total,          setTotal]          = useState(0);
  const [page,           setPage]           = useState(1);
  const [loading,        setLoading]        = useState(false);
  const [campLoading,    setCampLoading]    = useState(true);
  const [toggling,       setToggling]       = useState<string | null>(null);
  const [expanded,       setExpanded]       = useState<string | null>(null);

  // Load campaigns for the selector
  useEffect(() => {
    setCampLoading(true);
    API('/campaigns?limit=50')
      .then(r => { setCampaigns(r.campaigns ?? r.items ?? []); setCampLoading(false); })
      .catch(() => setCampLoading(false));
  }, []);

  const loadJobs = useCallback(async (campaignId: string, pg: number) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const res = await API(`/campaigns/${campaignId}/jobs?page=${pg}&limit=15`).catch(() => ({ jobs: [], total: 0 }));
      const rawJobs: PublishingJob[] = res.jobs ?? res.items ?? [];
      setTotal(res.total || rawJobs.length);
      const withGates = await Promise.all(
        rawJobs.map(async (job) => {
          try {
            const gate: GateStatus = await API(`/publishing-gate/${job.id}/check`);
            return { ...job, gate };
          } catch {
            return { ...job, gate: null };
          }
        })
      );
      setJobs(withGates);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCampId) { setPage(1); loadJobs(selectedCampId, 1); }
  }, [selectedCampId, loadJobs]);

  useEffect(() => {
    if (selectedCampId) loadJobs(selectedCampId, page);
  }, [page, selectedCampId, loadJobs]);

  const toggleGate = async (jobId: string, currentlyOn: boolean) => {
    setToggling(jobId);
    await API(`/publishing-gate/${jobId}/set`, {
      method: 'POST',
      body:   JSON.stringify({ requires_approval: !currentlyOn }),
    }).catch(() => {});
    setToggling(null);
    loadJobs(selectedCampId, page);
  };

  const recheck = async (jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, gateLoading: true } : j));
    try {
      const gate: GateStatus = await API(`/publishing-gate/${jobId}/check`);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, gate, gateLoading: false } : j));
    } catch {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, gateLoading: false } : j));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: 0, fontFamily: FONT_HEAD }}>Publishing Gates</p>
          <p style={{ color: C.faint, fontSize: 11.5, margin: '3px 0 0', fontFamily: FONT_BODY }}>
            Require all campaign assets to be approved before a job can publish.
          </p>
        </div>
        {selectedCampId && <span style={{ color: C.faint, fontSize: 11.5, fontFamily: FONT_MONO }}>{total} JOBS</span>}
      </div>

      {/* Campaign selector */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: C.faint, fontSize: 10.5, fontFamily: FONT_MONO, margin: '0 0 6px' }}>SELECT CAMPAIGN</p>
        {campLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.faint, fontSize: 12 }}><Spinner size={16} /> Loading campaigns…</div>
        ) : (
          <Select value={selectedCampId} onChange={(e: any) => setSelectedCampId(e.target.value)} style={{ minWidth: 260 }}>
            <option value="">— Select a campaign —</option>
            {campaigns.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name ?? c.id}</option>
            ))}
          </Select>
        )}
      </div>

      {!selectedCampId ? (
        <EmptyState icon={Shield} title="Select a campaign" sub="Choose a campaign above to view and manage its publishing gate status." color={C.green} />
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner /></div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={Send} title="No publishing jobs found" sub="Jobs created from campaign orchestration will show up here." />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobs.map(job => {
              const gateOn    = job.requires_asset_approval ?? false;
              const isBlocked = job.status === 'blocked';
              const gateStatus = job.gate;
              const blockers  = isBlocked
                ? (job.blocked_reason?.blocking_assets ?? [])
                : (gateStatus?.blocking_assets ?? []);
              const isExpanded = expanded === job.id;
              const borderColor = isBlocked ? 'rgba(251,113,133,0.3)' : gateOn ? 'rgba(251,191,36,0.25)' : C.border;
              return (
                <div key={job.id} style={{ background: C.surface, border: `1px solid ${borderColor}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div onClick={() => setExpanded(isExpanded ? null : job.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: C.text, fontFamily: FONT_MONO, fontSize: 11.5 }}>{job.id.slice(0, 8)}…</span>
                        <StatusDotBadge label={job.status} color={C.green} bg={`${C.green}12`} border={`${C.green}28`} />
                        {isBlocked && <span style={{ color: C.red, fontSize: 11, fontWeight: 600, fontFamily: FONT_BODY }}>{blockers.length} asset(s) pending approval</span>}
                        {gateOn && !isBlocked && gateStatus?.gated && (
                          <span style={{ color: C.amber, fontSize: 11, fontFamily: FONT_BODY }}>
                            <AlertTriangle size={10} style={{ display: 'inline', marginRight: 3 }} />{gateStatus.blocking_assets?.length ?? 0} pending
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        <p style={{ color: C.faint, fontSize: 11, margin: 0, fontFamily: FONT_BODY }}>{(job.target_platforms || []).join(', ') || 'No platforms'}</p>
                        <span style={{ color: C.faint, fontSize: 11 }}>·</span>
                        <p style={{ color: C.faint, fontSize: 11, margin: 0, fontFamily: FONT_MONO }}>{fmtDate(job.created_at)}</p>
                      </div>
                    </div>
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10.5, color: gateOn ? C.amber : C.faint, fontFamily: FONT_MONO }}>{gateOn ? 'GATE ON' : 'GATE OFF'}</span>
                      <button
                        onClick={() => toggleGate(job.id, gateOn)}
                        disabled={toggling === job.id || ['completed','failed','cancelled'].includes(job.status)}
                        style={{ position: 'relative', width: 36, height: 20, borderRadius: 100, border: 'none', cursor: 'pointer', background: gateOn ? C.amber : 'rgba(255,255,255,0.12)', opacity: (toggling === job.id || ['completed','failed','cancelled'].includes(job.status)) ? 0.4 : 1, transition: 'background 0.18s' }}
                      >
                        <span style={{ position: 'absolute', top: 2, left: gateOn ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                      </button>
                      <span style={{ color: C.faint }}>{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: 16 }}>
                      <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 10, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <p style={{ color: C.muted, fontWeight: 600, fontSize: 12, margin: 0, fontFamily: FONT_BODY }}>Gate Status</p>
                          <button onClick={() => recheck(job.id)} disabled={job.gateLoading} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: C.amber, fontSize: 11, cursor: 'pointer', opacity: job.gateLoading ? 0.4 : 1, fontFamily: FONT_BODY }}>
                            <RotateCcw size={11} /> {job.gateLoading ? 'Checking…' : 'Re-check'}
                          </button>
                        </div>
                        {!gateOn ? (
                          <p style={{ color: C.faint, fontSize: 11.5, margin: 0, fontFamily: FONT_BODY }}>Asset approval gate is <strong style={{ color: C.muted }}>disabled</strong>. Toggle it on to require all campaign assets to be approved before publishing.</p>
                        ) : gateStatus === null ? (
                          <p style={{ color: C.faint, fontSize: 11.5, fontStyle: 'italic', margin: 0, fontFamily: FONT_BODY }}>Gate check unavailable</p>
                        ) : gateStatus?.gated ? (
                          <div>
                            <p style={{ color: C.red, fontSize: 11.5, margin: '0 0 8px', fontFamily: FONT_BODY }}>Job is <strong>blocked</strong> — {blockers.length} asset(s) require approval before this job can run.</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {blockers.map((a: BlockingAsset) => (
                                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 7, padding: '7px 10px' }}>
                                  <AlertTriangle size={11} color={C.amber} />
                                  <span style={{ color: C.muted, fontSize: 11.5, fontWeight: 600, fontFamily: FONT_BODY, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || a.id}</span>
                                  <StatusDotBadge label={a.status} color={C.amber} bg={`${C.amber}12`} border={`${C.amber}28`} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p style={{ color: C.green, fontSize: 11.5, margin: 0, fontFamily: FONT_BODY }}>
                            <Check size={12} style={{ display: 'inline', marginRight: 4, marginBottom: -2 }} />All campaign assets are approved — job can proceed.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination page={page} total={total} pageSize={15} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TAB 4 — BUDGET & RISK (new: Phase 45/46 risk and budget data)
══════════════════════════════════════════════════════════════════════ */
function BudgetRiskTab({ orgId }: { orgId: string }) {
  const [campaigns,      setCampaigns]      = useState<any[]>([]);
  const [thresholds,     setThresholds]     = useState<any>(null);
  const [riskAudits,     setRiskAudits]     = useState<Record<string, any>>({});
  const [reallocations,  setReallocations]  = useState<Record<string, any[]>>({});
  const [perfMetrics,    setPerfMetrics]    = useState<Record<string, any>>({});
  const [loading,        setLoading]        = useState(true);
  const [applying,       setApplying]       = useState<string | null>(null);
  const [applyResult,    setApplyResult]    = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        // Fetch campaigns (use lifecycle list for ids)
        const lc = await API(`/platform/campaigns/orgs/${orgId}/campaigns/lifecycle?limit=50`).catch(() => ({ items: [] }));
        const camps: Campaign[] = lc.items ?? [];
        if (!cancelled) setCampaigns(camps);

        // Fetch risk thresholds
        const thresh = await API(`/platform/campaigns/orgs/${orgId}/risk-thresholds`).catch(() => null);
        if (!cancelled) setThresholds(thresh);

        // For each campaign, fetch risk audit, budget reallocations, and performance metrics
        await Promise.all(camps.map(async (c) => {
          const [audit, allocs, perf] = await Promise.all([
            API(`/platform/campaigns/campaigns/${c.id}/risk/audit`).catch(() => null),
            API(`/platform/campaign-optim/campaigns/${c.id}/budget-reallocations`).catch(() => ({ items: [] })),
            API(`/campaigns/${c.id}/performance-metrics`).catch(() => null),
          ]);
          if (!cancelled) {
            setRiskAudits(prev => ({ ...prev, [c.id]: audit }));
            setReallocations(prev => ({ ...prev, [c.id]: allocs?.items ?? allocs?.reallocations ?? [] }));
            setPerfMetrics(prev => ({ ...prev, [c.id]: perf }));
          }
        }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  const handleApplyBudget = async (campaignId: string) => {
    setApplying(campaignId);
    try {
      const res = await API(`/campaigns/${campaignId}/optimize-budget`, {
        method: 'POST',
        body:   JSON.stringify({ apply: true }),
      });
      setApplyResult(prev => ({ ...prev, [campaignId]: res?.message ?? 'Budget optimization applied.' }));
    } catch (err: any) {
      setApplyResult(prev => ({ ...prev, [campaignId]: `Error: ${err.message}` }));
    } finally {
      setApplying(null);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Spinner /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Sub-section A: Risk Thresholds */}
      <Card accent={C.red}>
        <SectionLabel color={C.red}>RISK THRESHOLDS</SectionLabel>
        <p style={{ color: C.text, fontWeight: 700, fontSize: 13, margin: '0 0 14px', fontFamily: FONT_HEAD }}>Org Risk Configuration</p>
        {!thresholds ? (
          <p style={{ color: C.faint, fontSize: 12.5, fontFamily: FONT_BODY }}>No threshold data available (403 or plan restriction).</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {[
              { label: 'AUTO-ESCALATION',   value: thresholds.auto_escalation_threshold,  color: C.red    },
              { label: 'APPROVAL REQUIRED', value: thresholds.approval_required_threshold, color: C.amber  },
              { label: 'FORCE ESCALATION',  value: thresholds.force_escalation_threshold,  color: C.purple },
            ].map(t => (
              <div key={t.label} style={{ background: C.raised, borderRadius: 10, padding: '12px 16px', border: `1px solid ${t.color}25`, flex: '1 1 140px' }}>
                <p style={{ color: C.faint, fontSize: 9.5, fontFamily: FONT_MONO, margin: '0 0 4px' }}>{t.label}</p>
                <p style={{ color: t.color, fontSize: 22, fontWeight: 800, fontFamily: FONT_HEAD, margin: 0 }}>{t.value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Per-campaign panels */}
      {campaigns.length === 0 ? (
        <EmptyState icon={BarChart3} title="No campaigns" sub="Active campaigns will appear here with their risk and budget data." color={C.blue} />
      ) : campaigns.map((c: any) => {
        const audit  = riskAudits[c.id];
        const allocs = reallocations[c.id] ?? [];
        const perf   = perfMetrics[c.id];
        return (
          <Card key={c.id} accent={C.blue}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ color: C.text, fontWeight: 700, fontSize: 13, fontFamily: FONT_HEAD }}>{c.name ?? c.id}</span>
              <span style={{ fontSize: 10.5, fontFamily: FONT_MONO, fontWeight: 700, color: stateColor(c.lifecycle_state) }}>{c.lifecycle_state}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {/* Sub-section B: Risk Audit */}
              <div style={{ flex: '1 1 200px' }}>
                <SectionLabel color={C.red}>RISK AUDIT</SectionLabel>
                {!audit?.entries?.length && !audit?.score ? (
                  <p style={{ color: C.faint, fontSize: 12, fontFamily: FONT_BODY }}>No risk audit data</p>
                ) : (
                  <div>
                    {audit?.score != null && <RiskBadge score={audit.score} category={audit.category ?? 'unknown'} />}
                    {audit?.contributing_factors && <ContributingFactorsList factors={audit.contributing_factors} />}
                    {audit?.policy_version && <p style={{ color: C.faint, fontSize: 10.5, fontFamily: FONT_MONO, margin: '8px 0 0' }}>Policy v{audit.policy_version}</p>}
                  </div>
                )}
              </div>

              {/* Sub-section D: Performance Snapshot */}
              <div style={{ flex: '1 1 200px' }}>
                <SectionLabel color={C.green}>PERFORMANCE SNAPSHOT</SectionLabel>
                {!perf ? (
                  <p style={{ color: C.faint, fontSize: 12, fontFamily: FONT_BODY }}>No performance data</p>
                ) : (
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {[
                      { label: 'SPEND',       value: fmtUSD(perf.spend_usd ?? 0)        },
                      { label: 'CONVERSIONS', value: fmtNum(perf.conversions ?? 0)       },
                      { label: 'ROAS',        value: (perf.roas ?? 0).toFixed(2)         },
                    ].map(m => (
                      <div key={m.label}>
                        <p style={{ color: C.faint, fontSize: 9.5, fontFamily: FONT_MONO, margin: '0 0 2px' }}>{m.label}</p>
                        <p style={{ color: C.green, fontSize: 16, fontWeight: 800, fontFamily: FONT_HEAD, margin: 0 }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sub-section C: Budget Reallocation Feed */}
            {allocs.length > 0 && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <SectionLabel color={C.blue}>BUDGET REALLOCATION PROPOSALS</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {allocs.map((alloc: any, i: number) => (
                    <div key={i} style={{ background: C.raised, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ color: C.text, fontSize: 12.5, fontWeight: 600, margin: '0 0 3px', fontFamily: FONT_BODY }}>{alloc.channel ?? alloc.platform ?? 'Channel'}</p>
                        <p style={{ color: C.faint, fontSize: 11.5, margin: 0, fontFamily: FONT_BODY }}>{alloc.reason ?? alloc.rationale ?? '—'}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {alloc.change_pct != null && (
                          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT_MONO, color: alloc.change_pct >= 0 ? C.green : C.red }}>
                            {alloc.change_pct >= 0 ? '▲' : '▼'} {Math.abs(alloc.change_pct)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {applyResult[c.id] && <p style={{ color: C.green, fontSize: 12, fontFamily: FONT_BODY, margin: '0 0 10px' }}>{applyResult[c.id]}</p>}
                <BtnPrimary color={C.blue} onClick={() => handleApplyBudget(c.id)} disabled={applying === c.id} style={{ padding: '7px 14px', fontSize: 12 }}>
                  <DollarSign size={12} /> {applying === c.id ? 'Applying…' : 'Apply Budget Optimization'}
                </BtnPrimary>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TAB 5 — AD ACCOUNTS (AdAccounts.tsx logic embedded verbatim)
══════════════════════════════════════════════════════════════════════ */

/* ── Ad Accounts platform metadata ──────────────────────────────────── */
const PLATFORM_META_AA: Record<string, { label: string; color: string; envHint: string }> = {
  meta_ads:    { label: "Meta Ads",     color: "#1877F2", envHint: "META_ADS_APP_ID + META_ADS_APP_SECRET" },
  google_ads:  { label: "Google Ads",   color: "#4285F4", envHint: "GOOGLE_ADS_CLIENT_ID + GOOGLE_ADS_DEVELOPER_TOKEN" },
  tiktok_ads:  { label: "TikTok Ads",   color: "#EE1D52", envHint: "TIKTOK_ADS_APP_ID + TIKTOK_ADS_APP_SECRET" },
  linkedin_ads:{ label: "LinkedIn Ads", color: "#0A66C2", envHint: "LINKEDIN_ADS_CLIENT_ID + LINKEDIN_ADS_CLIENT_SECRET" },
};
const AD_PLATFORM_IDS_AA = Object.keys(PLATFORM_META_AA);
type DateRange = "last_7d" | "last_30d";
type DayPoint  = { date: string; spend_usd: number };
type CampaignAA = { id: string; name: string; status: string; objective: string | null; budget: number | null; budget_type: string | null; };

const isActiveAA  = (s: string) => ["ACTIVE","ENABLED","IN_PROCESS"].includes((s ?? "").toUpperCase());
const isPausedAA  = (s: string) => ["PAUSED","CAMPAIGN_PAUSED","DISABLE","DISABLED"].includes((s ?? "").toUpperCase());

function padSparklineAA(days: DayPoint[]): DayPoint[] {
  const today = new Date(); const points: DayPoint[] = [];
  const byDate = Object.fromEntries(days.map(d => [d.date, d.spend_usd]));
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({ date: key, spend_usd: byDate[key] ?? 0 });
  }
  return points;
}

function PlatformBadgeAA({ pid, size = 36 }: { pid: string; size?: number }) {
  const m = PLATFORM_META_AA[pid]; if (!m) return null;
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.25), background: m.color + "22", border: `1.5px solid ${m.color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <PlatformSVGIcon id={pid} size={Math.round(size * 0.58)} />
    </div>
  );
}

function SpinnerAA({ size = 18, color = C.green }: { size?: number; color?: string }) {
  return <Loader2 size={size} className="animate-spin" color={color} />;
}

function StatTileAA({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{ background: "#131824", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", flex: "1 1 110px", minWidth: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
        <span style={{ color: accent }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: FONT_MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: FONT_BODY, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function StatusBadgeAA({ status }: { status: string }) {
  const s = (status ?? "").toUpperCase();
  const active = isActiveAA(s); const paused = isPausedAA(s);
  const color = active ? C.green : paused ? C.amber : s === "DRAFT" ? C.blue : C.faint;
  const bg    = active ? "rgba(0,200,150,0.1)" : paused ? "rgba(251,191,36,0.1)" : s === "DRAFT" ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.05)";
  const Icon  = active ? PlayCircle : paused ? PauseCircle : FileText;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: bg, border: `1px solid ${color}33`, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700, color, fontFamily: FONT_MONO }}>
      <Icon size={10} /> {s}
    </span>
  );
}

function SparklineSVGAA({ days, accentColor = C.green }: { days: DayPoint[]; accentColor?: string }) {
  const W = 80; const H = 28; const GAP = 2; const N = days.length;
  const barW = (W - GAP * (N - 1)) / N;
  const maxSpend = Math.max(...days.map(d => d.spend_usd), 0.01);
  const [tooltip, setTooltip] = useState<{ i: number; x: number } | null>(null);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`sg-${accentColor.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.8"/>
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.2"/>
          </linearGradient>
        </defs>
        {days.map((d, i) => {
          const barH = Math.max((d.spend_usd / maxSpend) * (H - 2), d.spend_usd > 0 ? 2 : 0);
          const x = i * (barW + GAP); const y = H - barH;
          return (
            <rect key={d.date} x={x} y={y} width={barW} height={barH} rx={1.5} ry={1.5}
              fill={`url(#sg-${accentColor.replace('#','')})`} opacity={tooltip?.i === i ? 1 : 0.7}
              style={{ cursor: "default", transition: "opacity 0.1s" }}
              onMouseEnter={() => setTooltip({ i, x: x + barW / 2 })}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </svg>
      {tooltip !== null && (() => {
        const d = days[tooltip.i];
        return (
          <div style={{ position: "absolute", bottom: H + 6, left: tooltip.x - 40, width: 80, background: "#131824", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 10, fontFamily: FONT_MONO, color: C.text, pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap", textAlign: "center" }}>
            <div style={{ color: C.muted }}>{d.date.slice(5)}</div>
            <div style={{ color: accentColor, fontWeight: 700 }}>${d.spend_usd.toFixed(2)}</div>
          </div>
        );
      })()}
    </div>
  );
}

function SparklineCellAA({ platform, accountId, campaign, accentColor }: { platform: string; accountId: string; campaign: CampaignAA; accentColor: string; }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 300); return () => clearTimeout(t); }, []);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["campaign-daily-spend", platform, accountId, campaign.id],
    queryFn:  () => adPlatformAPI.campaignDailySpend(platform, accountId, campaign.id),
    enabled:  revealed, staleTime: 10 * 60_000, retry: 1,
  });
  if (!revealed || isLoading) return (
    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 28 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ width: 9, height: Math.random() * 18 + 4, background: "rgba(255,255,255,0.06)", borderRadius: 1.5, animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 80}ms` }}/>
      ))}
    </div>
  );
  if (isError || !data) return <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.faint }}><BarChart2 size={10}/> —</div>;
  const daysData = padSparklineAA(data.days ?? []);
  const total = daysData.reduce((s, d) => s + d.spend_usd, 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <SparklineSVGAA days={daysData} accentColor={accentColor}/>
      <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: C.muted, whiteSpace: "nowrap" }}>${total.toFixed(0)} / 7d</span>
    </div>
  );
}

function InsightsRowAA({ platform, accountId, dateRange }: { platform: string; accountId: string; dateRange: DateRange }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["account-insights", platform, accountId, dateRange],
    queryFn:  () => adPlatformAPI.accountInsights(platform, accountId, dateRange),
    staleTime: 5 * 60_000, retry: 1,
  });
  const m = data?.metrics;
  const fmt = {
    spend: (v: number) => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v.toFixed(2)}`,
    int:   (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(Math.round(v)),
    pct:   (v: number) => `${(v*100).toFixed(2)}%`,
    usd:   (v: number) => `$${v.toFixed(2)}`,
  };
  if (isLoading) return <div style={{ display:"flex", alignItems:"center", gap:8, color:C.muted, fontSize:12, padding:"4px 0 8px" }}><SpinnerAA size={13}/> Loading {dateRange==="last_7d"?"7-day":"30-day"} metrics…</div>;
  if (error) return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
      <div style={{ flex:1, display:"flex", alignItems:"center", gap:6, background:"rgba(251,113,133,0.07)", borderRadius:7, padding:"8px 12px", fontSize:12, color:C.red }}><AlertCircle size={12}/>{(error as any)?.message ?? "Could not load insights"}</div>
      <button onClick={()=>refetch()} style={{ background:"none", border:"none", cursor:"pointer", color:C.faint, padding:4 }}><RefreshCw size={13}/></button>
    </div>
  );
  if (!m) return null;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:12 }}>
      <StatTileAA icon={<DollarSign size={11}/>}        label="Spend"       value={fmt.spend(m.spend_usd)}    sub={dateRange==="last_7d"?"7 days":"30 days"} accent={C.green}/>
      <StatTileAA icon={<Eye size={11}/>}               label="Impressions" value={fmt.int(m.views)}          sub="views"                   accent={C.blue}/>
      <StatTileAA icon={<MousePointerClick size={11}/>} label="Clicks"      value={fmt.int(m.clicks)}         sub={`CTR ${fmt.pct(m.ctr)}`} accent={C.purple}/>
      <StatTileAA icon={<TrendUp size={11}/>}           label="Conv."       value={fmt.int(m.conversions??0)} sub={`CPM ${fmt.usd(m.cpm)}`} accent={C.amber}/>
    </div>
  );
}

function BudgetCellAA({ campaign, platform, accountId, onSaved }: { campaign: CampaignAA; platform: string; accountId: string; onSaved: (id: string, v: number) => void; }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const budgetMut = useMutation({
    mutationFn: (v: number) => adPlatformAPI.updateCampaignBudget(platform, accountId, campaign.id, v),
    onSuccess: (_d, v) => { toast({ title: "Budget updated", description: `Set to $${v.toFixed(2)}` }); onSaved(campaign.id, v); setEditing(false); },
    onError: (e: any) => { toast({ title: "Budget update failed", description: e?.message, variant: "destructive" }); setEditing(false); },
  });
  const commit = () => {
    const v = parseFloat(draft.replace(/[^0-9.]/g, ""));
    if (!isNaN(v) && v > 0) budgetMut.mutate(v); else setEditing(false);
  };
  const fmtBudget = (v: number | null, t: string | null) =>
    v == null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${t === "lifetime" ? " lifetime" : "/day"}`;
  if (editing) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <span style={{ fontSize:11, color:C.faint, fontFamily:FONT_MONO }}>$</span>
        <input ref={inputRef} value={draft} onChange={e=>setDraft(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter")commit(); if(e.key==="Escape")setEditing(false); }}
          placeholder={(campaign.budget??0).toFixed(2)}
          style={{ width:80, background:"rgba(255,255,255,0.06)", border:`1px solid ${C.blue}55`, borderRadius:5, color:C.text, fontSize:11, fontFamily:FONT_MONO, padding:"3px 6px", outline:"none" }}
        />
        <button onClick={commit} disabled={budgetMut.isPending} title="Save" style={{ background:"rgba(0,200,150,0.15)", border:`1px solid ${C.green}44`, borderRadius:5, padding:"3px 6px", cursor:"pointer", color:C.green, display:"flex", alignItems:"center" }}>
          {budgetMut.isPending ? <SpinnerAA size={10} color={C.green}/> : <Check size={10}/>}
        </button>
        <button onClick={()=>setEditing(false)} title="Cancel" style={{ background:"rgba(251,113,133,0.1)", border:`1px solid ${C.red}44`, borderRadius:5, padding:"3px 6px", cursor:"pointer", color:C.red, display:"flex", alignItems:"center" }}>
          <X size={10}/>
        </button>
      </div>
    );
  }
  return (
    <div onClick={()=>{ setDraft(campaign.budget!=null?String(campaign.budget):""); setEditing(true); }} title="Click to edit budget"
      style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", color:C.muted, fontSize:12, fontFamily:FONT_MONO }}>
      {fmtBudget(campaign.budget, campaign.budget_type)}
      <Pencil size={10} style={{ opacity:0.5 }}/>
    </div>
  );
}

function CampaignTableAA({ platform, accountId }: { platform: string; accountId: string }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const accentColor = PLATFORM_META_AA[platform]?.color ?? C.green;
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<CampaignAA>>>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["campaigns", platform, accountId],
    queryFn:  () => adPlatformAPI.listCampaigns(platform, accountId),
    staleTime: 3 * 60_000, retry: 1,
  });

  const statusMut = useMutation({
    mutationFn: ({ campaignId, action }: { campaignId: string; action: 'pause'|'resume' }) =>
      adPlatformAPI.setCampaignStatus(platform, accountId, campaignId, action),
    onMutate: ({ campaignId, action }) => {
      setLocalOverrides(prev => ({ ...prev, [campaignId]: { status: action === 'pause' ? 'PAUSED' : 'ACTIVE' } }));
    },
    onSuccess: (d, { campaignId }) => {
      toast({ title: "Status updated", description: `Campaign is now ${d.status}` });
      qc.invalidateQueries({ queryKey: ["campaigns", platform, accountId] });
      setLocalOverrides(prev => { const n = { ...prev }; delete n[campaignId]; return n; });
    },
    onError: (e: any, { campaignId }) => {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
      setLocalOverrides(prev => { const n = { ...prev }; delete n[campaignId]; return n; });
    },
  });

  const campaigns = (data?.campaigns ?? []).map(c => ({ ...c, ...(localOverrides[c.id] ?? {}) }));

  if (isLoading) return <div style={{ display:"flex", alignItems:"center", gap:8, color:C.muted, fontSize:12 }}><SpinnerAA size={14}/> Loading campaigns…</div>;
  if (error) return <div style={{ fontSize:12, color:C.red }}>{(error as any)?.message ?? "Could not load campaigns"} <button onClick={()=>refetch()} style={{ background:"none", border:"none", cursor:"pointer", color:C.blue, fontSize:12 }}>Retry</button></div>;
  if (!campaigns.length) return <div style={{ fontSize:12, color:C.faint }}>No campaigns found for this account.</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {campaigns.map(camp => {
        const active = isActiveAA(camp.status); const paused = isPausedAA(camp.status);
        return (
          <div key={camp.id} style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:10, alignItems:"center", background:"rgba(255,255,255,0.02)", borderRadius:7, padding:"9px 12px", border:`1px solid ${C.border}` }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:600, color:C.text, fontFamily:FONT_BODY, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{camp.name}</div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3 }}>
                <StatusBadgeAA status={camp.status}/>
                <BudgetCellAA campaign={camp} platform={platform} accountId={accountId} onSaved={(id,v)=>setLocalOverrides(prev=>({...prev,[id]:{budget:v}}))}/>
              </div>
            </div>
            <SparklineCellAA platform={platform} accountId={accountId} campaign={camp} accentColor={accentColor}/>
            <div style={{ display:"flex", gap:5 }}>
              {active && (
                <button onClick={()=>statusMut.mutate({campaignId:camp.id,action:'pause'})} disabled={statusMut.isPending} title="Pause campaign"
                  style={{ background:"rgba(251,191,36,0.08)", border:`1px solid rgba(251,191,36,0.22)`, borderRadius:6, padding:"4px 9px", cursor:"pointer", color:C.amber, display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600 }}>
                  {statusMut.isPending&&statusMut.variables?.campaignId===camp.id?<SpinnerAA size={10} color={C.amber}/>:<PauseCircle size={11}/>} Pause
                </button>
              )}
              {paused && (
                <button onClick={()=>statusMut.mutate({campaignId:camp.id,action:'resume'})} disabled={statusMut.isPending} title="Resume campaign"
                  style={{ background:"rgba(0,200,150,0.08)", border:`1px solid rgba(0,200,150,0.22)`, borderRadius:6, padding:"4px 9px", cursor:"pointer", color:C.green, display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600 }}>
                  {statusMut.isPending&&statusMut.variables?.campaignId===camp.id?<SpinnerAA size={10} color={C.green}/>:<PlayCircle size={11}/>} Resume
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AccountCardAA({ conn, dateRange, onRevoke, revoking }: { conn: any; dateRange: DateRange; onRevoke: () => void; revoking: boolean; }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:open?`1px solid ${C.border}`:"none", cursor:"pointer" }} onClick={()=>setOpen(o=>!o)}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:conn.status==="active"?C.green:C.amber, flexShrink:0 }}/>
          <span style={{ fontSize:14, fontWeight:700, color:C.text, fontFamily:FONT_BODY }}>{conn.account_name??conn.account_id}</span>
          <span style={{ fontSize:11, color:C.faint, fontFamily:FONT_MONO }}>{conn.account_id}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }} onClick={e=>e.stopPropagation()}>
          <button disabled={revoking} onClick={onRevoke} style={{ background:"rgba(251,113,133,0.08)", border:"1px solid rgba(251,113,133,0.18)", borderRadius:6, padding:"4px 10px", cursor:revoking?"not-allowed":"pointer", color:C.red, display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600 }}>
            {revoking?<SpinnerAA size={11} color={C.red}/>:<Unplug size={11}/>} Disconnect
          </button>
          <button onClick={()=>setOpen(o=>!o)} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 10px", cursor:"pointer", color:C.muted, display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600 }}>
            {open?<ChevronDown size={12}/>:<ChevronRight size={12}/>} {open?"Hide":"Campaigns"}
          </button>
        </div>
      </div>
      <div style={{ padding:"14px 16px" }}>
        <InsightsRowAA platform={conn.platform} accountId={conn.account_id} dateRange={dateRange}/>
        {open && (
          <div style={{ background:"#0A0D18", borderRadius:8, padding:"12px 14px", border:`1px solid rgba(255,255,255,0.04)`, marginTop:4 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, fontFamily:FONT_MONO, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
              <Megaphone size={11}/> Campaigns
            </div>
            <CampaignTableAA platform={conn.platform} accountId={conn.account_id}/>
          </div>
        )}
      </div>
    </div>
  );
}

function AdAccountsTab() {
  const navigate = useNavigate();
  const qc = useQueryClient(); const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>("last_7d");

  const { data, isLoading } = useQuery({ queryKey: ["ad-accounts-connected"], queryFn: () => adPlatformAPI.listConnected() });
  const connections = (data?.connections ?? []).filter((c: any) => c.account_id !== "pending");

  const revokeMut = useMutation({
    mutationFn: ({ platform, accountId }: { platform: string; accountId: string }) => adPlatformAPI.revoke(platform, accountId),
    onSuccess: (_d, vars: any) => {
      toast({ title: "Disconnected", description: `${PLATFORM_META_AA[vars.platform]?.label ?? vars.platform} account removed.` });
      qc.invalidateQueries({ queryKey: ["ad-accounts-connected"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const startConnect = (pid: string) => { window.location.href = `${API_BASE_URL}/api/ad-platforms/${pid}/connect?token=${encodeURIComponent(tokenStore.get() ?? "")}`; };

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      {/* Connect New Account shortcut */}
      <div style={{ marginBottom: 20 }}>
        <BtnSecondary color={C.blue} onClick={() => navigate('/connections')} style={{ padding: '8px 16px' }}>
          <Plus size={13} /> Connect New Account
        </BtnSecondary>
      </div>

      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:C.text, fontFamily:FONT_BODY }}>Ad Platform Accounts</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:5 }}>Connect accounts · view metrics · manage campaigns — all in one place.</div>
        </div>
        <div style={{ display:"flex", background:C.raised, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
          {(["last_7d","last_30d"] as DateRange[]).map(dr=>(
            <button key={dr} onClick={()=>setDateRange(dr)} style={{ padding:"7px 14px", border:"none", background:dateRange===dr?"rgba(0,200,150,0.12)":"transparent", color:dateRange===dr?C.green:C.muted, fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:FONT_MONO, borderRight:dr==="last_7d"?`1px solid ${C.border}`:"none" }}>
              {dr==="last_7d"?"7 days":"30 days"}
            </button>
          ))}
        </div>
      </div>

      {AD_PLATFORM_IDS_AA.map(pid => {
        const meta = PLATFORM_META_AA[pid];
        const conns = connections.filter((c: any) => c.platform === pid);
        return (
          <div key={pid} style={{ marginBottom: 30 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <PlatformBadgeAA pid={pid} size={30}/>
                <span style={{ fontSize:15, fontWeight:700, color:C.text, fontFamily:FONT_BODY }}>{meta.label}</span>
                {conns.length>0&&<span style={{ fontSize:11, background:"rgba(0,200,150,0.1)", border:"1px solid rgba(0,200,150,0.2)", color:C.green, borderRadius:20, padding:"2px 9px", fontWeight:700, fontFamily:FONT_MONO }}>{conns.length} connected</span>}
              </div>
              <button onClick={()=>startConnect(pid)} style={{ background:"rgba(56,189,248,0.08)", border:`1px solid rgba(56,189,248,0.22)`, borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, color:C.blue, cursor:"pointer", fontFamily:FONT_BODY }}>+ Connect</button>
            </div>
            {isLoading&&<div style={{ display:"flex", gap:8, color:C.muted, fontSize:13, alignItems:"center", padding:"8px 0" }}><SpinnerAA size={14}/> Loading…</div>}
            {!isLoading&&conns.length===0&&(
              <div style={{ background:C.raised, border:`1px dashed ${C.border}`, borderRadius:10, padding:"20px 18px", fontSize:13, color:C.faint, textAlign:"center" }}>
                No {meta.label} accounts connected — click <strong style={{ color:C.blue }}>+ Connect</strong> to start OAuth.
              </div>
            )}
            {conns.map((conn: any) => (
              <AccountCardAA key={conn.id} conn={conn} dateRange={dateRange}
                onRevoke={() => revokeMut.mutate({ platform: conn.platform, accountId: conn.account_id })}
                revoking={revokeMut.isPending && (revokeMut.variables as any)?.accountId === conn.account_id}
              />
            ))}
          </div>
        );
      })}

      <div style={{ background:C.raised, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", marginTop:4 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, fontFamily:FONT_MONO, letterSpacing:"0.06em", marginBottom:10, textTransform:"uppercase" }}>Required Environment Variables</div>
        {AD_PLATFORM_IDS_AA.map(pid=>(
          <div key={pid} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, fontFamily:FONT_MONO, color:C.faint, marginBottom:4 }}>
            <PlatformBadgeAA pid={pid} size={16}/>
            <span style={{ color:C.muted }}>{PLATFORM_META_AA[pid].label}:</span>
            <span>{PLATFORM_META_AA[pid].envHint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PAGE ROOT
══════════════════════════════════════════════════════════════════════ */
export default function CampaignAgentsPage() {
  const [tab, setTab]       = useState<CampaignTab>('overview');
  const [searchParams]      = useSearchParams();
  const orgId               = (window as any).__ORG_ID__ ?? 'demo';

  const [launchPrompt, setLaunchPrompt] = useState('');
  const [launching,    setLaunching]    = useState(false);
  const [launchResult, setLaunchResult] = useState<string | null>(null);
  const [launchError,  setLaunchError]  = useState<string | null>(null);

  const [stats, setStats] = useState<{
    activeCampaigns:   number | null;
    pendingApprovals:  number | null;
    connectedAccounts: number | null;
    totalSpendToday:   number | null;
  }>({ activeCampaigns: null, pendingApprovals: null, connectedAccounts: null, totalSpendToday: null });

  // TASK 4: Read tab from URL ?tab= param on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab') as CampaignTab | null;
    if (tabParam && TAB_DEFS.some(t => t.id === tabParam)) {
      setTab(tabParam);
    }
  }, []);

  // Fetch page-level stat pills
  useEffect(() => {
    let cancelled = false;
    API('/campaigns?status=active&limit=1').then(r => {
      if (!cancelled) setStats(s => ({ ...s, activeCampaigns: r.total ?? 0 }));
    }).catch(() => {});

    if (orgId) {
      API(`/platform/campaigns/orgs/${orgId}/approval-queue?limit=1`).then(r => {
        if (!cancelled) setStats(s => ({ ...s, pendingApprovals: r.total ?? 0 }));
      }).catch(() => {});
    }

    API('/ad-platforms/connections').then(r => {
      if (!cancelled) setStats(s => ({ ...s, connectedAccounts: Array.isArray(r.connections) ? r.connections.length : (Array.isArray(r) ? r.length : 0) }));
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [orgId]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ padding: 'clamp(16px,3vw,28px)', maxWidth: 1440, margin: '0 auto' }}>
        <PageHeader
          label="CAMPAIGN AGENTS"
          title="Campaign Agents"
          sub="Autonomous campaign orchestration, approval governance, budget intelligence, and ad account management."
          color={C.purple}
        />

        {/* Stat pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          <StatPill icon={Bot}           value={stats.activeCampaigns   ?? '…'} label="ACTIVE CAMPAIGNS"  color={C.purple} />
          <StatPill icon={AlertTriangle} value={stats.pendingApprovals  ?? '…'} label="PENDING APPROVALS"  color={C.amber}  />
          <StatPill icon={CreditCard}    value={stats.connectedAccounts ?? '…'} label="AD ACCOUNTS"        color={C.blue}   />
          <StatPill icon={Activity}      value="Live"                            label="AGENT STATUS"       color={C.green}  />
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: `1px solid ${C.border}`, paddingBottom: 2, flexWrap: 'wrap' }}>
          {TAB_DEFS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                background: tab === t.id ? `${t.color}14` : 'none',
                color:      tab === t.id ? t.color : C.muted,
                fontWeight: 600, fontSize: 13, fontFamily: FONT_BODY,
                borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
                marginBottom: -2, transition: 'all 0.15s',
              }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview'    && <OverviewTab />}
        {tab === 'cockpit'     && <CockpitTab orgId={orgId} />}
        {tab === 'gates'       && <GatesTab />}
        {tab === 'budget'      && <BudgetRiskTab orgId={orgId} />}
        {tab === 'adaccounts'  && <AdAccountsTab />}
      </div>

      <style>{`
        @keyframes af-skeleton-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes af-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
