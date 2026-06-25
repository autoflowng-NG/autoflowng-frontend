/**
 * Automations — Enterprise Redesign
 *
 * All hooks, mutations, and logic preserved exactly from original.
 * Visual changes:
 *   - Table layout (Name · Category · Status · Runs · Last Run · Actions)
 *   - Stat pills row above table
 *   - Filter tabs: All · Active · Paused + category filter pills
 *   - Inline log drawer expands below each row
 *   - All data-testid attributes preserved
 */

import { useState } from "react";
import { useAutomations, useToggleAutomation, useRunAutomation, useAutomationLogs } from "../hooks/useWorkflows";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  Zap, Play, ToggleLeft, ToggleRight, Search, Activity, Clock,
  ChevronDown, CheckCircle2, XCircle, Circle, Plus,
  Loader, Tag,
} from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:      "#060810",
  surface: "#0C0F1A",
  border:  "rgba(255,255,255,0.06)",
  borderH: "rgba(255,255,255,0.11)",
  text:    "#E2E8FF",
  muted:   "rgba(226,232,255,0.45)",
  faint:   "rgba(226,232,255,0.2)",
  green:   "#00C896",
  blue:    "#38BDF8",
  purple:  "#A78BFA",
  amber:   "#FBBF24",
  red:     "#FB7185",
};

const CAT_COLOR: Record<string, string> = {
  messaging:    C.green,
  ai:           C.purple,
  data:         C.blue,
  webhook:      C.amber,
  scheduling:   C.red,
  integration:  C.green,
  social:       C.blue,
  finance:      C.amber,
  productivity: C.purple,
};

const CATS = ["All", "AI", "Messaging", "Data", "Webhook", "Scheduling", "Integration"];

/* ── Helpers ───────────────────────────────────────────────────────── */
function fmtDate(ts: any): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── Skeleton ──────────────────────────────────────────────────────── */
function Sk({ w = "100%", h = 12, r = 4 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "rgba(255,255,255,0.05)",
      animation: "af-pulse 1.8s ease-in-out infinite",
    }} />
  );
}

function SkRow() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 100px 90px 70px 90px 140px",
      gap: 12, padding: "14px 18px", alignItems: "center",
      borderBottom: `1px solid ${C.border}`,
    }}>
      {[220, 80, 70, 50, 80, 120].map((w, i) => <Sk key={i} w={w} />)}
    </div>
  );
}

/* ── Stat pill ─────────────────────────────────────────────────────── */
function StatPill({ icon: Icon, value, label, color }: {
  icon: any; value: number | string; label: string; color: string;
}) {
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
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace", marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

/* ── Filter tab ────────────────────────────────────────────────────── */
function FilterTab({ label, active, count, onClick }: {
  label: string; active: boolean; count?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 14px", borderRadius: 8,
        border: "none", cursor: "pointer",
        background: active ? "rgba(56,189,248,0.1)" : "transparent",
        color: active ? C.blue : C.muted,
        fontSize: 13, fontWeight: active ? 600 : 400,
        fontFamily: "'DM Sans',sans-serif",
        borderBottom: active ? `2px solid ${C.blue}` : "2px solid transparent",
        transition: "all 0.14s",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.text; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.muted; }}
    >
      {label}
      {count !== undefined && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: active ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.06)",
          color: active ? C.blue : C.faint,
          borderRadius: 100, padding: "1px 6px",
          fontFamily: "'DM Mono',monospace",
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ── Category pill ─────────────────────────────────────────────────── */
function CatPill({ label, active, color, onClick }: {
  label: string; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 11px", borderRadius: 100, border: "none", cursor: "pointer",
        background: active ? `${color}18` : "rgba(255,255,255,0.04)",
        color: active ? color : C.faint,
        border: `1px solid ${active ? color + "35" : "rgba(255,255,255,0.07)"}`,
        fontSize: 11, fontWeight: 600,
        fontFamily: "'DM Mono',monospace", transition: "all 0.14s",
      }}
    >
      {label}
    </button>
  );
}

