/**
 * AutoFlowNG — /settings/ad-accounts
 *
 * Views:
 *  1. SELECT ACCOUNT (?platform=X&step=select-account) — post-OAuth account picker
 *  2. DASHBOARD — connected accounts with:
 *       • 7d / 30d account-level spend/impressions/clicks/CTR tiles
 *       • Expandable campaign table with:
 *           – Pause / Resume toggle (optimistic)
 *           – Inline click-to-edit budget (optimistic)
 *           – 7-day spend sparkline (SVG bar chart, lazy per row)
 */

import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle2, Loader2, AlertCircle,
  Building2, Unplug, TrendingUp, MousePointerClick,
  DollarSign, Eye, RefreshCw, ChevronDown, ChevronRight,
  Megaphone, PauseCircle, PlayCircle, FileText,
  Pencil, X, Check, BarChart2,
} from "lucide-react";
import { adPlatformAPI, API_BASE_URL, tokenStore } from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { PlatformSVGIcon } from "../components/PlatformIcons";

/* ── Design tokens ──────────────────────────────────────────────────── */
const C = {
  bg:      "#060810",
  surface: "#0C0F1A",
  raised:  "#111520",
  card:    "#131824",
  deeper:  "#0A0D18",
  border:  "rgba(255,255,255,0.06)",
  divider: "rgba(255,255,255,0.04)",
  text:    "#E2E8FF",
  muted:   "rgba(226,232,255,0.45)",
  faint:   "rgba(226,232,255,0.18)",
  green:   "#00C896",
  blue:    "#38BDF8",
  purple:  "#A78BFA",
  amber:   "#FBBF24",
  red:     "#FB7185",
};

/* ── Platform metadata ──────────────────────────────────────────────── */
const PLATFORM_META: Record<string, { label: string; color: string; icon: string; envHint: string }> = {
  meta_ads:    { label: "Meta Ads",     color: "#1877F2", icon: "M",  envHint: "META_ADS_APP_ID + META_ADS_APP_SECRET" },
  google_ads:  { label: "Google Ads",   color: "#4285F4", icon: "G",  envHint: "GOOGLE_ADS_CLIENT_ID + GOOGLE_ADS_DEVELOPER_TOKEN" },
  tiktok_ads:  { label: "TikTok Ads",   color: "#EE1D52", icon: "T",  envHint: "TIKTOK_ADS_APP_ID + TIKTOK_ADS_APP_SECRET" },
  linkedin_ads:{ label: "LinkedIn Ads", color: "#0A66C2", icon: "in", envHint: "LINKEDIN_ADS_CLIENT_ID + LINKEDIN_ADS_CLIENT_SECRET" },
};
const AD_PLATFORM_IDS = Object.keys(PLATFORM_META);
type DateRange = "last_7d" | "last_30d";

type DayPoint = { date: string; spend_usd: number };
type Campaign = {
  id: string; name: string; status: string;
  objective: string | null; budget: number | null; budget_type: string | null;
};

/* ── Helpers ────────────────────────────────────────────────────────── */
const isActive  = (s: string) => ["ACTIVE","ENABLED","IN_PROCESS"].includes((s ?? "").toUpperCase());
const isPaused  = (s: string) => ["PAUSED","CAMPAIGN_PAUSED","DISABLE","DISABLED"].includes((s ?? "").toUpperCase());
const canToggle = (s: string) => isActive(s) || isPaused(s);

/* Fill any missing days in a 7-point series with 0 */
function padSparkline(days: DayPoint[]): DayPoint[] {
  const today  = new Date();
  const points: DayPoint[] = [];
  const byDate = Object.fromEntries(days.map(d => [d.date, d.spend_usd]));
  for (let i = 6; i >= 0; i--) {
    const d  = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({ date: key, spend_usd: byDate[key] ?? 0 });
  }
  return points;
}

