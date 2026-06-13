/**
 * EnterpriseOpsCenter — Phase 6
 *
 * Components for enterprise orchestration operations:
 *   - WorkspaceSwitcher      — org selector for AppShell header
 *   - AlertRulesPanel        — CRUD UI for alert rule management
 *   - OrgHealthSummary       — org-wide aggregated health card
 *   - AuditLogViewer         — paginated audit trail display
 *   - ExecutionShareButton   — share token generation per execution
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, ChevronDown, Plus, Users,
  Bell, ShieldCheck, Link2, Copy,
  Check, Trash2, ToggleLeft, ToggleRight,
  Activity, AlertTriangle, Clock, LogOut,
} from "lucide-react";
import { useOrg, type Org, type OrgRole } from "../contexts/OrgContext";
import { useWorkspaceSwitch } from "../hooks/useOrgWorkflows";
import { useAuth } from "../contexts/AuthContext";
import { HEALTH_TIER_COLOR } from "../contexts/ExecutionHistoryContext";

const API_BASE = (import.meta.env?.VITE_API_URL || "https://autoflowng-backend-production-dfa9.up.railway.app")
  .replace(/\/$/, "");

async function apiFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...((opts.headers as any) ?? {}) },
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `${res.status}`); }
  return res.json();
}

/* ══════════════════════════════════════════════════════════════════════
   WorkspaceSwitcher — org selector for AppShell
   ══════════════════════════════════════════════════════════════════════ */