/* ── Inline log drawer ─────────────────────────────────────────────── */
function LogDrawer({ templateId }: { templateId: string }) {
  const { data: logs = [] } = useAutomationLogs(templateId);
  const logList = logs as any[];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ overflow: "hidden" }}
    >
      <div style={{
        padding: "14px 18px",
        background: "rgba(0,0,0,0.25)",
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: C.faint,
          fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 10,
        }}>
          EXECUTION LOGS
        </div>
        {logList.length === 0 ? (
          <div style={{ fontSize: 12, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
            No logs yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {logList.slice(0, 8).map((l: any, i: number) => {
              const isOk  = l.success === true;
              const isBad = l.success === false;
              const color = isOk ? C.green : isBad ? C.red : C.muted;
              const Icon  = isOk ? CheckCircle2 : isBad ? XCircle : Circle;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 7,
                  background: "rgba(255,255,255,0.02)",
                }}>
                  <Icon size={11} color={color} />
                  <span style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>
                    {l.created_at ? new Date(l.created_at).toLocaleTimeString() : ""}
                  </span>
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.summary || "Completed"}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color,
                    background: `${color}10`, border: `1px solid ${color}20`,
                    borderRadius: 100, padding: "1px 6px",
                    fontFamily: "'DM Mono',monospace",
                  }}>
                    {(l.success === true ? "SUCCESS" : l.success === false ? "FAILED" : "RUNNING")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Automation row ────────────────────────────────────────────────── */
function AutomationRow({ am, delay = 0 }: { am: any; delay?: number }) {
  const toggleAM   = useToggleAutomation();
  const runAM      = useRunAutomation();
  const { toast }  = useToast();
  const [expanded, setExpanded] = useState(false);
  const [running,  setRunning]  = useState(false);

  const cat   = (am.category || "integration").toLowerCase();
  const color = CAT_COLOR[cat] || C.green;

  const handleToggle = () => {
    toggleAM.mutate({ templateId: am.template_id, enabled: !am.enabled }, {
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  };

  const handleRun = async () => {
    setRunning(true);
    runAM.mutate(am.template_id, {
      onSuccess: () => { toast({ title: "Automation triggered!" }); setRunning(false); },
      onError:   (e: any) => { toast({ title: "Error", description: e?.message, variant: "destructive" }); setRunning(false); },
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ delay, duration: 0.2 }}
      data-testid={`automation-card-${am.template_id}`}
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      {/* Main row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 90px 70px 90px 140px",
          gap: 12, alignItems: "center",
          padding: "13px 18px",
          cursor: "pointer", transition: "background 0.14s",
        }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      >
        {/* Name */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{am.icon || "⚡"}</span>
            <span style={{
              fontSize: 13, fontWeight: 600, color: C.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontFamily: "'DM Sans',sans-serif",
            }}>
              {am.name}
            </span>
          </div>
          {am.description && (
            <div style={{
              fontSize: 11, color: C.faint,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontFamily: "'DM Sans',sans-serif", paddingLeft: 27,
            }}>
              {am.description}
            </div>
          )}
        </div>

        {/* Category */}
        <div>
          <span style={{
            fontSize: 10, fontWeight: 700, color,
            background: `${color}12`, border: `1px solid ${color}25`,
            borderRadius: 100, padding: "3px 9px",
            fontFamily: "'DM Mono',monospace",
          }}>
            {cat.toUpperCase()}
          </span>
        </div>

        {/* Status */}
        <div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 10, fontWeight: 700,
            color: am.enabled ? C.green : C.faint,
            background: am.enabled ? "rgba(0,200,150,0.08)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${am.enabled ? "rgba(0,200,150,0.2)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 100, padding: "3px 9px",
            fontFamily: "'DM Mono',monospace",
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: am.enabled ? C.green : C.faint,
              display: "inline-block",
            }} />
            {am.enabled ? "Active" : "Paused"}
          </span>
        </div>

        {/* Runs */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Activity size={11} color={C.faint} />
          <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace" }}>
            {am.run_count ?? "—"}
          </span>
        </div>

        {/* Last run */}
        <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
          {fmtDate(am.last_run_at)}
        </div>

        {/* Actions */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Run */}
          <button
            data-testid={`run-automation-${am.template_id}`}
            onClick={handleRun}
            disabled={running}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)",
              borderRadius: 7, padding: "5px 9px",
              color: C.blue, fontSize: 11, fontWeight: 600,
              cursor: running ? "default" : "pointer",
              fontFamily: "'DM Sans',sans-serif",
              opacity: running ? 0.6 : 1, transition: "all 0.14s",
            }}
            onMouseEnter={e => { if (!running) (e.currentTarget as HTMLElement).style.background = "rgba(56,189,248,0.14)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(56,189,248,0.08)"; }}
          >
            {running
              ? <Loader size={11} style={{ animation: "spin-slow 1s linear infinite" }} />
              : <Play size={11} />
            }
            {running ? "Running…" : "Run"}
          </button>

          {/* Toggle */}
          <button
            data-testid={`toggle-automation-${am.template_id}`}
            onClick={handleToggle}
            disabled={toggleAM.isPending}
            title={am.enabled ? "Disable" : "Enable"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30,
              background: am.enabled ? "rgba(251,191,36,0.06)" : "rgba(0,200,150,0.06)",
              border: `1px solid ${am.enabled ? "rgba(251,191,36,0.18)" : "rgba(0,200,150,0.18)"}`,
              borderRadius: 7, cursor: "pointer",
              color: am.enabled ? C.amber : C.green,
              transition: "all 0.14s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            {am.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          </button>

          {/* Logs toggle */}
          <button
            onClick={() => setExpanded(e => !e)}
            title="View logs"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30,
              background: expanded ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${expanded ? "rgba(167,139,250,0.25)" : C.border}`,
              borderRadius: 7, cursor: "pointer",
              color: expanded ? C.purple : C.faint,
              transition: "all 0.14s",
            }}
          >
            <ChevronDown
              size={13}
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
            />
          </button>
        </div>
      </div>

      {/* Log drawer */}
      <AnimatePresence>
        {expanded && <LogDrawer key="logs" templateId={am.template_id} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────── */
function EmptyState({ search }: { search: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ textAlign: "center", padding: "72px 24px" }}
    >
      <div style={{
        width: 60, height: 60, borderRadius: 16, margin: "0 auto 18px",
        background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Zap size={26} color="rgba(56,189,248,0.35)" />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: C.muted, marginBottom: 8 }}>
        {search ? "No automations match your search" : "No automations yet"}
      </div>
      <p style={{ fontSize: 13, color: C.faint, maxWidth: 300, margin: "0 auto" }}>
        {search ? "Try a different search term." : "Automations trigger automatically based on events, schedules, or webhooks."}
      </p>
    </motion.div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function Automations() {
  const { data: automations = [], isLoading } = useAutomations();
  const [search,  setSearch]  = useState("");
  const [tab,     setTab]     = useState<"all" | "active" | "paused">("all");
  const [catFilter, setCat]   = useState("All");

  const ams = automations as any[];
  const activeCount = ams.filter(a => a.enabled).length;
  const pausedCount = ams.filter(a => !a.enabled).length;

  const filtered = ams.filter(a => {
    const matchSearch = !search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.category?.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      tab === "all"    ? true :
      tab === "active" ? a.enabled :
      !a.enabled;
    const matchCat  = catFilter === "All" || (a.category || "").toLowerCase() === catFilter.toLowerCase();
    return matchSearch && matchTab && matchCat;
  });

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "clamp(16px,3vw,28px)", maxWidth: 1440, margin: "0 auto" }}>

        {/* ── Header ── */}
        <Reveal>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", marginBottom: 5 }}>
              AUTOMATION ENGINE
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: C.text, margin: 0 }}>
              Automations
            </h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 5, fontFamily: "'DM Sans',sans-serif" }}>
              Trigger-based automations that run automatically on events, schedules, and webhooks.
            </p>
          </div>
        </Reveal>

        {/* ── Stat pills ── */}
        <Reveal delay={40}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
            <StatPill icon={Zap}          value={ams.length}   label="TOTAL"   color={C.blue}   />
            <StatPill icon={CheckCircle2} value={activeCount}  label="ACTIVE"  color={C.green}  />
            <StatPill icon={Clock}        value={pausedCount}  label="PAUSED"  color={C.amber}  />
            <StatPill icon={Activity}     value={ams.reduce((a: number, m: any) => a + (m.run_count || 0), 0)} label="TOTAL RUNS" color={C.purple} />
          </div>
        </Reveal>

        {/* ── Table card ── */}
        <Reveal delay={80}>
          <div style={{
            background: "#0C0F1A",
            border: `1px solid ${C.border}`,
            borderRadius: 14, overflow: "hidden",
          }}>

            {/* Filter bar */}
            <div style={{
              padding: "12px 18px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* Top row: tabs + search */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 2 }}>
                  <FilterTab label="All"    active={tab === "all"}    count={ams.length}   onClick={() => setTab("all")}    />
                  <FilterTab label="Active" active={tab === "active"} count={activeCount}  onClick={() => setTab("active")} />
                  <FilterTab label="Paused" active={tab === "paused"} count={pausedCount}  onClick={() => setTab("paused")} />
                </div>
                <div style={{ position: "relative", flex: "0 0 260px", minWidth: 0 }}>
                  <Search size={13} style={{
                    position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                    color: C.faint, pointerEvents: "none",
                  }} />
                  <input
                    data-testid="input-search"
                    type="search"
                    placeholder="Search automations…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: "7px 12px 7px 30px", color: C.text,
                      fontSize: 12, fontFamily: "'DM Sans',sans-serif",
                      outline: "none", boxSizing: "border-box",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(56,189,248,0.4)")}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                </div>
              </div>

              {/* Category pills */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CATS.map(cat => (
                  <CatPill
                    key={cat}
                    label={cat}
                    active={catFilter === cat}
                    color={CAT_COLOR[cat.toLowerCase()] || C.blue}
                    onClick={() => setCat(cat)}
                  />
                ))}
              </div>
            </div>

            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 90px 70px 90px 140px",
              gap: 12, padding: "9px 18px",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.015)",
            }}>
              {["NAME", "CATEGORY", "STATUS", "RUNS", "LAST RUN", "ACTIONS"].map(h => (
                <div key={h} style={{ fontSize: 9, fontWeight: 800, color: C.faint, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {isLoading ? (
              <div>{[0, 1, 2, 3, 4].map(i => <SkRow key={i} />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState search={search} />
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((am: any, i: number) => (
                  <AutomationRow key={am.template_id || i} am={am} delay={i * 0.03} />
                ))}
              </AnimatePresence>
            )}

            {/* Footer */}
            {!isLoading && filtered.length > 0 && (
              <div style={{
                padding: "11px 18px",
                borderTop: `1px solid ${C.border}`,
                fontSize: 11, color: C.faint,
                fontFamily: "'DM Mono',monospace",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>Showing {filtered.length} of {ams.length} automation{ams.length !== 1 ? "s" : ""}</span>
                <span>{activeCount} active · {pausedCount} paused</span>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      <style>{`
        @keyframes spin-slow  { to { transform: rotate(360deg); } }
        @keyframes af-pulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </PageTransition>
  );
}