/* ── Primitives ─────────────────────────────────────────────────────── */
function PlatformBadge({ pid, size = 36 }: { pid: string; size?: number }) {
  const m = PLATFORM_META[pid]; if (!m) return null;
  // Use the brand SVG icon from PlatformIcons instead of a letter monogram.
  // The background is kept so the icon has a branded coloured backdrop,
  // matching the visual language of the rest of the UI.
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.25), background: m.color + "22", border: `1.5px solid ${m.color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <PlatformSVGIcon id={pid} size={Math.round(size * 0.58)} />
    </div>
  );
}
function Spinner({ size = 18, color = C.green }: { size?: number; color?: string }) {
  return <Loader2 size={size} className="animate-spin" color={color} />;
}
function StatTile({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", flex: "1 1 110px", minWidth: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
        <span style={{ color: accent }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "'DM Sans',sans-serif", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toUpperCase();
  const active = isActive(s); const paused = isPaused(s);
  const color = active ? C.green : paused ? C.amber : s === "DRAFT" ? C.blue : C.faint;
  const bg    = active ? "rgba(0,200,150,0.1)" : paused ? "rgba(251,191,36,0.1)" : s === "DRAFT" ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.05)";
  const Icon  = active ? PlayCircle : paused ? PauseCircle : FileText;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: bg, border: `1px solid ${color}33`, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700, color, fontFamily: "'DM Mono',monospace" }}>
      <Icon size={10} /> {s}
    </span>
  );
}

/* ── Spend sparkline SVG ────────────────────────────────────────────── */
function SparklineSVG({ days, accentColor = C.green }: { days: DayPoint[]; accentColor?: string }) {
  const W = 80; const H = 28; const GAP = 2;
  const N = days.length;          // always 7
  const barW = (W - GAP * (N - 1)) / N;
  const maxSpend = Math.max(...days.map(d => d.spend_usd), 0.01);

  const [tooltip, setTooltip] = useState<{ i: number; x: number; y: number } | null>(null);
  const hovered = tooltip?.i;

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
          const x    = i * (barW + GAP);
          const y    = H - barH;
          const isHov = hovered === i;
          return (
            <rect
              key={d.date}
              x={x} y={y} width={barW} height={barH}
              rx={1.5} ry={1.5}
              fill={`url(#sg-${accentColor.replace('#','')})`}
              opacity={isHov ? 1 : 0.7}
              style={{ cursor: "default", transition: "opacity 0.1s" }}
              onMouseEnter={e => setTooltip({ i, x: x + barW / 2, y })}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
        {/* zero-spend bar hint */}
        {days.every(d => d.spend_usd === 0) && (
          <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke={C.faint} strokeWidth={1} strokeDasharray="2,2"/>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip !== null && (() => {
        const d = days[tooltip.i];
        return (
          <div style={{
            position: "absolute",
            bottom: H + 6,
            left: tooltip.x - 40,
            width: 80,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "4px 6px",
            fontSize: 10,
            fontFamily: "'DM Mono',monospace",
            color: C.text,
            pointerEvents: "none",
            zIndex: 10,
            whiteSpace: "nowrap",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}>
            <div style={{ color: C.muted }}>{d.date.slice(5)}</div>
            <div style={{ color: accentColor, fontWeight: 700 }}>${d.spend_usd.toFixed(2)}</div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Sparkline cell (lazy-loaded per campaign row) ──────────────────── */
function SparklineCell({ platform, accountId, campaign, accentColor }: {
  platform: string; accountId: string; campaign: Campaign; accentColor: string;
}) {
  const [revealed, setRevealed] = useState(false);

  // Only load when the row is visible (revealed via click or after mount)
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["campaign-daily-spend", platform, accountId, campaign.id],
    queryFn:  () => adPlatformAPI.campaignDailySpend(platform, accountId, campaign.id),
    enabled:  revealed,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  if (!revealed || isLoading) {
    return (
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 28 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{
            width: 9, height: Math.random() * 18 + 4,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 1.5,
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 80}ms`,
          }}/>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.faint }}>
        <BarChart2 size={10}/> —
      </div>
    );
  }

  const days = padSparkline(data.days ?? []);
  const total = days.reduce((s, d) => s + d.spend_usd, 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <SparklineSVG days={days} accentColor={accentColor}/>
      <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: C.muted, whiteSpace: "nowrap" }}>
        ${total.toFixed(0)} / 7d
      </span>
    </div>
  );
}

/* ── Insights row ───────────────────────────────────────────────────── */
function InsightsRow({ platform, accountId, dateRange }: { platform: string; accountId: string; dateRange: DateRange }) {
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
  if (isLoading) return <div style={{ display:"flex", alignItems:"center", gap:8, color:C.muted, fontSize:12, padding:"4px 0 8px" }}><Spinner size={13}/> Loading {dateRange==="last_7d"?"7-day":"30-day"} metrics…</div>;
  if (error) return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
      <div style={{ flex:1, display:"flex", alignItems:"center", gap:6, background:"rgba(251,113,133,0.07)", borderRadius:7, padding:"8px 12px", fontSize:12, color:C.red }}><AlertCircle size={12}/>{(error as any)?.message ?? "Could not load insights"}</div>
      <button onClick={()=>refetch()} style={{ background:"none", border:"none", cursor:"pointer", color:C.faint, padding:4 }}><RefreshCw size={13}/></button>
    </div>
  );
  if (!m) return null;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:12 }}>
      <StatTile icon={<DollarSign size={11}/>}        label="Spend"       value={fmt.spend(m.spend_usd)}    sub={dateRange==="last_7d"?"7 days":"30 days"} accent={C.green}/>
      <StatTile icon={<Eye size={11}/>}               label="Impressions" value={fmt.int(m.views)}          sub="views"                   accent={C.blue}/>
      <StatTile icon={<MousePointerClick size={11}/>} label="Clicks"      value={fmt.int(m.clicks)}         sub={`CTR ${fmt.pct(m.ctr)}`} accent={C.purple}/>
      <StatTile icon={<TrendingUp size={11}/>}        label="Conv."       value={fmt.int(m.conversions??0)} sub={`CPM ${fmt.usd(m.cpm)}`} accent={C.amber}/>
    </div>
  );
}

/* ── Inline budget editor ───────────────────────────────────────────── */
function BudgetCell({ campaign, platform, accountId, onSaved }: {
  campaign: Campaign; platform: string; accountId: string; onSaved: (id: string, v: number) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const budgetMut = useMutation({
    mutationFn: (v: number) => adPlatformAPI.updateCampaignBudget(platform, accountId, campaign.id, v),
    onSuccess: (_d, v) => {
      toast({ title: "Budget updated", description: `Set to $${v.toFixed(2)}` });
      onSaved(campaign.id, v);
      setEditing(false);
    },
    onError: (e: any) => {
      toast({ title: "Budget update failed", description: e?.message, variant: "destructive" });
      setEditing(false);
    },
  });

  const commit = () => {
    const v = parseFloat(draft.replace(/[^0-9.]/g, ""));
    if (!isNaN(v) && v > 0) budgetMut.mutate(v);
    else setEditing(false);
  };

  const fmtBudget = (v: number | null, t: string | null) =>
    v == null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${t === "lifetime" ? " lifetime" : "/day"}`;

  if (editing) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <span style={{ fontSize:11, color:C.faint, fontFamily:"'DM Mono',monospace" }}>$</span>
        <input ref={inputRef} value={draft} onChange={e=>setDraft(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter")commit(); if(e.key==="Escape")setEditing(false); }}
          placeholder={(campaign.budget??0).toFixed(2)}
          style={{ width:80, background:"rgba(255,255,255,0.06)", border:`1px solid ${C.blue}55`, borderRadius:5, color:C.text, fontSize:11, fontFamily:"'DM Mono',monospace", padding:"3px 6px", outline:"none" }}
        />
        <button onClick={commit} disabled={budgetMut.isPending} title="Save" style={{ background:"rgba(0,200,150,0.15)", border:`1px solid ${C.green}44`, borderRadius:5, padding:"3px 6px", cursor:"pointer", color:C.green, display:"flex", alignItems:"center" }}>
          {budgetMut.isPending ? <Spinner size={10} color={C.green}/> : <Check size={10}/>}
        </button>
        <button onClick={()=>setEditing(false)} title="Cancel" style={{ background:"rgba(251,113,133,0.1)", border:`1px solid ${C.red}44`, borderRadius:5, padding:"3px 6px", cursor:"pointer", color:C.red, display:"flex", alignItems:"center" }}>
          <X size={10}/>
        </button>
      </div>
    );
  }

  return (
    <div onClick={()=>{ setDraft(campaign.budget!=null?String(campaign.budget):""); setEditing(true); }} title="Click to edit budget"
      style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:11 }}>
      <span style={{ color: campaign.budget!=null ? C.text : C.faint }}>{fmtBudget(campaign.budget, campaign.budget_type)}</span>
      <Pencil size={10} color={C.faint} style={{ opacity:0.5 }}/>
    </div>
  );
}

/* ── Campaign table ─────────────────────────────────────────────────── */
function CampaignTable({ platform, accountId }: { platform: string; accountId: string }) {
  const qc        = useQueryClient();
  const { toast } = useToast();
  const accent    = PLATFORM_META[platform]?.color ?? C.green;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["campaigns", platform, accountId],
    queryFn:  () => adPlatformAPI.listCampaigns(platform, accountId),
    staleTime: 3 * 60_000, retry: 1,
  });
  const campaigns: Campaign[] = data?.campaigns ?? [];

  /* Optimistic pause/resume */
  const toggleMut = useMutation({
    mutationFn: ({ campaignId, action }: { campaignId: string; action: "pause"|"resume" }) =>
      adPlatformAPI.setCampaignStatus(platform, accountId, campaignId, action),
    onMutate: async ({ campaignId, action }) => {
      await qc.cancelQueries({ queryKey: ["campaigns", platform, accountId] });
      const prev = qc.getQueryData(["campaigns", platform, accountId]);
      qc.setQueryData(["campaigns", platform, accountId], (old: any) => ({
        ...old,
        campaigns: (old?.campaigns??[]).map((c: Campaign) =>
          c.id===campaignId ? { ...c, status: action==="resume" ? "ACTIVE" : "PAUSED" } : c
        ),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["campaigns", platform, accountId], ctx.prev);
      toast({ title:"Status update failed", description:(_e as any)?.message, variant:"destructive" });
    },
    onSuccess: (_d, vars) => {
      toast({ title: vars.action==="pause" ? "Campaign paused" : "Campaign resumed", description:`Updated on ${PLATFORM_META[platform]?.label??platform}.` });
      setTimeout(() => qc.invalidateQueries({ queryKey:["campaigns", platform, accountId] }), 1500);
    },
  });

  /* Optimistic budget update (local cache only — server confirmed by refetch) */
  const handleBudgetSaved = (campaignId: string, newBudget: number) => {
    qc.setQueryData(["campaigns", platform, accountId], (old: any) => ({
      ...old,
      campaigns: (old?.campaigns??[]).map((c: Campaign) =>
        c.id===campaignId ? { ...c, budget: newBudget } : c
      ),
    }));
    setTimeout(() => qc.invalidateQueries({ queryKey:["campaigns", platform, accountId] }), 2000);
  };

  if (isLoading) return <div style={{ display:"flex", alignItems:"center", gap:8, color:C.muted, fontSize:12, padding:"8px 0" }}><Spinner size={13}/> Loading campaigns…</div>;
  if (error) return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, display:"flex", alignItems:"center", gap:6, background:"rgba(251,113,133,0.07)", borderRadius:7, padding:"8px 12px", fontSize:12, color:C.red }}><AlertCircle size={12}/>{(error as any)?.message ?? "Could not load campaigns"}</div>
      <button onClick={()=>refetch()} style={{ background:"none", border:"none", cursor:"pointer", color:C.faint, padding:4 }}><RefreshCw size={13}/></button>
    </div>
  );
  if (campaigns.length===0) return <div style={{ fontSize:12, color:C.faint, fontStyle:"italic", padding:"6px 0" }}>No active or paused campaigns found for this account.</div>;

  const pendingToggleId = toggleMut.isPending ? (toggleMut.variables as any)?.campaignId : null;

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.divider}` }}>
            {["Campaign","Status","Budget","Spend (7d)",""].map((h,i)=>(
              <th key={i} style={{ padding:"6px 8px", textAlign:i===4?"right":"left", color:C.muted, fontFamily:"'DM Mono',monospace", fontSize:10, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => {
            const active    = isActive(c.status);
            const toggleable = canToggle(c.status);
            const loading   = pendingToggleId === c.id;
            const action    = (active ? "pause" : "resume") as "pause"|"resume";

            return (
              <tr key={c.id}
                style={{ borderBottom: i<campaigns.length-1 ? `1px solid ${C.divider}` : "none" }}
                onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.02)")}
                onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
              >
                {/* Name + ID */}
                <td style={{ padding:"10px 8px", color:C.text, fontWeight:500, maxWidth:180 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <Megaphone size={11} color={C.faint} style={{ flexShrink:0 }}/>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                  </div>
                  <div style={{ fontSize:10, color:C.faint, fontFamily:"'DM Mono',monospace", marginTop:2, paddingLeft:17 }}>{c.id}</div>
                </td>

                {/* Status */}
                <td style={{ padding:"10px 8px", whiteSpace:"nowrap" }}><StatusBadge status={c.status}/></td>

                {/* Budget — click to edit */}
                <td style={{ padding:"10px 8px" }}>
                  <BudgetCell campaign={c} platform={platform} accountId={accountId} onSaved={handleBudgetSaved}/>
                </td>

                {/* Sparkline */}
                <td style={{ padding:"10px 8px" }}>
                  <SparklineCell platform={platform} accountId={accountId} campaign={c} accentColor={accent}/>
                </td>

                {/* Pause / Resume */}
                <td style={{ padding:"10px 8px", textAlign:"right", whiteSpace:"nowrap" }}>
                  {toggleable && (
                    <button
                      disabled={loading}
                      onClick={()=>toggleMut.mutate({ campaignId:c.id, action })}
                      title={active?"Pause campaign":"Resume campaign"}
                      style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:6, fontSize:11, fontWeight:700, cursor:loading?"wait":"pointer", border:`1px solid ${active?"rgba(251,191,36,0.3)":"rgba(0,200,150,0.3)"}`, background:active?"rgba(251,191,36,0.08)":"rgba(0,200,150,0.08)", color:active?C.amber:C.green, opacity:loading?0.6:1, transition:"opacity 0.15s" }}
                    >
                      {loading ? <Spinner size={11} color={active?C.amber:C.green}/> : active ? <PauseCircle size={11}/> : <PlayCircle size={11}/>}
                      {loading ? "…" : active ? "Pause" : "Resume"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Expandable account card ────────────────────────────────────────── */
function AccountCard({ conn, dateRange, onRevoke, revoking }: {
  conn: { id:number; platform:string; account_id:string; account_name?:string; status:string; connected_at:string };
  dateRange: DateRange; onRevoke: ()=>void; revoking: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:open?`1px solid ${C.border}`:"none", cursor:"pointer" }} onClick={()=>setOpen(o=>!o)}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:conn.status==="active"?C.green:C.amber, flexShrink:0 }}/>
          <span style={{ fontSize:14, fontWeight:700, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>{conn.account_name??conn.account_id}</span>
          <span style={{ fontSize:11, color:C.faint, fontFamily:"'DM Mono',monospace" }}>{conn.account_id}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }} onClick={e=>e.stopPropagation()}>
          <button disabled={revoking} onClick={onRevoke} style={{ background:"rgba(251,113,133,0.08)", border:"1px solid rgba(251,113,133,0.18)", borderRadius:6, padding:"4px 10px", cursor:revoking?"not-allowed":"pointer", color:C.red, display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600 }}>
            {revoking?<Spinner size={11} color={C.red}/>:<Unplug size={11}/>} Disconnect
          </button>
          <button onClick={()=>setOpen(o=>!o)} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 10px", cursor:"pointer", color:C.muted, display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600 }}>
            {open?<ChevronDown size={12}/>:<ChevronRight size={12}/>} {open?"Hide":"Campaigns"}
          </button>
        </div>
      </div>
      <div style={{ padding:"14px 16px" }}>
        <InsightsRow platform={conn.platform} accountId={conn.account_id} dateRange={dateRange}/>
        {open && (
          <div style={{ background:C.deeper, borderRadius:8, padding:"12px 14px", border:`1px solid ${C.divider}`, marginTop:4 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
              <Megaphone size={11}/> Campaigns
            </div>
            <CampaignTable platform={conn.platform} accountId={conn.account_id}/>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SELECT ACCOUNT STEP
══════════════════════════════════════════════════════════════════════ */
function SelectAccountStep({ platformId }: { platformId: string }) {
  const navigate=useNavigate(); const qc=useQueryClient(); const { toast }=useToast();
  const meta=PLATFORM_META[platformId]??{ label:platformId, color:C.green, icon:"?", envHint:"" };
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [selectedName,setSelectedName]=useState("");

  const { data, isLoading, error, refetch }=useQuery({ queryKey:["ad-accounts-pick",platformId], queryFn:()=>adPlatformAPI.listAccounts(platformId), retry:1 });
  const accounts: { id:string; name:string; currency?:string; status?:string }[]=data?.accounts??[];

  const saveMut=useMutation({
    mutationFn:()=>adPlatformAPI.selectAccount(platformId, selectedId!, selectedName),
    onSuccess:()=>{ toast({ title:`${meta.label} connected!`, description:`Ad account "${selectedName}" is now active.` }); qc.invalidateQueries({ queryKey:["ad-accounts-connected"] }); navigate("/connections?connected="+platformId); },
    onError:(e:any)=>toast({ title:"Save failed", description:e?.message, variant:"destructive" }),
  });

  return (
    <div style={{ maxWidth:560, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
        <PlatformBadge pid={platformId} size={44}/>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>Select {meta.label} Account</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:3 }}>Choose the ad account you want AutoFlowNG to manage</div>
        </div>
      </div>
      {isLoading && <div style={{ display:"flex", alignItems:"center", gap:10, color:C.muted, padding:"24px 0" }}><Spinner/><span style={{ fontSize:14 }}>Fetching available ad accounts…</span></div>}
      {error && (
        <div style={{ background:"rgba(251,113,133,0.08)", border:"1px solid rgba(251,113,133,0.2)", borderRadius:10, padding:"14px 16px", display:"flex", gap:10, alignItems:"flex-start" }}>
          <AlertCircle size={16} color={C.red} style={{ marginTop:2, flexShrink:0 }}/>
          <div>
            <div style={{ fontSize:13, color:C.red, fontWeight:600 }}>Could not load accounts</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{(error as any)?.message??"Unknown error"}</div>
            <button onClick={()=>refetch()} style={{ marginTop:8, fontSize:12, color:C.blue, background:"none", border:"none", cursor:"pointer", padding:0 }}>Try again</button>
          </div>
        </div>
      )}
      {!isLoading&&!error&&accounts.length===0 && (
        <div style={{ background:"rgba(251,191,36,0.07)", border:"1px solid rgba(251,191,36,0.18)", borderRadius:10, padding:"14px 16px", fontSize:13, color:C.amber }}>
          No ad accounts found. Make sure your {meta.label} account has at least one ad account with access.
        </div>
      )}
      {accounts.length>0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {accounts.map(acc=>{ const sel=selectedId===acc.id; return (
            <button key={acc.id} onClick={()=>{ setSelectedId(acc.id); setSelectedName(acc.name); }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:sel?"rgba(0,200,150,0.08)":C.raised, border:`1px solid ${sel?C.green:C.border}`, borderRadius:10, padding:"14px 16px", cursor:"pointer", textAlign:"left", width:"100%" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <Building2 size={18} color={sel?C.green:C.muted}/>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>{acc.name}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2, fontFamily:"'DM Mono',monospace" }}>ID: {acc.id}{acc.currency?` · ${acc.currency}`:""}{acc.status?` · ${acc.status}`:""}</div>
                </div>
              </div>
              {sel&&<CheckCircle2 size={18} color={C.green}/>}
            </button>
          ); })}
        </div>
      )}
      {accounts.length>0 && (
        <div style={{ marginTop:20, display:"flex", gap:10 }}>
          <button disabled={!selectedId||saveMut.isPending} onClick={()=>saveMut.mutate()} style={{ flex:1, padding:"12px 0", borderRadius:10, border:"none", background:selectedId?C.green:"rgba(255,255,255,0.07)", color:selectedId?"#000":C.faint, fontWeight:700, fontSize:14, cursor:selectedId?"pointer":"not-allowed", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {saveMut.isPending?<Spinner color="#000"/>:<CheckCircle2 size={16}/>} Connect Account
          </button>
          <button onClick={()=>navigate("/connections")} style={{ padding:"12px 20px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CONNECTED ACCOUNTS DASHBOARD
══════════════════════════════════════════════════════════════════════ */
function ConnectedDashboard() {
  const qc=useQueryClient(); const { toast }=useToast();
  const [dateRange,setDateRange]=useState<DateRange>("last_7d");

  const { data,isLoading }=useQuery({ queryKey:["ad-accounts-connected"], queryFn:()=>adPlatformAPI.listConnected() });
  const connections=(data?.connections??[]).filter(c=>c.account_id!=="pending");

  const revokeMut=useMutation({
    mutationFn:({ platform, accountId }: { platform:string; accountId:string })=>adPlatformAPI.revoke(platform, accountId),
    onSuccess:(_d,vars)=>{ toast({ title:"Disconnected", description:`${PLATFORM_META[vars.platform]?.label??vars.platform} account removed.` }); qc.invalidateQueries({ queryKey:["ad-accounts-connected"] }); qc.invalidateQueries({ queryKey:["account-insights",vars.platform] }); qc.invalidateQueries({ queryKey:["campaigns",vars.platform] }); },
    onError:(e:any)=>toast({ title:"Error", description:e?.message, variant:"destructive" }),
  });

  const startConnect=(pid:string)=>{ window.location.href=`${API_BASE_URL}/api/ad-platforms/${pid}/connect?token=${encodeURIComponent(tokenStore.get()??"")}` };

  return (
    <div style={{ maxWidth:920, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>Ad Platform Accounts</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:5 }}>Connect accounts · view metrics · manage campaigns — all in one place.</div>
        </div>
        <div style={{ display:"flex", background:C.raised, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
          {(["last_7d","last_30d"] as DateRange[]).map(dr=>(
            <button key={dr} onClick={()=>setDateRange(dr)} style={{ padding:"7px 14px", border:"none", background:dateRange===dr?"rgba(0,200,150,0.12)":"transparent", color:dateRange===dr?C.green:C.muted, fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace", borderRight:dr==="last_7d"?`1px solid ${C.border}`:"none" }}>
              {dr==="last_7d"?"7 days":"30 days"}
            </button>
          ))}
        </div>
      </div>

      {AD_PLATFORM_IDS.map(pid=>{
        const meta=PLATFORM_META[pid];
        const conns=connections.filter(c=>c.platform===pid);
        return (
          <Reveal key={pid}>
            <div style={{ marginBottom:30 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <PlatformBadge pid={pid} size={30}/>
                  <span style={{ fontSize:15, fontWeight:700, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>{meta.label}</span>
                  {conns.length>0&&<span style={{ fontSize:11, background:"rgba(0,200,150,0.1)", border:"1px solid rgba(0,200,150,0.2)", color:C.green, borderRadius:20, padding:"2px 9px", fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{conns.length} connected</span>}
                </div>
                <button onClick={()=>startConnect(pid)} style={{ background:"rgba(56,189,248,0.08)", border:`1px solid rgba(56,189,248,0.22)`, borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, color:C.blue, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>+ Connect</button>
              </div>
              {isLoading&&<div style={{ display:"flex", gap:8, color:C.muted, fontSize:13, alignItems:"center", padding:"8px 0" }}><Spinner size={14}/> Loading…</div>}
              {!isLoading&&conns.length===0&&(
                <div style={{ background:C.raised, border:`1px dashed ${C.border}`, borderRadius:10, padding:"20px 18px", fontSize:13, color:C.faint, textAlign:"center" }}>
                  No {meta.label} accounts connected — click <strong style={{ color:C.blue }}>+ Connect</strong> to start OAuth.
                </div>
              )}
              {conns.map(conn=>(
                <AccountCard key={conn.id} conn={conn} dateRange={dateRange}
                  onRevoke={()=>revokeMut.mutate({ platform:conn.platform, accountId:conn.account_id })}
                  revoking={revokeMut.isPending&&(revokeMut.variables as any)?.accountId===conn.account_id}
                />
              ))}
            </div>
          </Reveal>
        );
      })}

      <div style={{ background:C.raised, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", marginTop:4 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em", marginBottom:10, textTransform:"uppercase" }}>Required Environment Variables</div>
        {AD_PLATFORM_IDS.map(pid=>(
          <div key={pid} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, fontFamily:"'DM Mono',monospace", color:C.faint, marginBottom:4 }}>
            <PlatformBadge pid={pid} size={16}/><span style={{ color:C.muted }}>{PLATFORM_META[pid].label}:</span><span>{PLATFORM_META[pid].envHint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PAGE ROOT
══════════════════════════════════════════════════════════════════════ */
export default function AdAccounts() {
  const location=useLocation(); const navigate=useNavigate();
  const params=new URLSearchParams(location.search);
  const platform=params.get("platform"); const step=params.get("step");
  const isSelectStep=!!(platform&&step==="select-account"&&AD_PLATFORM_IDS.includes(platform));
  return (
    <PageTransition>
      <div style={{ minHeight:"100vh", background:C.bg, padding:"32px 24px 80px", fontFamily:"'DM Sans',sans-serif" }}>
        <button onClick={()=>navigate("/connections")} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:13, marginBottom:28, padding:0 }}>
          <ArrowLeft size={15}/> Back to Integrations
        </button>
        {isSelectStep?<SelectAccountStep platformId={platform!}/>:<ConnectedDashboard/>}
      </div>
    </PageTransition>
  );
}
