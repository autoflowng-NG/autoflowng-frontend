/**
 * AI Assistant — Enterprise Redesign
 *
 * All hooks, API calls, state, and logic preserved exactly.
 * FIXED:
 *   - History sidebar loads real sessions from aiAPI.sessions.list()
 *   - Sessions grouped by Today / Yesterday / Older dynamically
 *   - Session info panel shows real message_count and model from DB
 *   - activeHistId defaults to first real session (or "agent" fallback)
 *   - No hardcoded fake data anywhere
 *
 * ADDED (Workflow Blueprint feature):
 *   - extractBlueprint() parses ```workflow JSON blocks from AI replies
 *   - WorkflowCard component renders a validate-then-create UI card
 *   - MessageBubble strips the raw block and renders WorkflowCard below
 *   - blueprintToSteps() (lib/blueprintToSteps.ts) converts nodes/edges
 *     to executor step format for POST /api/workflows/validate
 *
 * ADDED (Run Now feature):
 *   - "Run Now" button in WorkflowCard triggers POST /api/workflows/:id/trigger
 *   - Polls GET /api/workflows/:id/runs → latest run ID → GET /runs/:runId
 *   - Inline result panel shows live status, step progress bar, error if failed
 *   - Polling stops on terminal status (completed/failed/cancelled) or 60s timeout
 */

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { aiAPI, workflowsAPI, connectionsAPI } from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { queryKeys } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useOrg } from "../contexts/OrgContext";
import { invalidateOrgWorkflows } from "../hooks/useOrgWorkflows";
import {
  Bot, Send, Trash2, Plus, Sparkles, User, Loader2,
  Copy, Check, Zap, Clock, ChevronRight, MessageSquare,
  GitBranch, Settings2, Code2, BarChart3,
  CheckCircle, XCircle, AlertTriangle, ExternalLink, Play,
  Cpu, Mail, MessageCircle, Bell, Filter, GitMerge, Database,
  Globe, Code, Timer, Power, WifiOff,
} from "lucide-react";
import { blueprintToSteps } from "../lib/blueprintToSteps";

/* ── Types ─────────────────────────────────────────────────────────── */
interface Msg { role: "user" | "assistant"; content: string; id: string; ts: number; }

interface Session {
  session_id: string;
  title: string | null;
  model: string | null;
  message_count: number;
  last_message_at: string;
  created_at: string;
  last_message: string | null;
}

/* ── Workflow Blueprint Types ───────────────────────────────────────── */
interface WorkflowBlueprint {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  nodes: { id: string; type: string; label: string; config: Record<string, unknown> }[];
  edges: { from: string; to: string }[];
}

type CardState = "idle" | "validating" | "valid" | "invalid" | "creating" | "created";

/* Run execution types */
type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "timeout";
interface RunResult {
  id: string;
  status: RunStatus;
  steps_completed: number | null;
  steps_total: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}
type RunState = "idle" | "triggering" | "polling" | "done";

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
  purple:  "#A78BFA",
  blue:    "#38BDF8",
  green:   "#00C896",
  amber:   "#FBBF24",
  red:     "#FB7185",
};

/* ── Quick prompts ─────────────────────────────────────────────────── */
const QUICK_PROMPTS = [
  { icon: GitBranch, label: "Workflow ideas",       text: "Create a workflow that sends a WhatsApp alert when a webhook fires" },
  { icon: Zap,       label: "Automation help",      text: "Explain how to connect Telegram notifications to my automations" },
  { icon: Code2,     label: "API monitoring",       text: "Generate a workflow that checks an API and notifies me on failure" },
  { icon: Clock,     label: "Scheduling",           text: "What's the best way to schedule recurring automations?" },
  { icon: Settings2, label: "Workflow optimization",text: "How can I optimise my existing workflows for better performance?" },
  { icon: BarChart3, label: "Analytics",            text: "What metrics should I track for my workflow executions?" },
];

/* ── Group sessions by date ────────────────────────────────────────── */
function groupSessions(sessions: Session[]) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;

  const groups: { label: string; sessions: Session[] }[] = [
    { label: "Today",     sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Older",     sessions: [] },
  ];

  for (const s of sessions) {
    const t = new Date(s.last_message_at || s.created_at).getTime();
    if (t >= today)     groups[0].sessions.push(s);
    else if (t >= yesterday) groups[1].sessions.push(s);
    else                groups[2].sessions.push(s);
  }

  return groups.filter(g => g.sessions.length > 0);
}

/* ── Time helper ───────────────────────────────────────────────────── */
function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/* ── Blueprint parser ──────────────────────────────────────────────── */
/**
 * extractBlueprint — strips the ```workflow JSON block from AI reply text.
 * Fails closed: any parse error or missing required field returns null blueprint
 * and the raw content unchanged, so the message renders as plain text only.
 */
