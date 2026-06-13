import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { queryClient, queryKeys } from "../lib/queryClient";
import { runsAPI } from "../lib/api";
import {
  Search, LayoutDashboard, GitBranch, Zap, Bot, Link2,
  CreditCard, Users, Settings, ShieldCheck, ArrowRight,
  Play, ToggleLeft, ToggleRight, Command, CornerDownLeft,
  ChevronUp, ChevronDown, X, CheckCircle2, XCircle,
  Clock, RefreshCw, Activity, Loader2,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────── */
type ItemKind = "page" | "workflow" | "automation" | "run" | "action";

interface PaletteItem {
  id:        string;
  kind:      ItemKind;
  label:     string;
  sublabel?: string;
  icon:      any;
  color:     string;
  badge?:    { text: string; color: string };
  onSelect:  () => void;
  keywords?: string;
}

/* ── Static nav pages ───────────────────────────────────────────────── */
const PAGES = [
  { id: "p-dashboard",   label: "Dashboard",    sublabel: "Command centre",     icon: LayoutDashboard, color: "#00C896", path: "/dashboard",   keywords: "home overview" },
  { id: "p-workflows",   label: "Workflows",    sublabel: "Manage & run flows",  icon: GitBranch,       color: "#00C896", path: "/workflows",   keywords: "run trigger" },
  { id: "p-automations", label: "Automations",  sublabel: "Auto-trigger rules",  icon: Zap,             color: "#38BDF8", path: "/automations", keywords: "rules events" },
  { id: "p-ai",          label: "AI Assistant", sublabel: "Chat with AI",        icon: Bot,             color: "#A78BFA", path: "/ai",          keywords: "chat gpt llm" },
  { id: "p-connections", label: "Connections",  sublabel: "OAuth & API keys",    icon: Link2,           color: "#38BDF8", path: "/connections", keywords: "oauth api integrations" },
  { id: "p-plans",       label: "Plans",        sublabel: "Billing & upgrade",   icon: CreditCard,      color: "#FBBF24", path: "/plans",       keywords: "billing payment upgrade" },
  { id: "p-referrals",   label: "Referrals",    sublabel: "Earn commissions",    icon: Users,           color: "#A78BFA", path: "/referrals",   keywords: "earn invite" },
  { id: "p-settings",    label: "Settings",     sublabel: "Profile & security",  icon: Settings,        color: "#94A3B8", path: "/settings",    keywords: "account password profile" },
];

/* ── Status config for runs ─────────────────────────────────────────── */
const RUN_STATUS: Record<string, { color: string; icon: any; label: string }> = {
  success:  { color: "#00C896", icon: CheckCircle2, label: "SUCCESS" },
  failed:   { color: "#FB7185", icon: XCircle,      label: "FAILED"  },
  error:    { color: "#FB7185", icon: XCircle,      label: "ERROR"   },
  running:  { color: "#38BDF8", icon: RefreshCw,    label: "RUNNING" },
  pending:  { color: "#FBBF24", icon: Clock,        label: "PENDING" },
};

function runStatus(status: string) {
  return RUN_STATUS[status?.toLowerCase()] || RUN_STATUS.pending;
}

function relTime(ts: number | string): string {
  const ms   = typeof ts === "string" ? new Date(ts).getTime() : ts;
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Fuzzy match ────────────────────────────────────────────────────── */
function matches(item: PaletteItem, query: string): boolean {
  if (!query) return true;
  const q   = query.toLowerCase();
  const hay = `${item.label} ${item.sublabel || ""} ${item.keywords || ""}`.toLowerCase();
  return hay.includes(q);
}

/* ── Group label ────────────────────────────────────────────────────── */
function GroupLabel({ label, loading }: { label: string; loading?: boolean }) {
  return (
    <div style={{
      padding:       "6px 14px 4px",
      fontSize:      10,
      fontWeight:    800,
      color:         "rgba(232,238,255,0.28)",
      fontFamily:    "'DM Mono',monospace",
      letterSpacing: "0.09em",
      textTransform: "uppercase",
      display:       "flex",
      alignItems:    "center",
      gap:           6,
    }}>
      {label}
      {loading && <Loader2 size={9} style={{ animation: "spin-slow 1s linear infinite", opacity: 0.6 }} />}
    </div>
  );
}

/* ── Result row ─────────────────────────────────────────────────────── */
function ResultRow({
  item, active, onMouseEnter, onClick,
}: {
  item: PaletteItem; active: boolean; onMouseEnter: () => void; onClick: () => void;
}) {
  const Icon = item.icon;
  const ref  = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active && ref.current) ref.current.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={ref}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      data-testid={`cmd-item-${item.id}`}
      style={{
        display:     "flex", alignItems: "center", gap: 12,
        width:       "100%", padding: "9px 14px",
        background:  active ? `${item.color}0f` : "transparent",
        border:      "none", borderRadius: 10,
        cursor:      "pointer", textAlign: "left",
        transition:  "background 0.1s", margin: "1px 0",
      }}
    >
      {/* Icon tile */}
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: active ? `${item.color}18` : `${item.color}0c`,
        border:     `1px solid ${active ? item.color + "30" : item.color + "18"}`,
        display:    "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.12s",
      }}>
        <Icon
          size={14}
          color={item.color}
          style={item.kind === "run" && item.keywords?.includes("running")
            ? { animation: "spin-slow 1.2s linear infinite" }
            : undefined}
        />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, lineHeight: 1.3,
          color:    active ? "#E8EEFF" : "rgba(232,238,255,0.75)",
          fontFamily: "'DM Sans',sans-serif",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          transition: "color 0.1s",
        }}>
          {item.label}
        </div>
        {item.sublabel && (
          <div style={{
            fontSize: 11, color: "rgba(232,238,255,0.3)",
            fontFamily: "'DM Sans',sans-serif",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.sublabel}
          </div>
        )}
      </div>

      {/* Status badge (runs) */}
      {item.badge && (
        <span style={{
          fontSize: 9, fontWeight: 800, fontFamily: "'DM Mono',monospace",
          color:    item.badge.color,
          background: `${item.badge.color}12`,
          border:   `1px solid ${item.badge.color}28`,
          borderRadius: 100, padding: "2px 7px", flexShrink: 0,
          letterSpacing: "0.06em",
        }}>
          {item.badge.text}
        </span>
      )}

      {/* Arrow / kind */}
      {active
        ? <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} style={{ flexShrink: 0 }}>
            <ArrowRight size={13} color={item.color} />
          </motion.div>
        : <span style={{
            fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.18)",
            fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em",
            textTransform: "uppercase", flexShrink: 0,
          }}>
            {item.kind === "run" ? "run" : item.kind}
          </span>
      }
    </button>
  );
}

