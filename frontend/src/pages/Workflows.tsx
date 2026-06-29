/**
 * Workflows — Enterprise Redesign
 *
 * All hooks, API calls, mutations, and logic preserved exactly from Phase 3.
 * Visual changes:
 *   - Table layout (Name · Status · Trigger · Nodes · Runs · Updated · Actions)
 *   - Filter bar: search + status tabs + sort
 *   - Stats row above table
 *   - Row-level action buttons (Run, Edit, Toggle, Delete)
 *   - Empty state with illustration
 *   - All existing LiveBadge, WorkflowHealthBadge, WorkflowPredictionBadge preserved
 */

import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LayoutGroup, AnimatePresence, motion } from "framer-motion";
import { useWorkflows, useDeleteWorkflow, useToggleWorkflow, useWorkflowTemplates, useActivateTemplate } from "../hooks/useWorkflows";
import { useOrgWorkflows } from "../hooks/useOrgWorkflows";
import { useOrg } from "../contexts/OrgContext";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { workflowsAPI } from "../lib/api";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { WorkflowHealthBadge } from "../components/OrchestrationIntelligence";
import { WorkflowPredictionBadge } from "../components/PredictiveInsightsPanel";
import { useExecutionStream, formatDuration } from "../hooks/useExecutionStream";
import {
  Plus, Search, GitBranch, Trash2,
  Edit3, Activity, Clock, Zap, Radio, Loader,
  Filter, SortAsc, ChevronDown, MoreHorizontal,
  CheckCircle2, XCircle, AlarmClock, Lock, Link2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:      "#060810",
  surface: "#0C0F1A",
  raised:  "#111520",
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

/* ── Helpers ───────────────────────────────────────────────────────── */
function fmtDate(ts: any): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000)      return "just now";
  if (diff < 3600000)    return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000)   return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000)  return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── Status config ─────────────────────────────────────────────────── */
const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:   { label: "Active",   color: C.green,  bg: "rgba(0,200,150,0.08)",   border: "rgba(0,200,150,0.2)"   },
  inactive: { label: "Paused",   color: C.muted,  bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
  running:  { label: "Running",  color: C.purple, bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  error:    { label: "Error",    color: C.red,    bg: "rgba(251,113,133,0.08)", border: "rgba(251,113,133,0.2)" },
};

function StatusBadge({ active }: { active: boolean }) {
  const s = STATUS[active ? "active" : "inactive"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 700, color: s.color,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 100, padding: "3px 9px",
      fontFamily: "'DM Mono',monospace",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

/* ── Live execution badge (preserved) ─────────────────────────────── */
function LiveBadge({ workflowId }: { workflowId: string }) {
  const { execution } = useExecutionStream(workflowId);
  if (execution.phase === "idle") return null;
  const colors: Record<string, string> = {
    running: C.purple, starting: C.blue, completed: C.green,
    failed: C.red, cancelled: C.amber,
  };
  const color  = colors[execution.phase] ?? C.muted;
  const isLive = execution.phase === "running" || execution.phase === "starting";
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: `${color}12`, border: `1px solid ${color}28`,
        borderRadius: 100, padding: "2px 7px",
        fontSize: 9, fontWeight: 800, color,
        fontFamily: "'DM Mono',monospace",
      }}
    >
      {isLive
        ? <Radio size={8} color={color} style={{ animation: "glw 1.5s ease infinite" }} />
        : <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
      }
      {isLive ? `LIVE · ${formatDuration(execution.elapsedMs)}` : execution.phase.toUpperCase()}
    </motion.span>
  );
}

/* ── Skeleton row ──────────────────────────────────────────────────── */
function SkRow() {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 90px 90px 60px 60px 80px 100px",
      gap: 12, padding: "14px 18px", alignItems: "center",
      borderBottom: `1px solid ${C.border}`,
    }}>
      {[200, 80, 80, 40, 40, 60, 90].map((w, i) => (
        <div key={i} style={{
          height: 12, width: w, borderRadius: 4,
          background: "rgba(255,255,255,0.05)",
          animation: "af-skeleton-pulse 1.8s ease-in-out infinite",
        }} />
      ))}
    </div>
  );
}