export function WorkspaceSwitcher() {
  const { orgs, activeOrg, createOrg } = useOrg();
  const switchWorkspace = useWorkspaceSwitch();
  const [open,    setOpen]    = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState("");

  const ROLE_BADGE_COLOR: Record<OrgRole, string> = {
    owner: "#A78BFA", admin: "#38BDF8", operator: "#00C896", viewer: "#94A3B8",
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const org = await createOrg(newName.trim());
      switchWorkspace(org);
      setNewName(""); setOpen(false);
    } catch (e: any) { alert(e.message); }
    finally { setCreating(false); }
  };

  if (orgs.length === 0 && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: 9, padding: "6px 12px", cursor: "pointer",
          color: "#A78BFA", fontSize: 11, fontWeight: 700,
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        <Plus size={12} /> Create workspace
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 10, padding: "6px 12px", cursor: "pointer",
          color: "#E8EEFF", fontSize: 12, fontWeight: 600,
          fontFamily: "'DM Sans',sans-serif", maxWidth: 200,
        }}
      >
        <Building2 size={13} color={activeOrg ? "#A78BFA" : "#94A3B8"} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {activeOrg?.name ?? "Personal"}
        </span>
        <ChevronDown size={11} color="rgba(232,238,255,0.35)" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 299 }}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 300,
                background: "rgba(6,9,20,0.98)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14, padding: 8, minWidth: 220,
                backdropFilter: "blur(20px)",
                boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
              }}
            >
              {/* Personal workspace option */}
              <button
                onClick={() => { switchWorkspace(null); setOpen(false); }}
                style={{
                  width: "100%", background: !activeOrg ? "rgba(255,255,255,0.06)" : "none",
                  border: "none", borderRadius: 8, padding: "8px 10px",
                  display: "flex", alignItems: "center", gap: 8,
                  cursor: "pointer", marginBottom: 2,
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: "rgba(148,163,184,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Users size={13} color="#94A3B8" />
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif" }}>
                    Personal
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
                    private workspace
                  </div>
                </div>
              </button>

              {orgs.length > 0 && (
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
              )}

              {orgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => { switchWorkspace(org); setOpen(false); }}
                  style={{
                    width: "100%",
                    background: activeOrg?.id === org.id ? "rgba(167,139,250,0.08)" : "none",
                    border: activeOrg?.id === org.id ? "1px solid rgba(167,139,250,0.15)" : "1px solid transparent",
                    borderRadius: 8, padding: "8px 10px",
                    display: "flex", alignItems: "center", gap: 8,
                    cursor: "pointer", marginBottom: 2,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: "rgba(167,139,250,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#A78BFA" }}>
                      {org.name.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: "#E8EEFF",
                      fontFamily: "'DM Sans',sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {org.name}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
                      {org.member_count} member{org.member_count !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 8, fontWeight: 800, padding: "1px 5px",
                    borderRadius: 100, fontFamily: "'DM Mono',monospace",
                    color: ROLE_BADGE_COLOR[org.role],
                    background: `${ROLE_BADGE_COLOR[org.role]}15`,
                    border: `1px solid ${ROLE_BADGE_COLOR[org.role]}25`,
                  }}>
                    {org.role.toUpperCase()}
                  </span>
                </button>
              ))}

              {/* Create new org */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />
              <div style={{ padding: "4px 6px" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCreate()}
                    placeholder="New workspace name…"
                    style={{
                      flex: 1, background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 7, padding: "6px 10px",
                      color: "#E8EEFF", fontSize: 11, outline: "none",
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  />
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    style={{
                      background: "#A78BFA", border: "none", borderRadius: 7,
                      padding: "6px 10px", cursor: "pointer",
                      color: "#04060F", fontSize: 11, fontWeight: 700,
                      opacity: creating || !newName.trim() ? 0.5 : 1,
                    }}
                  >
                    {creating ? "…" : <Plus size={12} />}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   AlertRulesPanel — manage alert rules per workflow
   ══════════════════════════════════════════════════════════════════════ */
interface AlertRule {
  id: number; name: string; metric: string; operator: string;
  threshold: number; severity: string; enabled: boolean;
  workflow_name?: string; last_fired_at?: string;
}

export function AlertRulesPanel({ workflowId, workflowName }: { workflowId: string; workflowName?: string }) {
  const { token } = useAuth();
  const [rules,    setRules]    = useState<AlertRule[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", metric: "failure_rate", operator: ">", threshold: "50", severity: "warning" });

  const tok = token();

  useEffect(() => {
    if (!tok) return;
    setLoading(true);
    apiFetch(`/alerts/rules`, tok)
      .then(d => setRules((d.rules || []).filter((r: AlertRule) => !workflowId || r.workflow_id === parseInt(workflowId))))
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, [tok, workflowId]);

  const handleCreate = async () => {
    if (!tok || !form.name.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/alerts/rules", tok, {
        method: "POST",
        body: JSON.stringify({ workflow_id: parseInt(workflowId), ...form, threshold: parseFloat(form.threshold) }),
      });
      const d = await apiFetch("/alerts/rules", tok);
      setRules((d.rules || []).filter((r: AlertRule) => !workflowId || r.workflow_id === parseInt(workflowId)));
      setForm({ name: "", metric: "failure_rate", operator: ">", threshold: "50", severity: "warning" });
    } catch (e: any) { alert(e.message); }
    finally { setCreating(false); }
  };

  const toggleRule = async (id: number, enabled: boolean) => {
    if (!tok) return;
    await apiFetch(`/alerts/rules/${id}`, tok, { method: "PATCH", body: JSON.stringify({ enabled: !enabled }) });
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = async (id: number) => {
    if (!tok) return;
    await apiFetch(`/alerts/rules/${id}`, tok, { method: "DELETE" });
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const SEVERITY_COLOR: Record<string, string> = { info: "#38BDF8", warning: "#FBBF24", critical: "#FB7185" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)",
        fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", textTransform: "uppercase",
      }}>
        Alert Rules{workflowName ? ` · ${workflowName}` : ""}
      </div>

      {/* Existing rules */}
      {rules.map(rule => {
        const color = SEVERITY_COLOR[rule.severity] ?? "#94A3B8";
        return (
          <motion.div key={rule.id} layout style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px",
            background: `${color}06`, border: `1px solid ${color}18`, borderRadius: 10,
            opacity: rule.enabled ? 1 : 0.5,
          }}>
            <Bell size={11} color={color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif" }}>
                {rule.name}
              </div>
              <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
                {rule.metric} {rule.operator} {rule.threshold} · {rule.severity}
              </div>
            </div>
            <button onClick={() => toggleRule(rule.id, rule.enabled)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              {rule.enabled
                ? <ToggleRight size={16} color={color} />
                : <ToggleLeft  size={16} color="#94A3B8" />}
            </button>
            <button onClick={() => deleteRule(rule.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(232,238,255,0.25)" }}>
              <Trash2 size={11} />
            </button>
          </motion.div>
        );
      })}

      {/* Create form */}
      <div style={{
        padding: "12px", background: "rgba(255,255,255,0.02)",
        border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 10,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <input
          value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
          placeholder="Rule name…"
          style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 7, padding: "7px 10px", color: "#E8EEFF", fontSize: 11, outline: "none",
            fontFamily: "'DM Sans',sans-serif",
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <select value={form.metric} onChange={e => setForm(v => ({ ...v, metric: e.target.value }))}
            style={{ flex: 1, background: "#0b0f1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "6px 8px", color: "#E8EEFF", fontSize: 11, outline: "none" }}>
            <option value="failure_rate">Failure rate (%)</option>
            <option value="duration_ms">Median duration (ms)</option>
            <option value="health_score">Health score</option>
            <option value="consecutive_failures">Consecutive failures</option>
          </select>
          <select value={form.operator} onChange={e => setForm(v => ({ ...v, operator: e.target.value }))}
            style={{ width: 56, background: "#0b0f1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "6px 8px", color: "#E8EEFF", fontSize: 11, outline: "none" }}>
            {[">",">=","<","<=","="].map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <input type="number" value={form.threshold} onChange={e => setForm(v => ({ ...v, threshold: e.target.value }))}
            style={{ width: 72, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "6px 8px", color: "#E8EEFF", fontSize: 11, outline: "none", textAlign: "center" }} />
          <select value={form.severity} onChange={e => setForm(v => ({ ...v, severity: e.target.value }))}
            style={{ width: 88, background: "#0b0f1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "6px 8px", color: "#E8EEFF", fontSize: 11, outline: "none" }}>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate} disabled={creating || !form.name.trim()} style={{
          background: "#00C896", border: "none", borderRadius: 8, padding: "8px 0",
          color: "#04060F", fontSize: 12, fontWeight: 700, cursor: "pointer",
          opacity: creating || !form.name.trim() ? 0.5 : 1, fontFamily: "'DM Sans',sans-serif",
        }}>
          {creating ? "Creating…" : "+ Add Alert Rule"}
        </motion.button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ExecutionShareButton — share token + clipboard
   ══════════════════════════════════════════════════════════════════════ */
export function ExecutionShareButton({ runId }: { runId: string }) {
  const { token } = useAuth();
  const [state, setState] = useState<"idle"|"loading"|"copied">("idle");
  const [url,   setUrl]   = useState<string | null>(null);

  const handleShare = async () => {
    const tok = token();
    if (!tok) return;
    setState("loading");
    try {
      const data = await apiFetch(`/executions/${runId}/share`, tok, { method: "POST" });
      setUrl(data.share_url);
      await navigator.clipboard?.writeText(data.share_url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch (e: any) { alert(e.message); setState("idle"); }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={handleShare}
      disabled={state === "loading"}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: state === "copied" ? "rgba(0,200,150,0.1)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${state === "copied" ? "rgba(0,200,150,0.3)" : "rgba(255,255,255,0.09)"}`,
        borderRadius: 9, padding: "7px 12px",
        color: state === "copied" ? "#00C896" : "rgba(232,238,255,0.5)",
        fontSize: 11, fontWeight: 700, cursor: "pointer",
        fontFamily: "'DM Sans',sans-serif",
        transition: "all 0.2s",
      }}
    >
      {state === "copied" ? <Check size={11} /> : state === "loading" ? null : <Link2 size={11} />}
      {state === "copied" ? "Link copied!" : state === "loading" ? "Generating…" : "Share"}
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   OrgHealthSummary — aggregated org health from dashboard/health
   ══════════════════════════════════════════════════════════════════════ */
export function OrgHealthSummary() {
  const { token } = useAuth();
  const { activeOrg } = useOrg();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const tok = token();
    if (!tok) return;
    apiFetch("/dashboard/health", tok).then(d => setStats(d.stats)).catch(() => setStats(null));
  }, [token]);

  if (!stats) return null;

  const successRate = stats.total_runs_30d > 0
    ? Math.round((stats.successful_runs_30d / stats.total_runs_30d) * 100)
    : 100;
  const color = successRate >= 90 ? "#00C896" : successRate >= 70 ? "#FBBF24" : "#FB7185";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8,
    }}>
      {[
        { label: "30d runs",  value: stats.total_runs_30d,     color: "#94A3B8" },
        { label: "success",   value: `${successRate}%`,         color },
        { label: "last hour", value: stats.runs_last_hour,      color: "#A78BFA" },
      ].map(({ label, value, color: c }) => (
        <div key={label} style={{
          padding: "8px 10px", background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, textAlign: "center",
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: c, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ fontSize: 9, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", marginTop: 3, textTransform: "uppercase" }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
