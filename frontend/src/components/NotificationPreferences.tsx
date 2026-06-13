/**
 * NotificationPreferences — Phase 8
 *
 * Settings panel for per-user notification preferences.
 * Manages email alerts, Slack webhook, severity thresholds.
 * Calls GET/PUT /api/alerts/preferences.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bell, Mail, Hash, ToggleLeft, ToggleRight,
  Check, RefreshCw, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

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

interface NotifPrefs {
  email_alerts:       boolean;
  email_severity_min: "info" | "warning" | "critical";
  slack_alerts:       boolean;
  slack_webhook_url:  string | null;
  email_invitations:  boolean;
  email_role_changes: boolean;
  email_digests:      boolean;
  // Phase 9A
  marketing_emails:   boolean;
  product_updates:    boolean;
  security_emails:    boolean;
  digest_daily:       boolean;
  digest_weekly:      boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  info:     "#38BDF8",
  warning:  "#FBBF24",
  critical: "#FB7185",
};

function ToggleRow({
  label, description, value, onChange, disabled = false,
}: {
  label: string; description?: string; value: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif" }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Sans',sans-serif", marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        style={{ background: "none", border: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 }}
      >
        {value
          ? <ToggleRight size={22} color="#00C896" />
          : <ToggleLeft  size={22} color="#94A3B8" />}
      </button>
    </div>
  );
}

export function NotificationPreferences() {
  const { token } = useAuth();
  const [prefs,   setPrefs]   = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const tok = token();

  useEffect(() => {
    if (!tok) return;
    apiFetch("/alerts/preferences", tok)
      .then(d => setPrefs(d.preferences))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tok]);

  const update = (patch: Partial<NotifPrefs>) =>
    setPrefs(prev => prev ? { ...prev, ...patch } : null);

  const handleSave = async () => {
    if (!tok || !prefs) return;
    setSaving(true); setError(null);
    try {
      await apiFetch("/alerts/preferences", tok, { method: "PUT", body: JSON.stringify(prefs) });
      // Sync digest jobs
      if ("digest_daily" in prefs || "digest_weekly" in prefs) {
        await apiFetch("/alerts/digest", tok, {
          method: "PUT",
          body: JSON.stringify({ daily: prefs.digest_daily, weekly: prefs.digest_weekly }),
        }).catch(() => {}); // non-blocking
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 16 }}>
      <RefreshCw size={14} color="#A78BFA" style={{ animation: "spin-slow 1s linear infinite" }} />
      <span style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Sans',sans-serif" }}>
        Loading preferences…
      </span>
    </div>
  );

  if (!prefs) return null;

  return (
    <div className="af-glass" style={{
      borderRadius: 16, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Bell size={15} color="#A78BFA" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>
          Notification Preferences
        </span>
      </div>

      <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Email alerts section */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
          }}>
            <Mail size={12} color="#38BDF8" />
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#38BDF8",
              fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              Email Alerts
            </span>
          </div>

          <ToggleRow
            label="Alert emails"
            description="Receive email when alert rules fire"
            value={prefs.email_alerts}
            onChange={v => update({ email_alerts: v })}
          />

          {prefs.email_alerts && (
            <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif", marginBottom: 8 }}>
                Minimum severity for email
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["info", "warning", "critical"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => update({ email_severity_min: s })}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: "4px 12px",
                      borderRadius: 7, cursor: "pointer",
                      fontFamily: "'DM Mono',monospace",
                      border: `1px solid ${prefs.email_severity_min === s ? SEVERITY_COLOR[s] : "rgba(255,255,255,0.1)"}`,
                      background: prefs.email_severity_min === s ? `${SEVERITY_COLOR[s]}15` : "transparent",
                      color: prefs.email_severity_min === s ? SEVERITY_COLOR[s] : "rgba(232,238,255,0.35)",
                      transition: "all 0.15s",
                    }}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ToggleRow
            label="Invitation emails"
            description="Receive email when invited to a workspace"
            value={prefs.email_invitations}
            onChange={v => update({ email_invitations: v })}
          />
          <ToggleRow
            label="Role change emails"
            description="Receive email when your role changes"
            value={prefs.email_role_changes}
            onChange={v => update({ email_role_changes: v })}
          />
        </div>

        {/* Product & Marketing section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#00C896",
              fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              Communication
            </span>
          </div>
          <ToggleRow
            label="Product updates"
            description="Feature announcements and platform improvements"
            value={prefs.product_updates ?? true}
            onChange={v => update({ product_updates: v })}
          />
          <ToggleRow
            label="Marketing emails"
            description="Tips, webinars, and promotional content"
            value={prefs.marketing_emails ?? false}
            onChange={v => update({ marketing_emails: v })}
          />
          <ToggleRow
            label="Security alerts"
            description="Account security events (cannot be disabled)"
            value={true}
            onChange={() => {}}
            disabled={true}
          />
        </div>

        {/* Digest section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#FBBF24",
              fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              Digests
            </span>
          </div>
          <ToggleRow
            label="Daily digest"
            description="Yesterday's workflow activity summary at 08:00 UTC"
            value={prefs.digest_daily ?? false}
            onChange={v => update({ digest_daily: v })}
          />
          <ToggleRow
            label="Weekly digest"
            description="Last week's orchestration summary every Monday"
            value={prefs.digest_weekly ?? false}
            onChange={v => update({ digest_weekly: v })}
          />
        </div>

        {/* Slack section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Hash size={12} color="#A78BFA" />
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#A78BFA",
              fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              Slack
            </span>
          </div>

          <ToggleRow
            label="Slack alerts"
            description="Send critical alerts to a Slack channel"
            value={prefs.slack_alerts}
            onChange={v => update({ slack_alerts: v })}
          />

          {prefs.slack_alerts && (
            <div style={{ paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>
                SLACK WEBHOOK URL
              </div>
              <input
                type="url"
                value={prefs.slack_webhook_url || ""}
                onChange={e => update({ slack_webhook_url: e.target.value || null })}
                placeholder="https://hooks.slack.com/services/..."
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 9, padding: "9px 12px",
                  color: "#E8EEFF", fontSize: 12, outline: "none",
                  fontFamily: "'DM Mono',monospace",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(167,139,250,0.35)")}
                onBlur={e  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
              />
              {prefs.slack_webhook_url && !prefs.slack_webhook_url.startsWith("https://hooks.slack.com/") && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                  <AlertTriangle size={10} color="#FBBF24" />
                  <span style={{ fontSize: 10, color: "#FBBF24", fontFamily: "'DM Mono',monospace" }}>
                    Must be a valid Slack incoming webhook URL
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px",
            background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)",
            borderRadius: 8, fontSize: 12, color: "#FB7185",
            fontFamily: "'DM Sans',sans-serif",
          }}>
            <AlertTriangle size={12} />
            {error}
          </div>
        )}

        {/* Save */}
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: saved ? "#00C896" : "#A78BFA",
            border: "none", borderRadius: 10, padding: "11px 0",
            color: "#04060F", fontSize: 13, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans',sans-serif",
            opacity: saving ? 0.6 : 1,
            transition: "background 0.2s",
          }}
        >
          {saving ? (
            <><RefreshCw size={13} style={{ animation: "spin-slow 1s linear infinite" }} /> Saving…</>
          ) : saved ? (
            <><Check size={13} /> Saved</>
          ) : (
            "Save Preferences"
          )}
        </motion.button>
      </div>
    </div>
  );
}