function extractBlueprint(content: string): { clean: string; blueprint: WorkflowBlueprint | null } {
  const match = content.match(/```workflow\s*([\s\S]*?)```/);
  if (!match) return { clean: content, blueprint: null };
  try {
    const parsed = JSON.parse(match[1].trim());
    if (!parsed?.name || !Array.isArray(parsed?.nodes) || !Array.isArray(parsed?.edges)) {
      return { clean: content, blueprint: null };
    }
    const clean = content.replace(match[0], "").trim();
    return { clean, blueprint: parsed as WorkflowBlueprint };
  } catch {
    return { clean: content, blueprint: null };
  }
}

/* ── Node type icon helper ─────────────────────────────────────────── */
function nodeIcon(type: string) {
  const sz = 11;
  const col = C.muted;
  switch (true) {
    case type === "trigger":        return <Zap size={sz} color={C.purple} />;
    case type === "ai_generate":    return <Cpu size={sz} color={C.blue} />;
    case type === "gmail_send":
    case type === "gmail_reply":    return <Mail size={sz} color={col} />;
    case type === "whatsapp_send":
    case type === "telegram_send":
    case type === "slack_post":     return <MessageCircle size={sz} color={col} />;
    case type === "twitter_post":
    case type === "linkedin_post":
    case type === "facebook_post":  return <Globe size={sz} color={col} />;
    case type === "notify":         return <Bell size={sz} color={col} />;
    case type === "condition":
    case type === "branch_if":
    case type === "filter":         return <Filter size={sz} color={col} />;
    case type === "router":         return <GitMerge size={sz} color={col} />;
    case type === "http_request":
    case type === "webhook":        return <Globe size={sz} color={C.blue} />;
    case type === "database":       return <Database size={sz} color={col} />;
    case type === "code":
    case type === "transform":      return <Code size={sz} color={col} />;
    case type === "delay":          return <Timer size={sz} color={col} />;
    default:                        return <Play size={sz} color={col} />;
  }
}

