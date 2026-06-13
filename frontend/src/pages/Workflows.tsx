/**
 * Workflows — Phase 3
 *
 * Motion evolution:
 * - LayoutGroup for coordinated list choreography
 * - AnimatePresence for animated card insertion / removal
 * - Intelligent state transitions on toggle/trigger
 * - Execution transition feedback via useExecutionStream
 * - Hover glow systems
 */
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { LayoutGroup, AnimatePresence, motion } from "framer-motion";
import { useWorkflows, useDeleteWorkflow, useToggleWorkflow } from "../hooks/useWorkflows";
import { useOrgWorkflows } from "../hooks/useOrgWorkflows";
import { useOrg } from "../contexts/OrgContext";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { workflowsAPI } from "../lib/api";
import { Reveal } from "../components/Reveal";
import { Tilt } from "../components/Tilt";
import { useToast } from "@/hooks/use-toast";
import { WorkflowHealthBadge, WorkflowHealthBar } from "../components/OrchestrationIntelligence";
import { WorkflowPredictionBadge } from "../components/PredictiveInsightsPanel";
import { useExecutionStream, formatDuration } from "../hooks/useExecutionStream";
import {
  Plus, Search, GitBranch, Play, Pause, Trash2,
  Edit3, Activity, Clock, Zap, Radio, Loader,
} from "lucide-react";

/* ── Status config ───────────────────────────────────────────────────── */
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active:   { label: "ACTIVE",  color: "#00C896" },
  inactive: { label: "PAUSED",  color: "#94A3B8" },
  running:  { label: "RUNNING", color: "#A78BFA" },
  error:    { label: "ERROR",   color: "#FB7185" },
};

/* ── Live execution badge ────────────────────────────────────────────── */
function LiveBadge({ workflowId }: { workflowId: string }) {
  const { execution } = useExecutionStream(workflowId);
  if (execution.phase === "idle") return null;

  const colors: Record<string, string> = {
    running:   "#A78BFA",
    starting:  "#38BDF8",
    completed: "#00C896",
    failed:    "#FB7185",
    cancelled: "#FBBF24",
  };
  const color = colors[execution.phase] ?? "#94A3B8";
  const isLive = execution.phase === "running" || execution.phase === "starting";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        background: `${color}12`, border: `1px solid ${color}28`,
        borderRadius: 100, padding: "2px 8px",
      }}
    >
      {isLive
        ? <Radio size={9} color={color} style={{ animation: "glw 1.5s ease infinite" }} />
        : <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      }
      <span style={{
        fontSize: 9, fontWeight: 800, color,
        fontFamily: "'DM Mono',monospace", letterSpacing: "0.05em",
      }}>
        {isLive
          ? `LIVE · ${formatDuration(execution.elapsedMs)}`
          : execution.phase.toUpperCase()}
      </span>
    </motion.div>
  );
}