/* ── Main palette ───────────────────────────────────────────────────── */
export function CommandPalette() {
  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef                      = useRef<HTMLInputElement>(null);
  const [, nav]                       = useLocation();
  const { isAuthenticated, user }     = useAuth();
  const isAdmin = user?.role === "admin" || (user as any)?.is_admin;

  /* ── Open / close ── */
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  /* ── Global Cmd+K / Ctrl+K ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(o => !o); }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close]);

  /* ── Focus on open ── */
  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setActiveIndex(0); }
  }, [open]);

  /* ── Background prefetch workflows + automations on first open ── */
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    // Prefetch if stale / missing so next open is instant
    const prefetch = async () => {
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: queryKeys.workflows,
          queryFn:  () => import("../lib/api").then(m => m.workflowsAPI.list().then((d: any) => d.workflows || [])),
          staleTime: 2 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.automations,
          queryFn:  () => import("../lib/api").then(m => m.automationsAPI.list().then((d: any) => d.automations || [])),
          staleTime: 2 * 60 * 1000,
        }),
      ]);
    };
    prefetch();
  }, [open, isAuthenticated]);

  /* ── Fetch recent runs when palette opens ── */
  const { data: runsData, isFetching: runsFetching } = useQuery({
    queryKey: queryKeys.recentRuns,
    queryFn:  () => runsAPI.recent(60),
    enabled:  open && isAuthenticated,
    staleTime: 60 * 1000,
  });
  const allRuns: any[] = Array.isArray(runsData) ? runsData : [];

  /* ── Build items ── */
  const go = useCallback((path: string) => { nav(path); close(); }, [nav, close]);

  const items = useMemo((): PaletteItem[] => {
    /* Pages */
    const pages: PaletteItem[] = [
      ...PAGES.map(p => ({ ...p, kind: "page" as ItemKind, onSelect: () => go(p.path) })),
      ...(isAdmin ? [
        {
          id: "p-admin", kind: "page" as ItemKind,
          label: "Admin Console", sublabel: "Users · payments · system",
          icon: ShieldCheck, color: "#FB7185",
          onSelect: () => go("/admin"), keywords: "admin users payments system",
        },
        { id: "p-phase17", kind: "page" as ItemKind, label: "Phase 17 Ops", sublabel: "Autonomous Orchestration", icon: Activity, color: "#94A3B8", onSelect: () => go("/phase17-ops"), keywords: "debug ops" },
        { id: "p-phase18", kind: "page" as ItemKind, label: "Phase 18 Ops", sublabel: "Memory & Approvals", icon: Activity, color: "#94A3B8", onSelect: () => go("/phase18-ops"), keywords: "debug ops" },
        { id: "p-phase19", kind: "page" as ItemKind, label: "Phase 19 Ops", sublabel: "Intelligence Foundation", icon: Activity, color: "#94A3B8", onSelect: () => go("/phase19-ops"), keywords: "debug ops" },
        { id: "p-phase20", kind: "page" as ItemKind, label: "Phase 20 Ops", sublabel: "Ops Center", icon: Activity, color: "#94A3B8", onSelect: () => go("/phase20-ops"), keywords: "debug ops" },
      ] : []),
    ];

    /* Workflows from cache */
    const wfRaw  = queryClient.getQueryData<any>(queryKeys.workflows);
    const wfList: any[] = Array.isArray(wfRaw) ? wfRaw : (wfRaw?.workflows || []);
    const workflows: PaletteItem[] = wfList.slice(0, 12).map((wf: any) => ({
      id: `wf-${wf.id}`, kind: "workflow" as ItemKind,
      label: wf.name || "Untitled workflow",
      sublabel: `${wf.trigger_type || "manual"} trigger`,
      icon:  GitBranch,
      color: wf.is_active ? "#00C896" : "rgba(232,238,255,0.3)",
      keywords: wf.trigger_type || "",
      badge: { text: wf.is_active ? "ACTIVE" : "PAUSED", color: wf.is_active ? "#00C896" : "rgba(232,238,255,0.3)" },
      onSelect: () => go(`/workflows/${wf.id}`),
    }));

    /* Automations from cache */
    const amRaw  = queryClient.getQueryData<any>(queryKeys.automations);
    const amList: any[] = Array.isArray(amRaw) ? amRaw : (amRaw?.automations || []);
    const automations: PaletteItem[] = amList.slice(0, 8).map((am: any) => ({
      id: `am-${am.id}`, kind: "automation" as ItemKind,
      label: am.name || "Untitled automation",
      sublabel: am.enabled ? "Enabled" : "Disabled",
      icon:  am.enabled ? ToggleRight : ToggleLeft,
      color: am.enabled ? "#38BDF8" : "rgba(232,238,255,0.3)",
      keywords: am.trigger_type || "",
      onSelect: () => go("/automations"),
    }));

    /* Run logs */
    const runs: PaletteItem[] = allRuns.map((run: any) => {
      const st      = runStatus(run.status);
      const wfId    = run.workflow_id || run.wf_id;
      const runId   = run.id || run.run_id;
      const wfName  = run.workflow_name || run.name || "Workflow";
      const ts      = run.created_at || run.started_at || run.ts;
      const duration = run.duration ? `${run.duration}ms` : "";
      const parts    = [ts ? relTime(ts) : "", duration].filter(Boolean).join(" · ");
      return {
        id:       `run-${runId || Math.random().toString(36).slice(2)}`,
        kind:     "run" as ItemKind,
        label:    wfName,
        sublabel: parts,
        icon:     st.icon,
        color:    st.color,
        badge:    { text: st.label, color: st.color },
        keywords: `${run.status || ""} ${wfName} running`,
        onSelect: () => go(wfId ? `/workflows/${wfId}` : "/workflows"),
      };
    });

    /* Quick actions */
    const actions: PaletteItem[] = [
      { id: "a-new-wf",  kind: "action", label: "New Workflow",   sublabel: "Open workflow builder", icon: GitBranch,  color: "#00C896", keywords: "create build",  onSelect: () => go("/workflows") },
      { id: "a-new-am",  kind: "action", label: "New Automation", sublabel: "Set up a trigger",      icon: Zap,        color: "#38BDF8", keywords: "trigger rule",  onSelect: () => go("/automations") },
      { id: "a-ask-ai",  kind: "action", label: "Ask AI",         sublabel: "Open AI assistant",     icon: Bot,        color: "#A78BFA", keywords: "chat gpt",      onSelect: () => go("/ai") },
      { id: "a-upgrade", kind: "action", label: "Upgrade plan",   sublabel: "View pricing",          icon: CreditCard, color: "#FBBF24", keywords: "pro billing",   onSelect: () => go("/plans") },
    ];

    return [...pages, ...workflows, ...automations, ...runs, ...actions];
  }, [open, isAuthenticated, isAdmin, allRuns, go]);

  /* ── Filter ── */
  const filtered = useMemo(
    () => items.filter(i => matches(i, query)),
    [items, query],
  );

  /* ── Group ── */
  type Group = { label: string; items: PaletteItem[]; loading?: boolean };
  const groups = useMemo((): Group[] => {
    const by: Record<ItemKind, PaletteItem[]> = {
      page: [], workflow: [], automation: [], run: [], action: [],
    };
    filtered.forEach(i => by[i.kind].push(i));

    /* Cap each group when unfiltered to keep list manageable */
    const capped = (arr: PaletteItem[], cap: number) =>
      query ? arr : arr.slice(0, cap);

    const g: Group[] = [];
    if (by.page.length)       g.push({ label: "Navigate",      items: capped(by.page, 8) });
    if (by.workflow.length)   g.push({ label: "Workflows",      items: capped(by.workflow, 5) });
    if (by.automation.length) g.push({ label: "Automations",    items: capped(by.automation, 4) });
    if (by.run.length)        g.push({ label: "Run Logs",       items: capped(by.run, 8), loading: runsFetching });
    if (by.action.length)     g.push({ label: "Quick Actions",  items: capped(by.action, 4) });
    return g;
  }, [filtered, query, runsFetching]);

  /* Flat list for keyboard nav */
  const flat = useMemo(() => groups.flatMap(g => g.items), [groups]);

  /* ── Keyboard navigation ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && flat[activeIndex]) flat[activeIndex].onSelect();
    else if (e.key === "Escape") close();
  };

  useEffect(() => { setActiveIndex(0); }, [query]);

  /* ── Empty state copy ── */
  const emptyMsg = runsFetching && !query
    ? "Loading run logs…"
    : query
      ? `No results for "${query}"`
      : "Type to search pages, workflows, runs…";

  return (
    <>
      {/* Floating trigger hint — desktop only */}
      <button
        data-testid="cmd-palette-trigger"
        onClick={() => setOpen(true)}
        className="af-cmd-trigger"
        style={{
          display:    "none",
          alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.04)",
          border:     "1px solid rgba(255,255,255,0.08)",
          borderRadius: 9, padding: "6px 12px",
          cursor:     "pointer", color: "rgba(232,238,255,0.35)",
          fontFamily: "'DM Sans',sans-serif", fontSize: 12,
          transition: "all 0.18s",
          position:   "fixed", bottom: 20, left: 232, zIndex: 90,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background   = "rgba(0,200,150,0.06)";
          el.style.borderColor  = "rgba(0,200,150,0.2)";
          el.style.color        = "rgba(0,200,150,0.7)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background  = "rgba(255,255,255,0.04)";
          el.style.borderColor = "rgba(255,255,255,0.08)";
          el.style.color       = "rgba(232,238,255,0.35)";
        }}
      >
        <Search size={11} />
        <span>Search…</span>
        <span style={{
          display:     "flex", alignItems: "center", gap: 2,
          background:  "rgba(255,255,255,0.06)", borderRadius: 5,
          padding:     "1px 5px", fontSize: 10, fontFamily: "'DM Mono',monospace",
        }}>
          <Command size={9} /> K
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cmd-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={close}
              style={{
                position: "fixed", inset: 0, zIndex: 800,
                background: "rgba(4,6,15,0.75)", backdropFilter: "blur(8px)",
              }}
            />

            {/* Panel */}
            <motion.div
              key="cmd-panel"
              initial={{ opacity: 0, scale: 0.94, y: -12 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{   opacity: 0, scale: 0.94, y: -12 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              data-testid="command-palette"
              style={{
                position:      "fixed",
                top:           "18vh",
                left:          "50%",
                transform:     "translateX(-50%)",
                zIndex:        900,
                width:         "min(640px, 94vw)",
                maxHeight:     "64vh",
                display:       "flex",
                flexDirection: "column",
                background:    "linear-gradient(160deg, rgba(12,16,30,0.99), rgba(8,11,22,0.99))",
                border:        "1px solid rgba(255,255,255,0.09)",
                borderRadius:  18,
                boxShadow:     "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.06)",
                overflow:      "hidden",
              }}
            >
              {/* Search bar */}
              <div style={{
                display:     "flex", alignItems: "center", gap: 12,
                padding:     "14px 18px",
                borderBottom:"1px solid rgba(255,255,255,0.06)",
                flexShrink:  0,
              }}>
                {runsFetching && query === ""
                  ? <Loader2 size={16} color="rgba(0,200,150,0.5)" style={{ flexShrink: 0, animation: "spin-slow 1s linear infinite" }} />
                  : <Search size={16} color="rgba(232,238,255,0.35)" style={{ flexShrink: 0 }} />
                }
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pages, workflows, runs…"
                  data-testid="cmd-search-input"
                  style={{
                    flex: 1, background: "transparent",
                    border: "none", outline: "none",
                    color: "#E8EEFF", fontSize: 15,
                    fontFamily: "'DM Sans',sans-serif", fontWeight: 500,
                  }}
                />
                <button
                  onClick={close}
                  style={{
                    background:   "rgba(255,255,255,0.05)",
                    border:       "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 7, padding: "3px 8px",
                    cursor:       "pointer", color: "rgba(232,238,255,0.35)",
                    fontSize:     11, fontFamily: "'DM Mono',monospace",
                    display:      "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <X size={10} /> Esc
                </button>
              </div>

              {/* Results */}
              <div style={{ overflowY: "auto", flex: 1, padding: "8px 8px" }}>
                {groups.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "36px 0",
                    color: "rgba(232,238,255,0.2)", fontSize: 13,
                    fontFamily: "'DM Sans',sans-serif",
                  }}>
                    {emptyMsg}
                  </div>
                ) : (
                  (() => {
                    let flatIdx = 0;
                    return groups.map(group => (
                      <div key={group.label}>
                        <GroupLabel label={group.label} loading={group.loading} />
                        {group.items.map(item => {
                          const idx = flatIdx++;
                          return (
                            <ResultRow
                              key={item.id}
                              item={item}
                              active={idx === activeIndex}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => item.onSelect()}
                            />
                          );
                        })}
                      </div>
                    ));
                  })()
                )}
              </div>

              {/* Run count badge + keyboard hints footer */}
              <div style={{
                display:   "flex", alignItems: "center", gap: 16,
                padding:   "10px 18px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                flexShrink: 0, background: "rgba(0,0,0,0.15)",
              }}>
                {[
                  { icon: <CornerDownLeft size={10} />, label: "select" },
                  { icon: <><ChevronUp size={10} /><ChevronDown size={10} /></>, label: "navigate" },
                  { icon: <X size={10} />, label: "close" },
                ].map(h => (
                  <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 1,
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: 5, padding: "2px 5px", color: "rgba(232,238,255,0.4)",
                    }}>
                      {h.icon}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Sans',sans-serif" }}>
                      {h.label}
                    </span>
                  </div>
                ))}
                <div style={{ flex: 1 }} />
                {allRuns.length > 0 && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 10, color: "rgba(232,238,255,0.22)", fontFamily: "'DM Mono',monospace",
                  }}>
                    <Activity size={9} />
                    {allRuns.length} run{allRuns.length !== 1 ? "s" : ""} indexed
                  </span>
                )}
                <span style={{ fontSize: 10, color: "rgba(232,238,255,0.18)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>
                  ⌘K
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 768px) { .af-cmd-trigger { display: flex !important; } }
      `}</style>
    </>
  );
}
