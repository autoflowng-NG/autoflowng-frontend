/**
 * AutoFlowNG — Integration Hub (Enterprise Redesign)
 *
 * Visual redesign only — all logic, hooks, API calls, and imports
 * preserved exactly from the original.
 *
 * Design system:
 *   bg: #060810 | surface: #0C0F1A | raised: #111520
 *   border: rgba(255,255,255,0.06)
 *   text: #E2E8FF | muted: rgba(226,232,255,0.45) | faint: rgba(226,232,255,0.22)
 *   green: #00C896 | blue: #38BDF8 | purple: #A78BFA | amber: #FBBF24 | red: #FB7185
 *   Fonts: Syne (headers) · DM Sans (body) · DM Mono (labels/badges)
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, CheckCircle2, XCircle, AlertTriangle, Clock,
  ExternalLink, Trash2, RefreshCw, Settings, Shield,
  Activity, Zap, Plug, Layers, Info,
} from "lucide-react";
import { PlatformSVGIcon } from "../components/PlatformIcons";
import api, { tokenStore, connectionsAPI } from "../lib/api";
import { integrationsAPI, discordAPI } from "../lib/integrationsApi";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { queryKeys, invalidate } from "../lib/queryClient";

// ── Filter definitions ──────────────────────────────────────────────────────

type FilterKey =
  | "all" | "connected" | "not_connected" | "popular"
  | "ai" | "communication" | "social" | "crm"
  | "storage" | "productivity" | "finance" | "development" | "advertising";

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
  { key: "advertising",   label: "Advertising" },
];

const FILTER_CATEGORY: Partial<Record<FilterKey, string[]>> = {
  ai:            ["ai", "llm", "ml"],
  communication: ["messaging", "communication", "email"],
  social:        ["social", "social_media"],
  crm:           ["crm", "sales"],
  storage:       ["database", "storage", "cloud"],
  productivity:  ["productivity", "utility"],
  finance:       ["finance", "payments", "billing"],
  development:   ["developer", "devtools", "developer_tools"],
  advertising:   ["advertising"],
};

// ── Health status helpers ───────────────────────────────────────────────────

type HealthStatus = "healthy" | "warning" | "error" | "disconnected";

function getHealthStatus(healthScore?: number, connected?: boolean): HealthStatus {
  if (!connected) return "disconnected";
  if (healthScore === undefined || healthScore === null) return "healthy";
  if (healthScore >= 80) return "healthy";
  if (healthScore >= 40) return "warning";
  return "error";
}

const HEALTH_CONFIG: Record<HealthStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  healthy:      { label: "Healthy",      color: "#00C896", bg: "rgba(0,200,150,0.08)",   icon: CheckCircle2 },
  warning:      { label: "Warning",      color: "#FBBF24", bg: "rgba(251,191,36,0.08)",  icon: AlertTriangle },
  error:        { label: "Error",        color: "#FB7185", bg: "rgba(251,113,133,0.08)", icon: XCircle },
  disconnected: { label: "Disconnected", color: "rgba(226,232,255,0.22)", bg: "rgba(255,255,255,0.04)", icon: Clock },
};

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  popular:    { label: "POPULAR",    color: "#00C896" },
  enterprise: { label: "ENTERPRISE", color: "#A78BFA" },
  new:        { label: "NEW",        color: "#FBBF24" },
};

// ── Design tokens ───────────────────────────────────────────────────────────

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
  setupNote?: string;
  credentials?: { name: string; label: string; type: string }[];
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  connectedAt?: string;
  healthScore?: number;
  healthStatus: HealthStatus;
  healthLabel?: string;
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function Sk({ w = "100%", h = 13, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "rgba(255,255,255,0.05)",
      animation: "af-skeleton-pulse 1.8s ease-in-out infinite",
    }} />
  );
}

function SkCard() {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Sk w={44} h={44} r={10} />
        <Sk w={70} h={20} r={100} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Sk w="55%" h={16} />
        <Sk w="85%" h={12} />
        <Sk w="70%" h={12} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Sk w={60} h={22} r={6} />
        <Sk w={70} h={22} r={6} />
      </div>
      <div style={{ display: "flex", gap: 7 }}>
        <Sk w={90} h={34} r={8} />
        <Sk w={70} h={34} r={8} />
      </div>
    </div>
  );
}

// ── Stat pill ───────────────────────────────────────────────────────────────

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

// ── Filter tab ──────────────────────────────────────────────────────────────

function FilterChip({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px", borderRadius: 8,
        fontSize: 11, fontWeight: 700,
        fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em",
        cursor: "pointer", transition: "all 0.14s",
        border: active ? `1px solid ${C.amber}` : `1px solid ${C.border}`,
        background: active ? `${C.amber}10` : "rgba(255,255,255,0.02)",
        color: active ? C.amber : C.muted,
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.text; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.muted; }}
    >
      {label}
    </button>
  );
}

// ── Connect flow for a single integration ───────────────────────────────────

function useConnectFlow(integ: MergedIntegration, onDone: () => void) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Discord doesn't use OAuth2 (one shared bot token, not per-user tokens —
  // see platforms/discord.js / registry.js authType:'bearer_token') and it
  // has no credentials[] fields either, so it fell through to handleOAuth()
  // by default and hit the backend's "This integration does not use OAuth2"
  // guard every time. It needs its own two-step flow: open the bot invite
  // link, then collect the resulting Server (Guild) ID.
  const isDiscord = integ.id === "discord";

  // authType:'custom' with no credentials[] means the integration uses
  // inline config (connection strings, URLs) passed per-node in the workflow
  // builder — there is nothing to store here. Show the setupNote instead of
  // pretending to start an OAuth flow or presenting an empty credential form.
  const isCustomNoAuth = integ.authType === "custom" && !isDiscord && !(integ.credentials?.length);

  const hasCredFields = isDiscord || (integ.credentials?.length ?? 0) > 0;


  const handleOAuth = useCallback(() => {
    const token = tokenStore.get();
    if (!token) {
      toast({ title: "Please log in first", variant: "destructive" });
      return;
    }
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

  // Step 1 for Discord: fetch the invite URL and open it in a new tab so
  // the user can pick a server and approve the bot, then reveal the
  // Server ID field (handled by handleConnect below). discordAPI.inviteUrl()
  // resolves to the parsed JSON body directly (see lib/api.ts's request()
  // — it returns `data`, not an axios-style `{ data }` wrapper), so the
  // shape here is simply `{ url: string }`.
  //
  // BUGFIX: window.open() must run synchronously inside the click handler
  // to count as user-gesture-initiated — calling it only after an `await`
  // (i.e. after the invite-url fetch resolves) gets silently blocked as a
  // popup by Safari and many Chrome configurations. We open a blank tab
  // immediately, then navigate that already-open tab once we have the URL.
  const handleDiscordInvite = useCallback(async () => {
    const tab = window.open("", "_blank");
    setLoading(true);
    try {
      const res: any = await discordAPI.inviteUrl();
      if (!res?.url) throw new Error("No invite URL returned");
      if (tab) tab.location.href = res.url;
      else window.open(res.url, "_blank"); // fallback if even the blank tab got blocked
    } catch (e: any) {
      tab?.close();
      toast({
        title: "Couldn't get Discord invite link",
        description: e?.message || "Make sure DISCORD_CLIENT_ID is configured on the backend.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Step 2 for Discord: submit the Server ID the user pasted in after
  // adding the bot. Backend verifies the bot is actually in that guild
  // before saving anything (see POST /api/integrations/discord/connect).
  const handleDiscordConnect = useCallback(async () => {
    const guildId = (formData.guildId || "").trim();
    if (!guildId) {
      toast({ title: "Enter your Discord Server ID", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result: any = await discordAPI.connect(guildId);
      toast({ title: `Connected to ${result?.guildName || "Discord server"}!` });
      setShowForm(false);
      setFormData({});
      onDone();
    } catch (e: any) {
      toast({
        title: "Couldn't connect that server",
        description: e?.message || "Make sure you added the bot to this server first.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [formData, toast, onDone]);

  const handleCredConnect = useCallback(async () => {
    if (isDiscord) return handleDiscordConnect();
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
  }, [isDiscord, handleDiscordConnect, integ.id, integ.name, formData, toast, onDone]);

  const handleDisconnect = useCallback(async () => {
    setLoading(true);
    try {
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
    if (isDiscord) {
      setShowForm(true);
      handleDiscordInvite();
      return;
    }
    if (isCustomNoAuth) {
      // setupNote is shown inline — nothing to do on click
      return;
    }
    if (hasCredFields) {
      setShowForm(true);
    } else {
      handleOAuth();
    }
  }, [isDiscord, isCustomNoAuth, handleDiscordInvite, hasCredFields, handleOAuth]);

  // Discord's form field isn't driven by integ.credentials (it has none —
  // it's not a generic API-key integration), so IntegrationCard renders
  // this fixed single field instead when isDiscord is true.
  const discordFields = [{ name: "guildId", label: "Discord Server ID", type: "text" }];

  return {
    loading, showForm, formData, hasCredFields, isDiscord, isCustomNoAuth, discordFields,
    setShowForm, setFormData,
    handleConnect, handleOAuth, handleCredConnect, handleDisconnect, handleDiscordInvite,
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
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "9px 12px",
    color: C.text,
    fontSize: 13,
    fontFamily: "'DM Sans',sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  const borderColor = integ.connected ? "rgba(0,200,150,0.2)" : C.border;

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        padding: 20,
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
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${integ.iconColor}10`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = borderColor;
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${integ.iconColor}60, transparent)`,
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
              fontSize: 9, fontWeight: 700, color: C.green,
              background: "rgba(0,200,150,0.10)", border: "1px solid rgba(0,200,150,0.22)",
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
          color: C.text, marginBottom: 4,
        }}>
          {integ.name}
        </div>
        <div style={{
          fontSize: 12, color: C.muted, lineHeight: 1.55,
          fontFamily: "'DM Sans',sans-serif",
        }}>
          {integ.description}
        </div>
      </div>

      {/* Category + trigger/action counts */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {integ.category && (
          <span style={{
            fontSize: 10, color: C.faint,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "2px 7px", fontFamily: "'DM Mono',monospace",
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {integ.category}
          </span>
        )}
        {integ.triggers?.length > 0 && (
          <span style={{
            fontSize: 10, color: C.faint,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "2px 7px", fontFamily: "'DM Mono',monospace",
          }}>
            {integ.triggers.length} trigger{integ.triggers.length !== 1 ? "s" : ""}
          </span>
        )}
        {integ.actions?.length > 0 && (
          <span style={{
            fontSize: 10, color: C.faint,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${C.border}`,
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
            <div style={{
              fontSize: 11, color: C.muted, fontFamily: "'DM Sans',sans-serif",
            }}>
              <span style={{ color: C.faint }}>Account: </span>
              {integ.accountEmail}
            </div>
          )}
          {integ.connectedAt && (
            <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
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
          border: `1px solid ${health.color}30`,
          borderRadius: 8, padding: "6px 10px",
        }}>
          <HealthIcon size={12} color={health.color} />
          <span style={{
            fontSize: 11, color: health.color, fontWeight: 600,
            fontFamily: "'DM Mono',monospace",
          }}>
            {health.label}
          </span>
          {integ.healthScore !== undefined && (
            <span style={{ fontSize: 10, color: C.faint, marginLeft: "auto" }}>
              Score: {integ.healthScore}
            </span>
          )}
        </div>
      )}

      {/* Setup note — always visible for authType:'custom' integrations.
          These use inline connection strings per-node in the workflow builder;
          there is nothing to "connect" or store here. */}
      {flow.isCustomNoAuth && (
        <div style={{
          padding: "10px 13px",
          background: "rgba(56,189,248,0.05)",
          border: "1px solid rgba(56,189,248,0.13)",
          borderRadius: 10,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <Info size={13} color={C.blue} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{
            fontSize: 11, color: C.muted, lineHeight: 1.6,
            fontFamily: "'DM Sans',sans-serif",
          }}>
            {integ.setupNote || "No stored credential needed — configure this integration per-action inside the workflow builder."}
          </span>
        </div>
      )}

      {/* Credential input form */}
      {flow.showForm && flow.hasCredFields && (
        <div style={{
          padding: 12, background: "rgba(0,0,0,0.2)",
          border: `1px solid ${C.border}`, borderRadius: 10,
        }}>
          {flow.isDiscord && (
            <div style={{
              fontSize: 11, color: C.muted, lineHeight: 1.5,
              fontFamily: "'DM Sans',sans-serif", marginBottom: 10,
            }}>
              1. A tab opened so you can add the bot to your server — pick a
              server and approve it there.<br />
              {/* BUGFIX: the dropdown on Discord's invite screen is empty for
                  any account that doesn't already own/admin a server, which
                  reads as a broken connector rather than a missing
                  prerequisite. Spelling this out here means support doesn't
                  have to explain it case-by-case in chat. */}
              <span style={{ color: C.faint }}>
                Don't see your server in the dropdown, or it says "No items to
                show"? You need a server first — in the Discord app, tap{" "}
                <b>+</b> in the sidebar → <b>Create My Own</b>, give it any
                name, then come back and tap "Reopen invite link" below.
              </span>
              <br />
              2. Enable Developer Mode (Discord Settings → Advanced), then
              right-click your server icon → <b>Copy Server ID</b>, and paste
              it below.{" "}
              <button
                onClick={flow.handleDiscordInvite}
                disabled={flow.loading}
                style={{
                  background: "none", border: "none", padding: 0,
                  color: C.blue, cursor: "pointer", fontSize: 11,
                  textDecoration: "underline", fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Reopen invite link
              </button>
            </div>
          )}
          {(flow.isDiscord ? flow.discordFields : (integ.credentials || [])).map(f => (
            <div key={f.name} style={{ marginBottom: 10 }}>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 700,
                color: C.muted, fontFamily: "'DM Mono',monospace",
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
                color: C.red, fontSize: 12, fontWeight: 600,
                cursor: flow.loading ? "wait" : "pointer",
                fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.14s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(251,113,133,0.13)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(251,113,133,0.07)"}
            >
              <Trash2 size={11} />
              {flow.loading ? "Working…" : "Disconnect"}
            </button>
            <button
              onClick={() => navigate(`/integrations/${integ.id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(167,139,250,0.07)",
                border: "1px solid rgba(167,139,250,0.2)",
                borderRadius: 8, padding: "7px 12px",
                color: C.purple, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.14s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.13)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.07)"}
            >
              <Settings size={11} />
              Manage
            </button>
          </>
        ) : flow.isCustomNoAuth ? (
          /* No Connect button for inline-config integrations — only Details */
          <button
            onClick={() => navigate(`/integrations/${integ.id}`)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(167,139,250,0.07)",
              border: "1px solid rgba(167,139,250,0.2)",
              borderRadius: 8, padding: "7px 11px",
              color: C.purple, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              transition: "all 0.14s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.12)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.07)"}
          >
            Details
          </button>
        ) : flow.showForm ? (
          <>
            <button
              onClick={flow.handleCredConnect}
              disabled={flow.loading}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: C.green, border: "none",
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
                border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "7px 12px",
                color: C.muted, fontSize: 12,
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
                background: C.green,
                border: "none",
                borderRadius: 8, padding: "7px 14px",
                color: "#04060F", fontSize: 12, fontWeight: 700,
                cursor: flow.loading ? "wait" : "pointer",
                fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.14s",
              }}
            >
              <ExternalLink size={11} />
              Connect
            </button>
            <button
              onClick={() => navigate(`/integrations/${integ.id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(167,139,250,0.07)",
                border: "1px solid rgba(167,139,250,0.2)",
                borderRadius: 8, padding: "7px 11px",
                color: C.purple, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.14s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.12)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.07)"}
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
        display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24,
      }}>
        <StatPill icon={Layers} value={connected.length} label="CONNECTED" color={C.blue} />
        {healthy > 0 && <StatPill icon={CheckCircle2} value={healthy} label="HEALTHY" color={C.green} />}
        {warning > 0 && <StatPill icon={AlertTriangle} value={warning} label="WARNING" color={C.amber} />}
        {error   > 0 && <StatPill icon={XCircle}       value={error}   label="ERROR"   color={C.red}   />}
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

    const connMap: Record<string, any> = {};
    for (const c of conns) {
      const key = (c.platform || c.id || "").toLowerCase();
      connMap[key] = c;
    }

    const healthMap: Record<string, any> = {};
    for (const h of oauthCreds) {
      healthMap[(h.platform || "").toLowerCase()] = h;
    }

    return catalog.map((integ: any) => {
      const key     = (integ.id || "").toLowerCase();
      const conn    = connMap[key];
      const health  = healthMap[key];

      const connected    = !!conn?.connected;
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
        setupNote:    integ.setupNote,
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

    if (filter === "connected")     list = list.filter(i => i.connected);
    if (filter === "not_connected") list = list.filter(i => !i.connected);
    if (filter === "popular")       list = list.filter(i => i.tier === "popular");

    const cats = FILTER_CATEGORY[filter];
    if (cats) {
      list = list.filter(i => {
        const cat = (i.category || "").toLowerCase();
        return cats.some(c => cat.includes(c));
      });
    }

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
      <div style={{ padding: "32px", maxWidth: 1400, margin: "0 auto", background: C.bg, minHeight: "100%" }}>

        {/* ── Page header ── */}
        <Reveal>
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            marginBottom: 28, gap: 16, flexWrap: "wrap",
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.amber,
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", marginBottom: 8,
              }}>
                PLATFORM
              </div>
              <h1 style={{
                fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900,
                fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em",
                color: C.text, margin: 0, lineHeight: 1,
              }}>
                Integration Hub
              </h1>
              <p style={{
                fontSize: 13, color: C.muted, marginTop: 8,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                {catalogData?.total || merged.length} integrations available · {totalConnected} connected
              </p>
            </div>

            <button
              onClick={handleRefresh}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "9px 16px",
                color: C.muted, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.14s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = C.text;
                (e.currentTarget as HTMLElement).style.borderColor = C.borderH;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = C.muted;
                (e.currentTarget as HTMLElement).style.borderColor = C.border;
              }}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </Reveal>

        {/* ── Stat pills (health summary) ── */}
        <HealthSummaryBar integrations={merged} />

        {/* ── Search + filter chips ── */}
        <Reveal delay={40}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: 20, marginBottom: 24,
            position: "relative", overflow: "hidden",
          }}>
            {/* Card top accent */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 1,
              background: `linear-gradient(90deg, transparent, ${C.amber}50, transparent)`,
            }} />

            {/* Search bar */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search size={14} style={{
                position: "absolute", left: 13, top: "50%",
                transform: "translateY(-50%)", color: C.muted,
                pointerEvents: "none",
              }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search integrations by name, category, or capability…"
                style={{
                  width: "100%", paddingLeft: 38, paddingRight: 14,
                  paddingTop: 11, paddingBottom: 11,
                  background: C.raised,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 13,
                  fontFamily: "'DM Sans',sans-serif", outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = C.amber + "60"}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = C.border}
              />
            </div>

            {/* Filter chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FILTERS.map(f => (
                <FilterChip
                  key={f.key}
                  label={f.label}
                  active={filter === f.key}
                  onClick={() => setFilter(f.key)}
                />
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── Results count ── */}
        {!catalogLoading && (
          <div style={{
            fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace",
            letterSpacing: "0.06em", marginBottom: 16,
          }}>
            SHOWING {filtered.length} INTEGRATION{filtered.length !== 1 ? "S" : ""}
          </div>
        )}

        {/* ── Grid ── */}
        {catalogLoading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
            gap: 16,
          }}>
            {Array.from({ length: 12 }).map((_, i) => <SkCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 0",
            color: C.faint,
          }}>
            <Plug size={40} style={{ marginBottom: 14, opacity: 0.3 }} />
            <div style={{
              fontSize: 16, fontFamily: "'Syne',sans-serif",
              fontWeight: 700, color: C.muted, marginBottom: 6,
            }}>
              No integrations match
            </div>
            <div style={{ fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
              Try adjusting your filter or search term
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

        <style>{`
          @keyframes af-skeleton-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    </PageTransition>
  );
}