/* ── Workflow card ────────────────────────────────────────────────────── */
function WorkflowCard({ wf, onEdit, onDelete, onToggle, onTrigger }: any) {
  const [confirming, setConfirming] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const badge = STATUS_BADGE[wf.is_active ? "active" : "inactive"];
  const nodes = wf.nodes?.length || 0;

  const handleTrigger = async () => {
    setTriggering(true);
    await onTrigger(wf.id);
    setTimeout(() => setTriggering(false), 2000);
  };

  return (
    <motion.div
      layout
      layoutId={`wf-card-${wf.id}`}
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      whileHover={{ y: -2 }}
    >
      <Tilt max={4}>
        <div
          className="af-glass"
          data-testid={`workflow-card-${wf.id}`}
          style={{
            borderRadius: 18, padding: "22px",
            position: "relative", overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.06)",
            transition: "border-color 0.2s, box-shadow 0.2s",
            cursor: "pointer",
          }}
          onClick={() => onEdit(wf.id)}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = "rgba(0,200,150,0.2)";
            el.style.boxShadow   = "0 8px 40px rgba(0,200,150,0.06)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = "rgba(255,255,255,0.06)";
            el.style.boxShadow   = "none";
          }}
        >
          {/* Top shimmer line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 1,
            background: `linear-gradient(90deg, transparent, ${wf.is_active ? "#00C896" : "#94A3B8"}44, transparent)`,
          }} />

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: badge.color,
                  background: `${badge.color}15`, borderRadius: 100,
                  padding: "2px 8px", fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em",
                }}>
                  {badge.label}
                </span>
                {wf.trigger_type && (
                  <span style={{
                    fontSize: 10, color: "rgba(232,238,255,0.35)",
                    fontFamily: "'DM Mono',monospace",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 6, padding: "2px 6px",
                  }}>
                    {wf.trigger_type}
                  </span>
                )}
                {/* Live execution badge */}
                <AnimatePresence>
                  <LiveBadge workflowId={String(wf.id)} />
                </AnimatePresence>
                {/* Health intelligence badge */}
                <WorkflowHealthBadge workflowId={String(wf.id)} />
                {/* Predictive risk badge */}
                <WorkflowPredictionBadge workflowId={String(wf.id)} />
              </div>

              <h3 style={{
                fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif",
                color: "#E8EEFF", marginBottom: 4,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {wf.name}
              </h3>
              {wf.description && (
                <p style={{
                  fontSize: 12, color: "rgba(232,238,255,0.4)",
                  lineHeight: 1.5,
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {wf.description}
                </p>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div style={{
            display: "flex", gap: 16, marginBottom: 16, paddingBottom: 16,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
              <GitBranch size={11} /> {nodes} nodes
            </div>
            {wf.run_count !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
                <Activity size={11} /> {wf.run_count} runs
              </div>
            )}
            {wf.updated_at && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
                <Clock size={11} /> {new Date(wf.updated_at).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Health bar */}
          <WorkflowHealthBar workflowId={String(wf.id)} />

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
            <motion.button
              whileTap={{ scale: 0.94 }}
              data-testid={`toggle-workflow-${wf.id}`}
              onClick={() => onToggle(wf.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: wf.is_active ? "rgba(251,191,36,0.08)" : "rgba(0,200,150,0.08)",
                border: `1px solid ${wf.is_active ? "rgba(251,191,36,0.2)" : "rgba(0,200,150,0.2)"}`,
                borderRadius: 8, padding: "6px 10px",
                color: wf.is_active ? "#FBBF24" : "#00C896",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {wf.is_active ? <><Pause size={11} /> Pause</> : <><Play size={11} /> Activate</>}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              data-testid={`trigger-workflow-${wf.id}`}
              onClick={handleTrigger}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(167,139,250,0.08)",
                border: "1px solid rgba(167,139,250,0.22)",
                borderRadius: 8, padding: "6px 10px",
                color: "#A78BFA", fontSize: 11, fontWeight: 700,
                cursor: triggering ? "default" : "pointer",
                fontFamily: "'DM Sans',sans-serif",
                opacity: triggering ? 0.7 : 1,
              }}
            >
              {triggering
                ? <><Loader size={11} style={{ animation: "spin-slow 1s linear infinite" }} /> Running…</>
                : <><Zap size={11} /> Run</>}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              data-testid={`edit-workflow-${wf.id}`}
              onClick={() => onEdit(wf.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 8, padding: "6px 10px",
                color: "rgba(232,238,255,0.6)",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <Edit3 size={11} /> Edit
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              data-testid={`delete-workflow-${wf.id}`}
              onClick={() => {
                if (confirming) { onDelete(wf.id); setConfirming(false); }
                else setConfirming(true);
              }}
              onBlur={() => setTimeout(() => setConfirming(false), 200)}
              animate={{
                background: confirming ? "rgba(251,113,133,0.15)" : "transparent",
                borderColor: confirming ? "rgba(251,113,133,0.3)" : "rgba(255,255,255,0.07)",
                color: confirming ? "#FB7185" : "rgba(232,238,255,0.3)",
              }}
              transition={{ duration: 0.18 }}
              style={{
                marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8, padding: "6px 10px",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <Trash2 size={11} /> {confirming ? "Confirm?" : ""}
            </motion.button>
          </div>
        </div>
      </Tilt>
    </motion.div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────── */
function EmptyState({ search, onCreate }: { search: string; onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ textAlign: "center", padding: "80px 24px" }}
    >
      <motion.div
        animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        style={{ display: "inline-block", marginBottom: 16 }}
      >
        <GitBranch size={40} color="rgba(0,200,150,0.2)" />
      </motion.div>
      <div style={{
        fontSize: 18, fontWeight: 700, fontFamily: "'Syne',sans-serif",
        color: "rgba(232,238,255,0.4)", marginBottom: 8,
      }}>
        {search ? "No workflows match your search" : "No workflows yet"}
      </div>
      <p style={{ fontSize: 14, color: "rgba(232,238,255,0.25)", marginBottom: 24 }}>
        {search ? "Try a different search term." : "Create your first workflow to start orchestrating."}
      </p>
      {!search && (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onCreate}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#00C896", border: "none", borderRadius: 12,
            padding: "12px 24px", color: "#04060F",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          <Plus size={16} /> Create Workflow
        </motion.button>
      )}
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function Workflows() {
  const [, nav] = useLocation();
  const { activeOrg } = useOrg();
  // Phase 7: Use org-aware hook when workspace is active
  const orgQuery      = useOrgWorkflows();
  const personalQuery = useWorkflows();
  const { data: workflows = [], isLoading, refetch } = activeOrg ? orgQuery : personalQuery;
  const deleteWF  = useDeleteWorkflow();
  const toggleWF  = useToggleWorkflow();
  const { toast } = useToast();
  const [search,   setSearch]   = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = (workflows as any[]).filter((w: any) =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res: any = await workflowsAPI.create({
        name: "New Workflow", description: "", nodes: [], edges: [],
      });
      const id = res?.workflow?.id || res?.id;
      if (id) { await refetch(); nav(`/workflows/${id}`); }
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
      <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <Reveal>
          <div style={{
            display: "flex", alignItems: "flex-end",
            justifyContent: "space-between", flexWrap: "wrap",
            gap: 16, marginBottom: 32,
          }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#00C896",
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6,
              }}>
                ORCHESTRATION
              </div>
              <h1 style={{
                fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900,
                fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF",
              }}>
                Workflows
              </h1>
              <p style={{ fontSize: 14, color: "rgba(232,238,255,0.4)", marginTop: 4 }}>
                {(workflows as any[]).length} workflow{(workflows as any[]).length !== 1 ? "s" : ""} ·{" "}
                {(workflows as any[]).filter((w: any) => w.is_active).length} active
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(0,200,150,0.4)" }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCreate}
              disabled={creating}
              data-testid="button-create-workflow"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#00C896", border: "none", borderRadius: 12,
                padding: "12px 24px", color: "#04060F",
                fontSize: 14, fontWeight: 700,
                cursor: creating ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans',sans-serif",
                boxShadow: "0 0 30px rgba(0,200,150,0.3)",
                opacity: creating ? 0.6 : 1,
              }}
            >
              <Plus size={16} /> {creating ? "Creating…" : "New Workflow"}
            </motion.button>
          </div>
        </Reveal>

        {/* Search */}
        <Reveal delay={60}>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <Search size={15} style={{
              position: "absolute", left: 14, top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(232,238,255,0.3)", pointerEvents: "none",
            }} />
            <input
              data-testid="input-search"
              type="search"
              placeholder="Search workflows…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "12px 16px 12px 40px",
                color: "#E8EEFF", fontSize: 14,
                fontFamily: "'DM Sans',sans-serif",
                outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,200,150,0.3)")}
              onBlur={e  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            />
          </div>
        </Reveal>

        {/* Grid with LayoutGroup orchestration */}
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="af-glass af-shimmer" style={{ borderRadius: 18, height: 200 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState search={search} onCreate={handleCreate} />
        ) : (
          <LayoutGroup id="workflows-grid">
            <motion.div
              layout
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
                gap: 20,
              }}
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((wf: any) => (
                  <WorkflowCard
                    key={wf.id}
                    wf={wf}
                    onEdit={(id: string) => nav(`/workflows/${id}`)}
                    onDelete={handleDelete}
                    onToggle={(id: string) => toggleWF.mutate(id)}
                    onTrigger={handleTrigger}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
        )}
      </div>
    </PageTransition>
  );
}
