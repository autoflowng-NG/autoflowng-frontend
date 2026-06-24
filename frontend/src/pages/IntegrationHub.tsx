/**
 * AutoFlowNG — Integration Hub
 *
 * Consolidates Marketplace + Connections + Integration Health into a single
 * enterprise-grade destination. Reuses all existing backend APIs:
 *   GET /api/integrations          — catalog (provider metadata, triggers, actions)
 *   GET /api/connections           — user's active connections
 *   GET /api/integrations/oauth/health — per-platform OAuth health scores
 *
 * Navigation: replaces both /marketplace and /connections in the sidebar.
 * Route stays at /connections for backwards compatibility.
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, CheckCircle2, XCircle, AlertTriangle, Clock,
  ExternalLink, Trash2, RefreshCw, Settings, Shield,
  Activity, Zap, Plug,
} from "lucide-react";
import { PlatformSVGIcon } from "../components/PlatformIcons";
import api, { tokenStore, connectionsAPI } from "../lib/api";
import { integrationsAPI } from "../lib/integrationsApi";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { queryKeys, invalidate } from "../lib/queryClient";

// ── Filter definitions ──────────────────────────────────────────────────────

type FilterKey =
  | "all" | "connected" | "not_connected" | "popular"
  | "ai" | "communication" | "social" | "crm"
  | "storage" | "productivity" | "finance" | "development";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",           label: "All" },
  { key: "connected",     label: "Connected" },
  { key: "not_connected", label: "Not Connected" },
  { key: "popular",       label: "Popular" },
  { key: "ai",            label: "AI" },
  { key: "communication", label: "Communication" },
  { key: "social",        label: "Social" },
  { key: "crm",           label: "CRM" },
  { key: "storage",       label: "Storage" },
  { key: "productivity",  label: "Productivity" },
  { key: "finance",       label: "Finance" },
  { key: "development",   label: "Development" },
];

// Maps filter keys to backend category values and tier values
const FILTER_CATEGORY: Partial<Record<FilterKey, string[]>> = {
  ai:            ["ai", "llm", "ml"],
  communication: ["messaging", "communication", "email"],
  social:        ["social", "social_media"],
  crm:           ["crm", "sales"],
  storage:       ["database", "storage", "cloud"],
  productivity:  ["productivity", "utility"],
  finance:       ["finance", "payments", "billing"],
  development:   ["developer", "devtools", "developer_tools"],
};

// ── Health status helpers ───────────────────────────────────────────────────

type HealthStatus = "healthy" | "warning" | "error" | "disconnected";

function getHealthStatus(healthScore?: number, connected?: boolean): HealthStatus {
  if (!connected) return "disconnected";
  if (healthScore === undefined || healthScore === null) return "healthy";
  if (healthScore >= 80) return "healthy";
  if (healthScore >= 50) return "warning";
  return "error";
}

const HEALTH_CONFIG: Record<HealthStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  healthy:      { label: "Healthy",      color: "#00C896", bg: "rgba(0,200,150,0.1)",   icon: CheckCircle2 },
  warning:      { label: "Warning",      color: "#FBBF24", bg: "rgba(251,191,36,0.1)",  icon: AlertTriangle },
  error:        { label: "Error",        color: "#FB7185", bg: "rgba(251,113,133,0.1)", icon: XCircle },
  disconnected: { label: "Disconnected", color: "#6B7280", bg: "rgba(107,114,128,0.1)", icon: Clock },
};

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  popular:    { label: "POPULAR",    color: "#00C896" },
  enterprise: { label: "ENTERPRISE", color: "#A78BFA" },
  new:        { label: "NEW",        color: "#FBBF24" },
};

// ── Merged integration type ─────────────────────────────────────────────────

interface MergedIntegration {
  id: string;
  name: string;
  description: string;
  category: string;
  iconColor: string;
  tier?: string;
  triggers: unknown[];
  actions: unknown[];
  authType?: string;
  credentials?: { name: string; label: string; type: string }[];
  // connection state
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  connectedAt?: string;
  // health
  healthScore?: number;
  healthStatus: HealthStatus;
  healthLabel?: string;
}

// ── Connect flow for a single integration ──────────────────────────────────

function useConnectFlow(integ: MergedIntegration, onDone: () => void) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const hasCredFields = (integ.credentials?.length ?? 0) > 0;

  const handleOAuth = useCallback(() => {
    const token = tokenStore.get();
    if (!token) {
      toast({ title: "Please log in first", variant: "destructive" });
      return;
    }
    // Use integrationsAPI.oauthStart URL pattern
    const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
    const url = `${baseUrl}/api/integrations/${integ.id}/oauth/start?token=${encodeURIComponent(token)}`;
    const popup = window.open(url, "_blank", "width=600,height=700");
    if (popup) {
      const poll = setInterval(() => {
        if (popup.closed) {
          clearInterval(poll);
          setTimeout(onDone, 600);
        }
      }, 500);
    }
  }, [integ.id, toast, onDone]);

  const handleCredConnect = useCallback(async () => {
    setLoading(true);
    try {
      await integrationsAPI.connect(integ.id, formData);
      toast({ title: `${integ.name} connected!` });
      setShowForm(false);
      setFormData({});
      onDone();
    } catch (e: any) {
      toast({ title: "Connection failed", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [integ.id, integ.name, formData, toast, onDone]);

  const handleDisconnect = useCallback(async () => {
    setLoading(true);
    try {
      // Try integrations API first, fall back to connections API
      try {
        await integrationsAPI.disconnect(integ.id);
      } catch {
        await connectionsAPI.disconnect(integ.id);
      }
      toast({ title: `${integ.name} disconnected` });
      onDone();
    } catch (e: any) {
      toast({ title: "Disconnect failed", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [integ.id, integ.name, toast, onDone]);

  const handleConnect = useCallback(() => {
    if (hasCredFields) {
      setShowForm(true);
    } else {
      handleOAuth();
    }
  }, [hasCredFields, handleOAuth]);

  return {
    loading, showForm, formData, hasCredFields,
    setShowForm, setFormData,
    handleConnect, handleOAuth, handleCredConnect, handleDisconnect,
  };
}

// ── Integration Card ────────────────────────────────────────────────────────

function IntegrationCard({
  integ,
  onRefresh,
}: {
  integ: MergedIntegration;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const health = HEALTH_CONFIG[integ.healthStatus];
  const HealthIcon = health.icon;
  const tier = integ.tier ? TIER_BADGE[integ.tier] : null;

  const flow = useConnectFlow(integ, onRefresh);

  const inp: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "#E8EEFF",
    fontSize: 13,
    fontFamily: "'DM Sans',sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  const borderColor = integ.connected
    ? `rgba(0,200,150,0.22)`
    : "rgba(255,255,255,0.07)";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "border-color 0.2s, transform 0.15s, box-shadow 0.2s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = integ.iconColor + "44";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${integ.iconColor}12`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = borderColor;
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Top color bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${integ.iconColor}88, transparent)`,
      }} />

      {/* Logo + badges row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: integ.iconColor + "1A",
          border: `1px solid ${integ.iconColor}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <PlatformSVGIcon id={integ.id} size={24} />
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
          {integ.connected && (
            <span style={{
              display: "flex", alignItems: "center", gap: 3,
              fontSize: 9, fontWeight: 700, color: "#00C896",
              background: "rgba(0,200,150,0.12)", border: "1px solid rgba(0,200,150,0.25)",
              borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace",
            }}>
              <CheckCircle2 size={8} /> CONNECTED
            </span>
          )}
          {tier && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: tier.color,
              background: tier.color + "18", border: `1px solid ${tier.color}33`,
              borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace",
            }}>
              {tier.label}
            </span>
          )}
        </div>
      </div>

      {/* Name + description */}
      <div>
        <div style={{
          fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif",
          color: "#E8EEFF", marginBottom: 4,
        }}>
          {integ.name}
        </div>
        <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", lineHeight: 1.55 }}>
          {integ.description}
        </div>
      </div>

      {/* Category + trigger/action counts */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {integ.category && (
          <span style={{
            fontSize: 10, color: "rgba(232,238,255,0.35)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 6, padding: "2px 7px", fontFamily: "'DM Mono',monospace",
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {integ.category}
          </span>
        )}
        {integ.triggers?.length > 0 && (
          <span style={{
            fontSize: 10, color: "rgba(232,238,255,0.35)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 6, padding: "2px 7px", fontFamily: "'DM Mono',monospace",
          }}>
            {integ.triggers.length} trigger{integ.triggers.length !== 1 ? "s" : ""}
          </span>
        )}
        {integ.actions?.length > 0 && (
          <span style={{
            fontSize: 10, color: "rgba(232,238,255,0.35)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 6, padding: "2px 7px", fontFamily: "'DM Mono',monospace",
          }}>
            {integ.actions.length} action{integ.actions.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Connection metadata (if connected) */}
      {integ.connected && (integ.accountEmail || integ.connectedAt) && (
        <div style={{
          background: "rgba(0,200,150,0.05)",
          border: "1px solid rgba(0,200,150,0.12)",
          borderRadius: 8, padding: "8px 10px",
          display: "flex", flexDirection: "column", gap: 3,
        }}>
          {integ.accountEmail && (
            <div style={{ fontSize: 11, color: "rgba(232,238,255,0.55)", fontFamily: "'DM Sans',sans-serif" }}>
              <span style={{ color: "rgba(232,238,255,0.3)" }}>Account: </span>
              {integ.accountEmail}
            </div>
          )}
          {integ.connectedAt && (
            <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
              Connected {new Date(integ.connectedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Health indicator (if connected) */}
      {integ.connected && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: health.bg,
          border: `1px solid ${health.color}33`,
          borderRadius: 8, padding: "6px 10px",
        }}>
          <HealthIcon size={12} color={health.color} />
          <span style={{ fontSize: 11, color: health.color, fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>
            {health.label}
          </span>
          {integ.healthScore !== undefined && (
            <span style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", marginLeft: "auto" }}>
              Score: {integ.healthScore}
            </span>
          )}
        </div>
      )}

      {/* Credential input form (shown when connecting with API key) */}
      {flow.showForm && flow.hasCredFields && (
        <div style={{ padding: "12px", background: "rgba(0,0,0,0.25)", borderRadius: 10 }}>
          {(integ.credentials || []).map(f => (
            <div key={f.name} style={{ marginBottom: 10 }}>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 700,
                color: "rgba(232,238,255,0.45)", fontFamily: "'DM Mono',monospace",
                letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase",
              }}>
                {f.label}
              </label>
              <input
                type={f.type}
                value={flow.formData[f.name] || ""}
                onChange={e => flow.setFormData(d => ({ ...d, [f.name]: e.target.value }))}
                placeholder={f.label}
                style={inp}
              />
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 7, marginTop: "auto", flexWrap: "wrap" }}>
        {integ.connected ? (
          <>
            <button
              onClick={flow.handleDisconnect}
              disabled={flow.loading}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(251,113,133,0.07)",
                border: "1px solid rgba(251,113,133,0.22)",
                borderRadius: 8, padding: "7px 12px",
                color: "#FB7185", fontSize: 12, fontWeight: 600,
                cursor: flow.loading ? "wait" : "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <Trash2 size={11} />
              {flow.loading ? "Working…" : "Disconnect"}
            </button>
            <button
              onClick={() => navigate(`/integrations/${integ.id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "7px 12px",
                color: "rgba(232,238,255,0.6)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <Settings size={11} />
              Manage
            </button>
          </>
        ) : flow.showForm ? (
          <>
            <button
              onClick={flow.handleCredConnect}
              disabled={flow.loading}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "#00C896", border: "none",
                borderRadius: 8, padding: "7px 14px",
                color: "#04060F", fontSize: 12, fontWeight: 700,
                cursor: flow.loading ? "wait" : "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {flow.loading ? "Connecting…" : "Save & Connect"}
            </button>
            <button
              onClick={() => flow.setShowForm(false)}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "7px 12px",
                color: "rgba(232,238,255,0.4)", fontSize: 12,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={flow.handleConnect}
              disabled={flow.loading}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(0,200,150,0.08)",
                border: "1px solid rgba(0,200,150,0.22)",
                borderRadius: 8, padding: "7px 12px",
                color: "#00C896", fontSize: 12, fontWeight: 700,
                cursor: flow.loading ? "wait" : "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <ExternalLink size={11} />
              Connect
            </button>
            <button
              onClick={() => navigate(`/integrations/${integ.id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "7px 11px",
                color: "rgba(232,238,255,0.4)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Details
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Health Summary Bar ──────────────────────────────────────────────────────

function HealthSummaryBar({ integrations }: { integrations: MergedIntegration[] }) {
  const connected = integrations.filter(i => i.connected);
  const healthy   = connected.filter(i => i.healthStatus === "healthy").length;
  const warning   = connected.filter(i => i.healthStatus === "warning").length;
  const error     = connected.filter(i => i.healthStatus === "error").length;

  if (connected.length === 0) return null;

  return (
    <Reveal>
      <div style={{
        display: "flex", gap: 12, padding: "12px 16px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, marginBottom: 24,
        flexWrap: "wrap", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={13} color="#6B7280" />
          <span style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace" }}>
            {connected.length} CONNECTED
          </span>
        </div>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.07)" }} />
        {healthy > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={11} color="#00C896" />
            <span style={{ fontSize: 11, color: "#00C896", fontFamily: "'DM Mono',monospace" }}>{healthy} Healthy</span>
          </div>
        )}
        {warning > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={11} color="#FBBF24" />
            <span style={{ fontSize: 11, color: "#FBBF24", fontFamily: "'DM Mono',monospace" }}>{warning} Warning</span>
          </div>
        )}
        {error > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <XCircle size={11} color="#FB7185" />
            <span style={{ fontSize: 11, color: "#FB7185", fontFamily: "'DM Mono',monospace" }}>{error} Error</span>
          </div>
        )}
      </div>
    </Reveal>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function IntegrationHub() {
  const [query,  setQuery]  = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ["integrations", "catalog"],
    queryFn:  () => (api as any).get("/integrations"),
    staleTime: 5 * 60_000,
  });

  const { data: connsData, refetch: refetchConns } = useQuery({
    queryKey: queryKeys.connections,
    queryFn:  () => connectionsAPI.list().then((d: any) => {
      const result = d?.connections ?? d?.platforms ?? d;
      return Array.isArray(result) ? result : [];
    }),
  });

  // BUGFIX: this used a raw fetch() with credentials:"include" (cookie-based),
  // but this app's requireAuth middleware (middleware/index.js) only checks
  // req.headers.authorization for a Bearer token — it never reads cookies.
  // The catalog query two lines up correctly uses the `api` helper, which
  // attaches the JWT as an Authorization header (see lib/api.ts). The raw
  // fetch() here sent no auth at all, so this endpoint 401'd on every single
  // load — silently, since the .catch() swallows it and falls back to an
  // empty list. Health scores/badges on every card were therefore always
  // absent in practice, never erroring loudly enough to notice.
  const { data: healthData } = useQuery({
    queryKey: ["integrations", "oauth-health"],
    queryFn:  () => (api as any).get("/integrations/oauth/health")
      .catch(() => ({ credentials: [] })),
    staleTime: 2 * 60_000,
    retry: false,
  });

  // ── Merge catalog + connections + health ───────────────────────────────────

  const merged: MergedIntegration[] = useMemo(() => {
    const catalog: any[] = catalogData?.integrations || [];
    const conns:   any[] = Array.isArray(connsData) ? connsData : [];
    const oauthCreds: any[] = healthData?.credentials || [];

    // Index connection data by platform id
    const connMap: Record<string, any> = {};
    for (const c of conns) {
      const key = (c.platform || c.id || "").toLowerCase();
      connMap[key] = c;
    }

    // Index OAuth health by platform
    const healthMap: Record<string, any> = {};
    for (const h of oauthCreds) {
      healthMap[(h.platform || "").toLowerCase()] = h;
    }

    return catalog.map((integ: any) => {
      const key     = (integ.id || "").toLowerCase();
      const conn    = connMap[key];
      const health  = healthMap[key];

      const connected    = !!(conn?.connected || conn);
      const healthScore  = health?.healthScore as number | undefined;
      const healthStatus = getHealthStatus(healthScore, connected);

      return {
        id:           integ.id,
        name:         integ.name,
        description:  integ.description,
        category:     integ.category || "",
        iconColor:    integ.iconColor || "#00C896",
        tier:         integ.tier,
        triggers:     integ.triggers || [],
        actions:      integ.actions  || [],
        authType:     integ.authType,
        credentials:  integ.credentials,
        connected,
        accountEmail: conn?.platform_email || conn?.email,
        accountName:  conn?.platform_name  || conn?.name,
        connectedAt:  conn?.connected_at   || conn?.connectedAt,
        healthScore,
        healthStatus,
        healthLabel:  health?.healthStatus,
      } satisfies MergedIntegration;
    });
  }, [catalogData, connsData, healthData]);

  // ── Filtering + search ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = merged;

    // Status-based filters
    if (filter === "connected")     list = list.filter(i => i.connected);
    if (filter === "not_connected") list = list.filter(i => !i.connected);
    if (filter === "popular")       list = list.filter(i => i.tier === "popular");

    // Category-based filters
    const cats = FILTER_CATEGORY[filter];
    if (cats) {
      list = list.filter(i => {
        const cat = (i.category || "").toLowerCase();
        return cats.some(c => cat.includes(c));
      });
    }

    // Full-text search: name, description, category, tier (capabilities)
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.tier || "").toLowerCase().includes(q) ||
        (i.accountEmail || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [merged, filter, query]);

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.connections });
    qc.invalidateQueries({ queryKey: ["integrations", "catalog"] });
    qc.invalidateQueries({ queryKey: ["integrations", "oauth-health"] });
    refetchConns();
  }, [qc, refetchConns]);

  const totalConnected = merged.filter(i => i.connected).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Header */}
        <Reveal>
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            marginBottom: 32, gap: 16, flexWrap: "wrap",
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#FBBF24",
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6,
              }}>
                INTEGRATIONS
              </div>
              <h1 style={{
                fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900,
                fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em",
                color: "#E8EEFF", margin: 0,
              }}>
                Integration Hub
              </h1>
              <p style={{ fontSize: 13, color: "rgba(232,238,255,0.4)", marginTop: 6 }}>
                {catalogData?.total || merged.length} integrations · {totalConnected} connected
              </p>
            </div>
            <button
              onClick={handleRefresh}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 10, padding: "9px 14px",
                color: "rgba(232,238,255,0.5)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </Reveal>

        {/* Health summary bar */}
        <HealthSummaryBar integrations={merged} />

        {/* Search + filters */}
        <Reveal delay={40}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {/* Search bar */}
            <div style={{ position: "relative", maxWidth: 480 }}>
              <Search size={14} style={{
                position: "absolute", left: 12, top: "50%",
                transform: "translateY(-50%)", color: "rgba(232,238,255,0.3)",
              }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, description, category, or capability…"
                style={{
                  width: "100%", paddingLeft: 36, paddingRight: 12,
                  paddingTop: 10, paddingBottom: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 10, color: "#E8EEFF", fontSize: 13,
                  fontFamily: "'DM Sans',sans-serif", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Filter chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FILTERS.map(f => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    style={{
                      padding: "7px 13px", borderRadius: 8,
                      fontSize: 11, fontWeight: 700,
                      fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em",
                      cursor: "pointer", transition: "all 0.15s",
                      border: active
                        ? "1px solid #00C896"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: active
                        ? "rgba(0,200,150,0.1)"
                        : "rgba(255,255,255,0.02)",
                      color: active ? "#00C896" : "rgba(232,238,255,0.45)",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Grid */}
        {catalogLoading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
            gap: 16,
          }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                height: 240, borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                animation: "pulse 1.5s infinite",
              }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(232,238,255,0.25)" }}>
            <Plug size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontFamily: "'Syne',sans-serif" }}>
              No integrations match your search
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Try a different filter or search term
            </div>
          </div>
        ) : (
          <Stagger>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
              gap: 16,
            }}>
              {filtered.map(integ => (
                <StaggerItem key={integ.id}>
                  <IntegrationCard integ={integ} onRefresh={handleRefresh} />
                </StaggerItem>
              ))}
            </div>
          </Stagger>
        )}
      </div>
    </PageTransition>
  );
}