/* ── Row action menu ───────────────────────────────────────────────── */
function RowMenu({ wf, onEdit, onDelete, onToggle, onTrigger, triggering }: any) {
  const [open, setOpen]           = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={e => e.stopPropagation()}>
      {/* Run */}
      <button
        data-testid={`trigger-workflow-${wf.id}`}
        onClick={() => onTrigger(wf.id)}
        disabled={triggering}
        title="Run workflow"
        style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: 7, padding: "5px 9px", cursor: triggering ? "default" : "pointer",
          color: C.purple, fontSize: 11, fontWeight: 600,
          fontFamily: "'DM Sans',sans-serif", opacity: triggering ? 0.6 : 1,
          transition: "all 0.14s",
        }}
        onMouseEnter={e => { if (!triggering) (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.15)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.08)"; }}
      >
        {triggering
          ? <Loader size={11} style={{ animation: "spin-slow 1s linear infinite" }} />
          : <Zap size={11} />
        }
        {triggering ? "Running…" : "Run"}
      </button>

      {/* Edit */}
      <button
        data-testid={`edit-workflow-${wf.id}`}
        onClick={() => onEdit(wf.id)}
        title="Edit workflow"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30,
          background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
          borderRadius: 7, cursor: "pointer", color: C.muted,
          transition: "all 0.14s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = C.text; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.color = C.muted; }}
      >
        <Edit3 size={12} />
      </button>

      {/* Toggle — on/off switch (Make.com style) */}
      <Switch
        checked={!!wf.is_active}
        onCheckedChange={() => onToggle(wf.id)}
        data-testid={`toggle-workflow-${wf.id}`}
        aria-label={wf.is_active ? "Deactivate workflow" : "Activate workflow"}
      />

      {/* Delete */}
      <button
        data-testid={`delete-workflow-${wf.id}`}
        onClick={() => {
          if (confirming) { onDelete(wf.id); setConfirming(false); }
          else { setConfirming(true); setTimeout(() => setConfirming(false), 2500); }
        }}
        title={confirming ? "Click again to confirm" : "Delete"}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30,
          background: confirming ? "rgba(251,113,133,0.12)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${confirming ? "rgba(251,113,133,0.3)" : C.border}`,
          borderRadius: 7, cursor: "pointer",
          color: confirming ? C.red : C.faint,
          transition: "all 0.18s",
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

/* ── Table row ─────────────────────────────────────────────────────── */
function WorkflowRow({ wf, onEdit, onDelete, onToggle, onTrigger, delay = 0 }: any) {
  const [triggering, setTriggering] = useState(false);

  const handleTrigger = async (id: string) => {
    setTriggering(true);
    await onTrigger(id);
    setTimeout(() => setTriggering(false), 2000);
  };

  const nodes = wf.nodes?.length || 0;

  return (
    <motion.div
      layout
      layoutId={`wf-row-${wf.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ delay, duration: 0.2 }}
      data-testid={`workflow-card-${wf.id}`}
      onClick={() => onEdit(wf.id)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 110px 90px 60px 70px 90px auto",
        gap: 12, alignItems: "center",
        padding: "13px 18px",
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
        transition: "background 0.14s",
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
    >
      {/* Name + badges */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: C.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontFamily: "'DM Sans',sans-serif",
          }}>
            {wf.name}
          </span>
          <AnimatePresence>
            <LiveBadge workflowId={String(wf.id)} />
          </AnimatePresence>
          <WorkflowHealthBadge workflowId={String(wf.id)} />
          <WorkflowPredictionBadge workflowId={String(wf.id)} />
        </div>
        {wf.description && (
          <div style={{
            fontSize: 11, color: C.faint,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontFamily: "'DM Sans',sans-serif",
          }}>
            {wf.description}
          </div>
        )}
      </div>

      {/* Status */}
      <div><StatusBadge active={!!wf.is_active} /></div>

      {/* Trigger type */}
      <div>
        {wf.trigger_type ? (
          <span style={{
            fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace",
            background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "2px 7px",
          }}>
            {wf.trigger_type}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace" }}>manual</span>
        )}
      </div>

      {/* Nodes */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <GitBranch size={11} color={C.faint} />
        <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace" }}>{nodes}</span>
      </div>

      {/* Run count */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Activity size={11} color={C.faint} />
        <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace" }}>
          {wf.run_count ?? "—"}
        </span>
      </div>

      {/* Updated */}
      <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
        {fmtDate(wf.updated_at)}
      </div>

      {/* Actions */}
      <RowMenu
        wf={wf}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggle={onToggle}
        onTrigger={handleTrigger}
        triggering={triggering}
      />
    </motion.div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────── */
function EmptyState({ search, onCreate }: { search: string; onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ textAlign: "center", padding: "72px 24px" }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: 16, margin: "0 auto 20px",
        background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <GitBranch size={28} color="rgba(0,200,150,0.35)" />
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: C.muted, marginBottom: 8 }}>
        {search ? "No workflows match your search" : "No workflows yet"}
      </div>
      <p style={{ fontSize: 13, color: C.faint, marginBottom: 24, maxWidth: 320, margin: "0 auto 24px" }}>
        {search ? "Try a different search term or clear the filter." : "Create your first workflow to start orchestrating tasks and automations."}
      </p>
      {!search && (
        <button
          onClick={onCreate}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#7C3AED", border: "none", borderRadius: 10,
            padding: "11px 22px", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif",
            boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
          }}
        >
          <Plus size={15} /> Create Workflow
        </button>
      )}
    </motion.div>
  );
}

/* ── Stat pill ─────────────────────────────────────────────────────── */
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
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace", marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

/* ── Filter tab ────────────────────────────────────────────────────── */
function FilterTab({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
        background: active ? "rgba(124,58,237,0.12)" : "transparent",
        color: active ? C.purple : C.muted,
        fontSize: 13, fontWeight: active ? 600 : 400,
        fontFamily: "'DM Sans',sans-serif",
        borderBottom: active ? `2px solid ${C.purple}` : "2px solid transparent",
        transition: "all 0.14s",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.text; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.muted; }}
    >
      {label}
      {count !== undefined && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: active ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)",
          color: active ? C.purple : C.faint,
          borderRadius: 100, padding: "1px 6px",
          fontFamily: "'DM Mono',monospace",
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ── AutomationsSection ─────────────────────────────────────────────── */
function AutomationsSection() {
  const { data: templates = [], isLoading } = useWorkflowTemplates();
  const activate = useActivateTemplate();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const categories: string[] = Array.from(new Set((templates as any[]).map((t: any) => t.category).filter(Boolean)));

  const filtered = activeCategory
    ? (templates as any[]).filter((t: any) => t.category === activeCategory)
    : (templates as any[]);

  const total   = (templates as any[]).length;
  const ready   = (templates as any[]).filter((t: any) => t.ready === true).length;
  const noConn  = (templates as any[]).filter((t: any) => t.ready === false).length;

  const handleActivate = async (templateId: string) => {
    setActivatingId(templateId);
    try {
      await activate.mutateAsync(templateId);
    } catch (err: any) {
      setActivatingId(null);
      const message = err?.message || "Failed to activate automation";
      toast({ title: "Couldn't activate automation", description: message, variant: "destructive" });
      console.error("[Quick Automation activate]", err);
    }
  };

  return (
    <div>
      {/* Stat pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <StatPill icon={Zap}          value={total}  label="TOTAL"             color={C.blue}   />
        <StatPill icon={CheckCircle2} value={ready}  label="READY TO USE"      color={C.green}  />
        <StatPill icon={Lock}         value={noConn} label="NEEDS CONNECTION"   color={C.amber}  />
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer",
              background: !activeCategory ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)",
              color: !activeCategory ? C.purple : C.muted,
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
              transition: "all 0.13s",
            }}
          >All</button>
          {categories.map((cat: string) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              style={{
                padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                background: activeCategory === cat ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)",
                color: activeCategory === cat ? C.purple : C.muted,
                fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.13s",
              }}
            >{cat}</button>
          ))}
        </div>
      )}

      {/* Templates grid */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
          {[0,1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 140, borderRadius: 12, background: "rgba(255,255,255,0.04)", animation: "af-skeleton-pulse 1.8s ease-in-out infinite" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: C.faint, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
          {activeCategory ? `No automations in "${activeCategory}"` : "No automation templates available yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
          {filtered.map((t: any) => {
            const isActivating = activatingId === t.id;
            const isReady = t.ready !== false;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: "16px",
                  display: "flex", flexDirection: "column", gap: 10,
                  transition: "border-color 0.14s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = C.borderH}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = C.border}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>
                    {t.icon || "⚡"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'DM Sans',sans-serif", marginBottom: 3 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.45 }}>{t.description}</div>
                  </div>
                  {!isReady && (
                    <div title="Needs connection" style={{ flexShrink: 0 }}>
                      <Lock size={13} color={C.amber} />
                    </div>
                  )}
                </div>

                {t.required_platforms && t.required_platforms.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {t.required_platforms.map((p: string) => {
                      const connected = t.connected_platforms?.includes?.(p);
                      return (
                        <span key={p} style={{
                          fontSize: 9, fontWeight: 700,
                          background: connected ? "rgba(0,200,150,0.08)" : "rgba(251,191,36,0.08)",
                          border: `1px solid ${connected ? "rgba(0,200,150,0.2)" : "rgba(251,191,36,0.2)"}`,
                          color: connected ? C.green : C.amber,
                          borderRadius: 100, padding: "2px 7px",
                          fontFamily: "'DM Mono',monospace",
                          textTransform: "uppercase",
                        }}>
                          {connected ? "✓" : "!"} {p}
                        </span>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={() => isReady ? handleActivate(t.id) : undefined}
                  disabled={isActivating || !isReady}
                  style={{
                    width: "100%", padding: "9px 0",
                    background: isReady ? "rgba(0,200,150,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isReady ? "rgba(0,200,150,0.25)" : C.border}`,
                    borderRadius: 8, cursor: isReady ? "pointer" : "default",
                    color: isReady ? C.green : C.faint,
                    fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    opacity: isActivating ? 0.6 : 1,
                    transition: "all 0.14s",
                  }}
                >
                  {isActivating ? (
                    <><Loader size={12} style={{ animation: "spin-slow 1s linear infinite" }} /> Activating…</>
                  ) : isReady ? (
                    <><Zap size={12} /> Use This Automation</>
                  ) : (
                    <><Lock size={12} /> Connect to Enable</>
                  )}
                </button>

                {!isReady && (
                  <a href="/connections" style={{ textAlign: "center", fontSize: 11, color: C.blue, fontFamily: "'DM Sans',sans-serif", textDecoration: "underline" }}>
                    Set up connections →
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function Workflows() {
  const nav     = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeOrg } = useOrg();
  const orgQuery      = useOrgWorkflows();
  const personalQuery = useWorkflows();
  const { data: workflows = [], isLoading, refetch } = activeOrg ? orgQuery : personalQuery;
  const deleteWF  = useDeleteWorkflow();
  const toggleWF  = useToggleWorkflow();
  const { toast } = useToast();

  const section = (searchParams.get("tab") === "automations" ? "automations" : "workflows") as "workflows" | "automations";
  const setSection = (s: "workflows" | "automations") => {
    if (s === "workflows") searchParams.delete("tab"); else searchParams.set("tab", s);
    setSearchParams(new URLSearchParams(searchParams));
  };

  const [search,   setSearch]   = useState("");
  const [tab,      setTab]      = useState<"all" | "active" | "paused">("all");
  const [creating, setCreating] = useState(false);

  const wfs = workflows as any[];
  const activeCount = wfs.filter(w => w.is_active).length;
  const pausedCount = wfs.filter(w => !w.is_active).length;

  const filtered = wfs.filter(w => {
    const matchSearch = !search ||
      w.name?.toLowerCase().includes(search.toLowerCase()) ||
      w.description?.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      tab === "all"    ? true :
      tab === "active" ? w.is_active :
      !w.is_active;
    return matchSearch && matchTab;
  });

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res: any = await workflowsAPI.create({ name: "New Workflow", description: "", nodes: [], edges: [] });
      const id = res?.workflow?.id || res?.id;
      if (id) { await refetch(); nav(`/workflow-builder/${id}`); }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not create workflow", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleTrigger = useCallback(async (id: string) => {
    try {
      await workflowsAPI.trigger(id);
      toast({ title: "Workflow triggered!", description: "Execution started." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Trigger failed", variant: "destructive" });
    }
  }, [toast]);

  const handleDelete = useCallback((id: string) => {
    deleteWF.mutate(id, {
      onSuccess: () => toast({ title: "Workflow deleted" }),
      onError:   (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  }, [deleteWF, toast]);

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "clamp(16px,3vw,28px)", maxWidth: 1440, margin: "0 auto" }}>

        {/* ── Header ── */}
        <Reveal>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.purple, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", marginBottom: 5 }}>
                ORCHESTRATION
              </div>
              <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: C.text, margin: 0 }}>
                Workflows & Automations
              </h1>
              <p style={{ fontSize: 13, color: C.muted, marginTop: 5, fontFamily: "'DM Sans',sans-serif" }}>
                Manage flows and one-click automations.
              </p>
            </div>
            {section === "workflows" && (
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 6px 20px rgba(124,58,237,0.4)" }}
                whileTap={{ scale: 0.97 }}
                onClick={handleCreate}
                disabled={creating}
                data-testid="button-create-workflow"
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#7C3AED", border: "none", borderRadius: 10,
                  padding: "11px 20px", color: "#fff",
                  fontSize: 13, fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  boxShadow: "0 4px 14px rgba(124,58,237,0.3)",
                  opacity: creating ? 0.6 : 1,
                }}
              >
                <Plus size={15} /> {creating ? "Creating…" : "Create Workflow"}
              </motion.button>
            )}
          </div>
        </Reveal>

        {/* ── Segmented control ── */}
        <Reveal delay={20}>
          <div style={{
            display: "inline-flex", background: "rgba(255,255,255,0.04)",
            border: `1px solid ${C.border}`, borderRadius: 10, padding: 3,
            marginBottom: 22, gap: 2,
          }}>
            {(["workflows", "automations"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                style={{
                  padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: section === s ? "rgba(124,58,237,0.18)" : "transparent",
                  color: section === s ? C.purple : C.muted,
                  fontSize: 12, fontWeight: section === s ? 700 : 400,
                  fontFamily: "'DM Sans',sans-serif",
                  transition: "all 0.14s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {s === "workflows" ? <GitBranch size={12} /> : <Zap size={12} />}
                {s === "workflows" ? "Workflows" : "Quick Automations"}
              </button>
            ))}
          </div>
        </Reveal>

        {section === "workflows" && (
          <>
        {/* ── Stat pills ── */}
        <Reveal delay={40}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
            <StatPill icon={GitBranch}    value={wfs.length}   label="TOTAL WORKFLOWS"   color={C.purple} />
            <StatPill icon={CheckCircle2} value={activeCount}  label="ACTIVE"            color={C.green}  />
            <StatPill icon={AlarmClock}   value={pausedCount}  label="PAUSED"            color={C.amber}  />
            <StatPill icon={Activity}     value={wfs.reduce((a: number, w: any) => a + (w.run_count || 0), 0)} label="TOTAL RUNS" color={C.blue} />
          </div>
        </Reveal>

        {/* ── Table card ── */}
        <Reveal delay={80}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 14, overflow: "hidden",
          }}>
            {/* Filter bar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 18px", borderBottom: `1px solid ${C.border}`,
              flexWrap: "wrap", gap: 10,
            }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 2 }}>
                <FilterTab label="All Workflows" active={tab === "all"}    count={wfs.length}   onClick={() => setTab("all")}    />
                <FilterTab label="Active"        active={tab === "active"} count={activeCount}  onClick={() => setTab("active")} />
                <FilterTab label="Paused"        active={tab === "paused"} count={pausedCount}  onClick={() => setTab("paused")} />
              </div>

              {/* Search */}
              <div style={{ position: "relative", flex: "0 0 280px", minWidth: 0 }}>
                <Search size={13} style={{
                  position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
                  color: C.faint, pointerEvents: "none",
                }} />
                <input
                  data-testid="input-search"
                  type="search"
                  placeholder="Search workflows…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: "7px 12px 7px 32px", color: C.text,
                    fontSize: 12, fontFamily: "'DM Sans',sans-serif",
                    outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)")}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
            </div>

            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px 90px 60px 70px 90px auto",
              gap: 12, padding: "9px 18px",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.015)",
            }}>
              {["NAME", "STATUS", "TRIGGER", "NODES", "RUNS", "UPDATED", "ACTIONS"].map(h => (
                <div key={h} style={{ fontSize: 9, fontWeight: 800, color: C.faint, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {isLoading ? (
              <div>
                {[0, 1, 2, 3, 4].map(i => <SkRow key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState search={search} onCreate={handleCreate} />
            ) : (
              <LayoutGroup id="workflows-table">
                <AnimatePresence mode="popLayout">
                  {filtered.map((wf: any, i: number) => (
                    <WorkflowRow
                      key={wf.id}
                      wf={wf}
                      delay={i * 0.03}
                      onEdit={(id: string) => nav(`/workflow-builder/${id}`)}
                      onDelete={handleDelete}
                      onToggle={(id: string) => toggleWF.mutate(id)}
                      onTrigger={handleTrigger}
                    />
                  ))}
                </AnimatePresence>
              </LayoutGroup>
            )}

            {/* Footer */}
            {!isLoading && filtered.length > 0 && (
              <div style={{
                padding: "11px 18px", borderTop: `1px solid ${C.border}`,
                fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>Showing {filtered.length} of {wfs.length} workflow{wfs.length !== 1 ? "s" : ""}</span>
                <span>{activeCount} active · {pausedCount} paused</span>
              </div>
            )}
          </div>
        </Reveal>
          </>
        )}

        {section === "automations" && (
          <Reveal delay={40}>
            <AutomationsSection />
          </Reveal>
        )}
      </div>

      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes glw { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes af-skeleton-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </PageTransition>
  );
}