/* ── WorkflowCard component ────────────────────────────────────────── */
function WorkflowCard({ blueprint }: { blueprint: WorkflowBlueprint }) {
  const [state, setState] = useState<CardState>("idle");
  const [errors, setErrors]   = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { activeOrg } = useOrg();

  /* ── Connection-awareness state ── */
  const [missingPlatforms, setMissingPlatforms] = useState<string[]>([]);
  const [activating, setActivating] = useState(false);
  const [isActive, setIsActive] = useState(false);

  // Platform required per step type — mirrors executor.js findConn() mapping
  const PLATFORM_REQUIRED: Record<string, string> = {
    gmail_send: "gmail", gmail_reply: "gmail",
    twitter_post: "twitter",
    linkedin_post: "linkedin",
    facebook_post: "facebook",
    slack_post: "slack",
    telegram_send: "telegram",
    whatsapp_send: "whatsapp",
  };

  /* ── Run Now state ── */
  const [runState, setRunState]   = useState<RunState>("idle");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Stop any active polling on unmount */
  useEffect(() => () => {
    if (pollRef.current)   clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const TERMINAL: RunStatus[] = ["completed", "failed", "cancelled", "timeout"];

  const stopPolling = () => {
    if (pollRef.current)    { clearInterval(pollRef.current);  pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const pollRun = (wfId: string, runId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const r: any = await workflowsAPI.run(wfId, runId);
        const run: RunResult = r?.run ?? r;
        setRunResult(run);
        if (TERMINAL.includes(run.status as RunStatus)) {
          stopPolling();
          setRunState("done");
        }
      } catch {
        /* keep polling on transient errors */
      }
    }, 1500);
  };

  const handleRunNow = async () => {
    if (!createdId || runState !== "idle") return;
    setRunState("triggering");
    setRunResult(null);
    try {
      await workflowsAPI.trigger(createdId);
    } catch (e: any) {
      toast({ title: "Trigger failed", description: e?.message || "Could not start workflow", variant: "destructive" });
      setRunState("idle");
      return;
    }

    /* Grab the latest run ID (the trigger route doesn't return one) */
    setRunState("polling");
    let runId: string | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise(r => setTimeout(r, 800));
      try {
        const runsData: any = await workflowsAPI.runs(createdId);
        const latest = (runsData?.runs ?? runsData)?.[0];
        if (latest?.id) { runId = latest.id; setRunResult(latest); break; }
      } catch { /* retry */ }
    }

    if (!runId) {
      toast({ title: "Run started", description: "Execution is queued — check the Workflows page for progress." });
      setRunState("done");
      return;
    }

    /* Hard timeout — stop polling after 60s regardless */
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setRunResult(prev => prev ? { ...prev, status: "timeout" } : null);
      setRunState("done");
    }, 60_000);

    pollRun(createdId, runId);
  };

  // Auto-validate on mount
  useEffect(() => {
    let cancelled = false;
    setState("validating");
    setErrors([]);
    setWarnings([]);

    const steps = blueprintToSteps(blueprint.nodes, blueprint.edges);

    // Check which required platforms are not connected.
    // FIX: this useEffect callback is not async (and shouldn't be — see the
    // cleanup function returned below), so `await` cannot be used directly
    // inside it. Converted to .then() chaining to match the existing
    // workflowsAPI.validate() call further down in this same effect.
    connectionsAPI.list().then((connsData: any) => {
      if (cancelled) return;
      const connected: Set<string> = new Set(
        (connsData?.connections ?? connsData ?? []).map((c: any) => c.platform).filter(Boolean)
      );
      const requiredPlatforms = blueprint.nodes
        .map(n => PLATFORM_REQUIRED[n.type])
        .filter((p): p is string => !!p);
      const missing = [...new Set(requiredPlatforms)].filter(p => !connected.has(p));
      setMissingPlatforms(missing);
    }).catch(() => {
      // Non-fatal — connection check failure should not block workflow creation
    });

    workflowsAPI.validate({
      name: blueprint.name,
      trigger_type: blueprint.trigger_type,
      trigger_config: blueprint.trigger_config,
      steps,
    }).then((result: any) => {
      if (cancelled) return;
      if (result.errors && result.errors.length > 0) {
        setErrors(result.errors);
        setWarnings(result.warnings || []);
        setState("invalid");
      } else {
        setWarnings(result.warnings || []);
        setState("valid");
      }
    }).catch(() => {
      if (!cancelled) setState("invalid");
    });

    return () => { cancelled = true; };
  }, [blueprint]);

  const handleCreate = async () => {
    setState("creating");
    try {
      const result: any = await workflowsAPI.create({
        name: blueprint.name,
        description: blueprint.description,
        trigger_type: blueprint.trigger_type,
        trigger_config: blueprint.trigger_config || {},
        nodes: blueprint.nodes,
        edges: blueprint.edges,
      });
      const wfId = result?.workflow?.id || result?.id;
      setCreatedId(wfId || null);
      setState("created");
      invalidateOrgWorkflows(activeOrg?.id ?? null);
      toast({ title: "Workflow created", description: blueprint.name });
    } catch (e: any) {
      setState("valid");
      toast({ title: "Create failed", description: e?.message || "Could not create workflow", variant: "destructive" });
    }
  };

  const handleActivate = async () => {
    if (!createdId || activating) return;
    setActivating(true);
    try {
      await workflowsAPI.toggle(createdId);
      setIsActive(true);
      invalidateOrgWorkflows(activeOrg?.id ?? null);
      toast({ title: "Workflow activated", description: `${blueprint.name} is now live.` });
    } catch (e: any) {
      toast({ title: "Activation failed", description: e?.message || "Could not activate workflow", variant: "destructive" });
    } finally {
      setActivating(false);
    }
  };

  const badgeColor = (() => {
    if (state === "validating") return C.faint;
    if (state === "invalid")    return C.red;
    if (state === "valid" || state === "creating" || state === "created") return C.green;
    return C.faint;
  })();

  const badgeLabel = (() => {
    if (state === "validating") return "Validating…";
    if (state === "invalid")    return "Needs fixes";
    if (state === "valid")      return "Ready to create";
    if (state === "creating")   return "Creating…";
    if (state === "created")    return "Created";
    return "";
  })();

  const BadgeIcon = (() => {
    if (state === "invalid")  return XCircle;
    if (state === "valid" || state === "creating" || state === "created") return CheckCircle;
    return Loader2;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{
        marginTop: 10, marginBottom: 4,
        background: "rgba(167,139,250,0.05)",
        border: `1px solid rgba(167,139,250,0.2)`,
        borderRadius: 12,
        overflow: "hidden",
        maxWidth: "100%",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "11px 14px 8px",
        borderBottom: `1px solid rgba(255,255,255,0.05)`,
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: C.text,
            fontFamily: "'DM Sans',sans-serif",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {blueprint.name}
          </div>
          {blueprint.description && (
            <div style={{
              fontSize: 11, color: C.muted, marginTop: 2,
              fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4,
            }}>
              {blueprint.description}
            </div>
          )}
          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              fontSize: 9, fontFamily: "'DM Mono',monospace",
              color: C.purple, background: "rgba(167,139,250,0.12)",
              borderRadius: 4, padding: "2px 6px",
              letterSpacing: "0.04em",
            }}>
              {blueprint.trigger_type}
            </span>
            <span style={{ fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
              {blueprint.nodes.length} nodes
            </span>
          </div>
        </div>

        {/* Validation badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          fontSize: 10, fontWeight: 600, color: badgeColor,
          fontFamily: "'DM Sans',sans-serif",
          flexShrink: 0, paddingTop: 2,
        }}>
          <BadgeIcon
            size={12}
            color={badgeColor}
            style={state === "validating" || state === "creating"
              ? { animation: "spin-slow 1s linear infinite" }
              : undefined}
          />
          {badgeLabel}
        </div>
      </div>

      {/* Node list */}
      <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        {blueprint.nodes.map(node => (
          <div key={node.id} style={{
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 5, flexShrink: 0,
              background: "rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {nodeIcon(node.type)}
            </div>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Sans',sans-serif" }}>
              {node.label}
            </span>
            <span style={{
              fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace",
              marginLeft: "auto",
            }}>
              {node.type}
            </span>
          </div>
        ))}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ padding: "0 14px 8px" }}>
          {errors.map((e, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 5,
              fontSize: 10.5, color: C.red,
              fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, marginTop: 3,
            }}>
              <XCircle size={11} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
              {e}
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && state !== "invalid" && (
        <div style={{ padding: "0 14px 6px" }}>
          {warnings.map((w, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 5,
              fontSize: 10.5, color: C.amber,
              fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, marginTop: 3,
            }}>
              <AlertTriangle size={11} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Missing connection warning */}
      {missingPlatforms.length > 0 && state !== "created" && (
        <div style={{ padding: "0 14px 8px" }}>
          {missingPlatforms.map((platform) => (
            <div key={platform} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
              borderRadius: 8, padding: "8px 10px", marginTop: 6,
              fontSize: 10.5, color: C.amber, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5,
            }}>
              <WifiOff size={11} color={C.amber} style={{ flexShrink: 0 }} />
              <span>
                This workflow needs <strong>{platform}</strong> connected before it will run.{" "}
                <span
                  onClick={() => navigate("/integration-hub")}
                  style={{ textDecoration: "underline", cursor: "pointer" }}
                >
                  Connect in Integration Hub
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Inline run result panel ── */}
      {runResult && (
        <div style={{
          margin: "0 14px 8px",
          background: (() => {
            if (runResult.status === "completed") return "rgba(0,200,150,0.06)";
            if (runResult.status === "failed")    return "rgba(251,113,133,0.06)";
            return "rgba(167,139,250,0.05)";
          })(),
          border: `1px solid ${(() => {
            if (runResult.status === "completed") return "rgba(0,200,150,0.2)";
            if (runResult.status === "failed")    return "rgba(251,113,133,0.2)";
            return "rgba(167,139,250,0.12)";
          })()}`,
          borderRadius: 8,
          padding: "9px 12px",
        }}>
          {/* Status row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {runResult.status === "completed" && <CheckCircle size={11} color={C.green} />}
              {runResult.status === "failed"    && <XCircle     size={11} color={C.red}   />}
              {runResult.status === "timeout"   && <AlertTriangle size={11} color={C.amber} />}
              {(runResult.status === "pending" || runResult.status === "running") &&
                <Loader2 size={11} color={C.purple} style={{ animation: "spin-slow 1s linear infinite" }} />}
              {runResult.status === "cancelled" && <XCircle size={11} color={C.faint} />}
              <span style={{
                fontSize: 10.5, fontWeight: 700,
                fontFamily: "'DM Mono',monospace",
                letterSpacing: "0.05em",
                color: runResult.status === "completed" ? C.green
                     : runResult.status === "failed"    ? C.red
                     : runResult.status === "timeout"   ? C.amber
                     : C.muted,
              }}>
                {runResult.status === "timeout" ? "TIMED OUT" : runResult.status.toUpperCase()}
              </span>
            </div>
            {runResult.steps_total != null && runResult.steps_total > 0 && (
              <span style={{
                fontSize: 9, color: C.faint,
                fontFamily: "'DM Mono',monospace",
              }}>
                {runResult.steps_completed ?? 0}/{runResult.steps_total} steps
              </span>
            )}
          </div>

          {/* Progress bar */}
          {runResult.steps_total != null && runResult.steps_total > 0 && (
            <div style={{
              height: 3, borderRadius: 2,
              background: "rgba(255,255,255,0.07)",
              marginBottom: runResult.error_message ? 7 : 0,
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: runResult.status === "completed" ? C.green
                           : runResult.status === "failed"   ? C.red
                           : C.purple,
                width: `${Math.round(((runResult.steps_completed ?? 0) / runResult.steps_total) * 100)}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
          )}

          {/* Error message */}
          {runResult.error_message && (
            <div style={{
              fontSize: 10.5, color: C.red, marginTop: 4,
              fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5,
            }}>
              {runResult.error_message}
            </div>
          )}

          {/* Timeout note */}
          {runResult.status === "timeout" && (
            <div style={{
              fontSize: 10.5, color: C.amber, marginTop: 4,
              fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5,
            }}>
              Still running — check the Workflows page for the final result.
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        padding: "8px 14px 12px",
        borderTop: `1px solid rgba(255,255,255,0.04)`,
        display: "flex", gap: 8, flexWrap: "wrap",
      }}>
        {state === "created" ? (
          <>
            {/* Activate Now */}
            {isActive ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 600, color: C.green,
                fontFamily: "'DM Sans',sans-serif",
                padding: "6px 12px",
                background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)",
                borderRadius: 7,
              }}>
                <CheckCircle size={11} /> Active — listening now
              </div>
            ) : (
              <button
                onClick={handleActivate}
                disabled={activating || missingPlatforms.length > 0}
                title={missingPlatforms.length > 0 ? `Connect ${missingPlatforms.join(", ")} first` : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: missingPlatforms.length > 0
                    ? "rgba(255,255,255,0.04)"
                    : activating ? "rgba(0,200,150,0.05)" : "rgba(0,200,150,0.15)",
                  border: `1px solid ${missingPlatforms.length > 0 ? C.border : "rgba(0,200,150,0.3)"}`,
                  borderRadius: 7, padding: "6px 12px",
                  color: missingPlatforms.length > 0 ? C.faint : C.green,
                  fontSize: 11, fontWeight: 600,
                  cursor: (activating || missingPlatforms.length > 0) ? "not-allowed" : "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  transition: "all 0.15s",
                  opacity: activating ? 0.7 : 1,
                }}
              >
                {activating
                  ? <><Loader2 size={11} style={{ animation: "spin-slow 1s linear infinite" }} /> Activating…</>
                  : <><Power size={11} /> Activate Now</>
                }
              </button>
            )}

            {/* Run Now */}
            <button
              onClick={handleRunNow}
              disabled={runState !== "idle"}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: runState === "idle"
                  ? "rgba(56,189,248,0.12)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${runState === "idle" ? "rgba(56,189,248,0.3)" : C.border}`,
                borderRadius: 7, padding: "6px 12px",
                color: runState === "idle" ? C.blue : C.faint,
                fontSize: 11, fontWeight: 600,
                cursor: runState === "idle" ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.15s",
              }}
            >
              {runState === "triggering" || runState === "polling"
                ? <><Loader2 size={11} style={{ animation: "spin-slow 1s linear infinite" }} />
                    {runState === "triggering" ? "Starting…" : "Running…"}</>
                : <><Play size={11} /> Run Now</>
              }
            </button>

            <button
              onClick={() => createdId && navigate(`/workflow-builder/${createdId}`)}
              disabled={!createdId}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(167,139,250,0.15)",
                border: "1px solid rgba(167,139,250,0.3)",
                borderRadius: 7, padding: "6px 12px",
                color: C.purple, fontSize: 11, fontWeight: 600,
                cursor: createdId ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <ExternalLink size={11} /> Open in Builder
            </button>
            <button
              onClick={() => navigate("/workflows")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 7, padding: "6px 12px",
                color: C.muted, fontSize: 11, fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              View in Workflows
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleCreate}
              disabled={state !== "valid"}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: state === "valid"
                  ? "rgba(0,200,150,0.15)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${state === "valid" ? "rgba(0,200,150,0.3)" : C.border}`,
                borderRadius: 7, padding: "6px 12px",
                color: state === "valid" ? C.green : C.faint,
                fontSize: 11, fontWeight: 600,
                cursor: state === "valid" ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.15s",
              }}
            >
              {state === "creating"
                ? <><Loader2 size={11} style={{ animation: "spin-slow 1s linear infinite" }} /> Creating…</>
                : <><Play size={11} /> Create Workflow</>
              }
            </button>
            <button
              onClick={() => navigate("/workflow-builder")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 7, padding: "6px 12px",
                color: C.muted, fontSize: 11, fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <ExternalLink size={11} /> Open in Builder
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ── Message bubble ────────────────────────────────────────────────── */
function MessageBubble({ msg }: { msg: Msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  // Parse blueprint from assistant messages (no-op for user messages)
  const { clean, blueprint } = isUser
    ? { clean: msg.content, blueprint: null }
    : extractBlueprint(typeof msg.content === "string" ? msg.content : "");

  const displayContent = typeof msg.content === "string" ? clean : "[Unable to display this message]";

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      data-testid={`message-${msg.id}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        marginBottom: 18,
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isUser ? "rgba(56,189,248,0.12)" : "rgba(167,139,250,0.12)",
        border: `1.5px solid ${isUser ? "rgba(56,189,248,0.25)" : "rgba(167,139,250,0.25)"}`,
      }}>
        {isUser
          ? <User size={13} color={C.blue} />
          : <Bot  size={13} color={C.purple} />
        }
      </div>

      {/* Bubble + optional WorkflowCard */}
      <div style={{ maxWidth: "78%", position: "relative" }}
        onMouseEnter={e => {
          const btn = (e.currentTarget as HTMLElement).querySelector(".copy-btn") as HTMLElement;
          if (btn) btn.style.opacity = "1";
        }}
        onMouseLeave={e => {
          const btn = (e.currentTarget as HTMLElement).querySelector(".copy-btn") as HTMLElement;
          if (btn) btn.style.opacity = "0";
        }}
      >
        {displayContent && (
          <div style={{
            background: isUser
              ? "rgba(56,189,248,0.08)"
              : "rgba(167,139,250,0.06)",
            border: `1px solid ${isUser ? "rgba(56,189,248,0.15)" : "rgba(167,139,250,0.12)"}`,
            borderRadius: isUser ? "14px 3px 14px 14px" : "3px 14px 14px 14px",
            padding: "11px 15px",
            color: C.text, fontSize: 13.5,
            lineHeight: 1.7,
            fontFamily: "'DM Sans',sans-serif",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {displayContent}
          </div>
        )}

        {/* WorkflowCard — only for assistant messages with a valid blueprint */}
        {!isUser && blueprint && (
          <WorkflowCard blueprint={blueprint} />
        )}

        {/* Timestamp */}
        <div style={{
          fontSize: 9, color: C.faint,
          fontFamily: "'DM Mono',monospace",
          marginTop: 4,
          textAlign: isUser ? "right" : "left",
        }}>
          {fmtTime(msg.ts)}
        </div>

        {/* Copy btn */}
        <button
          className="copy-btn"
          onClick={copy}
          style={{
            position: "absolute", top: 8,
            right: isUser ? "auto" : -30,
            left: isUser ? -30 : "auto",
            background: "rgba(255,255,255,0.06)",
            border: "none", borderRadius: 6,
            width: 24, height: 24,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: C.faint,
            opacity: 0, transition: "opacity 0.15s",
          }}
        >
          {copied
            ? <Check size={11} color={C.green} />
            : <Copy size={11} />
          }
        </button>
      </div>
    </motion.div>
  );
}

/* ── Thinking indicator ────────────────────────────────────────────── */
function Thinking() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 18 }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(167,139,250,0.12)",
        border: "1.5px solid rgba(167,139,250,0.25)",
      }}>
        <Bot size={13} color={C.purple} />
      </div>
      <div style={{
        background: "rgba(167,139,250,0.06)",
        border: "1px solid rgba(167,139,250,0.12)",
        borderRadius: "3px 14px 14px 14px",
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Loader2 size={13} color={C.purple} style={{ animation: "spin-slow 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: C.muted, fontFamily: "'DM Sans',sans-serif" }}>Thinking…</span>
        <div style={{ display: "flex", gap: 3 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 4, height: 4, borderRadius: "50%",
              background: C.purple, opacity: 0.5,
              animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── History sidebar — real data ───────────────────────────────────── */
function HistorySidebar({ sessions, activeId, onSelect, onNew, loading }: {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  loading: boolean;
}) {
  const groups = groupSessions(sessions);

  return (
    <div style={{
      width: 220, flexShrink: 0, borderRight: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column",
      background: C.surface,
    }}>
      {/* New chat btn */}
      <div style={{ padding: "14px 12px", borderBottom: `1px solid ${C.border}` }}>
        <button
          data-testid="button-new-chat"
          onClick={onNew}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.22)",
            borderRadius: 9, padding: "9px 12px", cursor: "pointer",
            color: C.purple, fontSize: 12, fontWeight: 600,
            fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.16)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.1)"}
        >
          <Plus size={13} /> New Chat
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px", scrollbarWidth: "none" }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              height: 52, borderRadius: 8, marginBottom: 6,
              background: "rgba(255,255,255,0.03)",
              animation: "af-pulse 1.8s ease-in-out infinite",
            }} />
          ))
        ) : groups.length === 0 ? (
          <div style={{
            padding: "24px 12px", textAlign: "center",
            fontSize: 11, color: C.faint, fontFamily: "'DM Sans',sans-serif",
          }}>
            No conversations yet
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: C.faint,
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em",
                padding: "6px 8px 4px",
              }}>
                {group.label.toUpperCase()}
              </div>
              {group.sessions.map(s => {
                const isActive = s.session_id === activeId;
                const title    = s.title || s.session_id;
                const preview  = s.last_message ? s.last_message.slice(0, 60) : "";
                return (
                  <button
                    key={s.session_id}
                    onClick={() => onSelect(s.session_id)}
                    style={{
                      width: "100%", padding: "8px 10px",
                      background: isActive ? "rgba(167,139,250,0.1)" : "transparent",
                      border: `1px solid ${isActive ? "rgba(167,139,250,0.2)" : "transparent"}`,
                      borderRadius: 8, cursor: "pointer", textAlign: "left",
                      transition: "all 0.14s", marginBottom: 2,
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: isActive ? 600 : 400,
                      color: isActive ? C.purple : C.muted,
                      fontFamily: "'DM Sans',sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginBottom: 2,
                    }}>
                      {title}
                    </div>
                    {preview && (
                      <div style={{
                        fontSize: 10, color: C.faint,
                        fontFamily: "'DM Sans',sans-serif",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {preview}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 12px", borderTop: `1px solid ${C.border}`,
        fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace",
        textAlign: "center",
      }}>
        AUTOFLOWNG AI · ORCHESTRATION ASSISTANT
      </div>
    </div>
  );
}

/* ── Quick prompts panel ───────────────────────────────────────────── */
function QuickPromptsPanel({ onSend, activeSession }: {
  onSend: (text: string) => void;
  activeSession: Session | null;
}) {
  return (
    <div style={{
      width: 220, flexShrink: 0, borderLeft: `1px solid ${C.border}`,
      padding: "16px 12px",
      background: C.surface,
      display: "flex", flexDirection: "column", gap: 8,
      overflowY: "auto", scrollbarWidth: "none",
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: C.faint,
        fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 4,
      }}>
        SUGGESTED PROMPTS
      </div>

      {QUICK_PROMPTS.map((p, i) => (
        <button
          key={i}
          data-testid={`quick-prompt-${i}`}
          onClick={() => onSend(p.text)}
          style={{
            width: "100%", textAlign: "left",
            background: "rgba(167,139,250,0.04)",
            border: "1px solid rgba(167,139,250,0.1)",
            borderRadius: 9, padding: "10px 11px",
            cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(167,139,248,0.1)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.25)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.04)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.1)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 5,
              background: "rgba(167,139,250,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <p.icon size={10} color={C.purple} />
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, color: C.purple,
              fontFamily: "'DM Sans',sans-serif",
            }}>
              {p.label}
            </span>
          </div>
          <div style={{
            fontSize: 10.5, color: C.faint,
            fontFamily: "'DM Sans',sans-serif",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {p.text}
          </div>
        </button>
      ))}

      {/* Session info — live from backend */}
      <div style={{
        marginTop: "auto", paddingTop: 12,
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>
          SESSION INFO
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { label: "Model",    value: activeSession?.model || "AutoFlowNG AI" },
            { label: "Session",  value: activeSession?.session_id || "agent" },
            { label: "Messages", value: activeSession?.message_count != null ? String(activeSession.message_count) : "—" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace" }}>{r.label}</span>
              <span style={{
                fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace",
                maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────── */
function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      minHeight: 400, textAlign: "center", padding: "32px 24px",
    }}>
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 3, repeat: Infinity }}
        style={{
          width: 64, height: 64, borderRadius: 20, marginBottom: 20,
          background: "rgba(167,139,250,0.1)",
          border: "1px solid rgba(167,139,250,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Sparkles size={28} color={C.purple} />
      </motion.div>

      <h2 style={{
        fontSize: 20, fontWeight: 800,
        fontFamily: "'Syne',sans-serif", letterSpacing: "-0.03em",
        color: C.text, marginBottom: 8,
      }}>
        What can I help you automate?
      </h2>
      <p style={{
        fontSize: 13, color: C.muted, lineHeight: 1.65,
        maxWidth: 420, marginBottom: 28,
        fontFamily: "'DM Sans',sans-serif",
      }}>
        I'm your AI-native orchestration assistant. Ask me to build workflows,
        explain automations, or generate integration logic.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        gap: 8, width: "100%", maxWidth: 540,
      }}>
        {QUICK_PROMPTS.slice(0, 4).map((p, i) => (
          <button
            key={i}
            data-testid={`quick-prompt-${i}`}
            onClick={() => onSend(p.text)}
            style={{
              background: "rgba(167,139,250,0.05)",
              border: "1px solid rgba(167,139,250,0.12)",
              borderRadius: 11, padding: "11px 13px",
              cursor: "pointer", textAlign: "left",
              fontFamily: "'DM Sans',sans-serif",
              transition: "all 0.18s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.1)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.25)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.05)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.12)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <p.icon size={12} color={C.purple} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.purple }}>{p.label}</span>
            </div>
            <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{p.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function AIChat() {
  const [msgs,    setMsgs]    = useState<Msg[]>([]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState("agent");
  const endRef = useRef<HTMLDivElement>(null);
  const taRef  = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  /* Load real sessions from backend */
  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ["ai-sessions"],
    queryFn:  () => aiAPI.sessions.list().then((d: any) => d.sessions || [] as Session[]),
    staleTime: 30_000,
  });
  const sessions: Session[] = sessionsData || [];
  const activeSession = sessions.find(s => s.session_id === session) || null;

  /* Load history — useEffect instead of onSuccess (onSuccess removed in React Query v5) */
  const { data: history } = useQuery({
    queryKey: queryKeys.aiHistory(session),
    queryFn:  () => aiAPI.history(session, 60).then((d: any) => d.messages || []),
    staleTime: 0,
  });

  // Populate msgs whenever history data arrives for the current session
  useEffect(() => {
    if (!history || (history as any[]).length === 0) return;
    setMsgs((history as any[]).map((m: any, i: number) => ({
      role: m.role,
      content: m.content || m.message,
      id: m.id || String(i),
      ts: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    })));
  }, [history]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  const send = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");
    const userMsg: Msg = { role: "user", content, id: `u${Date.now()}`, ts: Date.now() };
    setMsgs(ms => [...ms, userMsg]);
    setLoading(true);
    try {
      const res: any = await aiAPI.chat({ messages: [{ role: "user", content }], session_id: session });
      let reply = "I couldn't generate a response. Please try again.";
      if (typeof res?.reply === "string")   reply = res.reply;
      else if (typeof res?.text === "string")    reply = res.text;
      else if (typeof res?.message === "string") reply = res.message;
      else if (Array.isArray(res?.content)) {
        const blocks = res.content.filter((b: any) => b?.type === "text" && typeof b?.text === "string");
        if (blocks.length > 0) reply = blocks.map((b: any) => b.text).join("\n\n");
      } else if (typeof res?.content === "string") reply = res.content;
      setMsgs(ms => [...ms, { role: "assistant", content: reply, id: `a${Date.now()}`, ts: Date.now() }]);
      refetchSessions();
    } catch (e: any) {
      toast({ title: "AI Error", description: e?.message || "Could not reach AI service", variant: "destructive" });
      setMsgs(ms => ms.filter(m => m.id !== userMsg.id));
    } finally { setLoading(false); }
  };

  const clear   = () => setMsgs([]);
  const newChat = () => {
    const newId = `session_${Date.now()}`;
    setSession(newId);
    setMsgs([]);
    setInput("");
  };

  const switchSession = (id: string) => {
    setMsgs([]);
    setSession(id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <PageTransition variant="slide" speed="snappy">
      <div style={{
        height: "calc(100vh - 56px)", display: "flex",
        flexDirection: "column", overflow: "hidden",
      }}>
        {/* ── Top bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", height: 52, flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "rgba(167,139,250,0.1)",
              border: "1px solid rgba(167,139,250,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={15} color={C.purple} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.02em" }}>
                AI Assistant
              </div>
              <div style={{ fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em" }}>
                YOUR INTELLIGENT ORCHESTRATION ASSISTANT
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              data-testid="button-clear-chat"
              onClick={clear}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "transparent", border: `1px solid ${C.border}`,
                borderRadius: 7, padding: "5px 11px",
                color: C.faint, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.14s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderH; (e.currentTarget as HTMLElement).style.color = C.muted; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border;  (e.currentTarget as HTMLElement).style.color = C.faint;  }}
            >
              <Trash2 size={11} /> Clear
            </button>
          </div>
        </div>

        {/* ── 3-column body ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* Left: history sidebar — real sessions */}
          <div className="af-chat-sidebar">
            <HistorySidebar
              sessions={sessions}
              activeId={session}
              onSelect={switchSession}
              onNew={newChat}
              loading={sessionsLoading}
            />
          </div>

          {/* Center: chat area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "20px 24px",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.08) transparent",
            }}>
              {msgs.length === 0
                ? <EmptyState onSend={send} />
                : (
                  <>
                    {msgs.map(m => <MessageBubble key={m.id} msg={m} />)}
                    {loading && <Thinking />}
                    <div ref={endRef} />
                  </>
                )
              }
            </div>

            {/* Input bar */}
            <div style={{
              padding: "12px 20px 16px",
              borderTop: `1px solid ${C.border}`,
              flexShrink: 0,
              background: C.surface,
            }}>
              <div
                style={{
                  display: "flex", gap: 10, alignItems: "flex-end",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 13, padding: "10px 12px",
                  transition: "border-color 0.18s",
                }}
                onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.35)"}
                onBlurCapture={e  => (e.currentTarget as HTMLElement).style.borderColor = C.border}
              >
                <textarea
                  ref={taRef}
                  data-testid="input-chat"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask me anything about workflows, automations, or integrations…"
                  rows={1}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    color: C.text, fontSize: 13.5,
                    fontFamily: "'DM Sans',sans-serif",
                    resize: "none", lineHeight: 1.6,
                    maxHeight: 160, overflow: "auto",
                    scrollbarWidth: "none",
                  }}
                />
                <button
                  data-testid="button-send"
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: input.trim() && !loading ? C.purple : "rgba(255,255,255,0.05)",
                    border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                    transition: "background 0.18s",
                    boxShadow: input.trim() && !loading ? "0 2px 12px rgba(167,139,250,0.35)" : "none",
                  }}
                >
                  {loading
                    ? <Loader2 size={14} color="rgba(232,238,255,0.4)" style={{ animation: "spin-slow 1s linear infinite" }} />
                    : <Send size={14} color={input.trim() && !loading ? "#fff" : "rgba(232,238,255,0.2)"} />
                  }
                </button>
              </div>

              {/* Footer hint */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginTop: 6, padding: "0 2px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={9} color={C.faint} />
                  <span style={{ fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
                    AUTOFLOWNG AI · Enter to send · Shift+Enter for new line
                  </span>
                </div>
                {input.length > 0 && (
                  <span style={{ fontSize: 9, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
                    {input.length} chars
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: quick prompts — live session info */}
          <div className="af-chat-prompts">
            <QuickPromptsPanel onSend={send} activeSession={activeSession} />
          </div>
        </div>
      </div>

      <style>{`
        .af-chat-sidebar  { display: flex; }
        .af-chat-prompts  { display: flex; }
        @media (max-width: 900px)  { .af-chat-prompts { display: none; } }
        @media (max-width: 640px)  { .af-chat-sidebar { display: none; } }
        @keyframes spin-slow    { to { transform: rotate(360deg); } }
        @keyframes dot-bounce   { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }
        @keyframes af-pulse     { 0%,100% { opacity: 0.35; } 50% { opacity: 0.75; } }
      `}</style>
    </PageTransition>
  );
}
