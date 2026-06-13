/**
 * AutoFlowNG — Trial Countdown Banner (Update-001)
 *
 * Displays at the top of every dashboard page for trial users.
 * - Shows days/hours remaining
 * - Turns orange when < 24h remain
 * - Turns red when expired
 * - Disappears once the user subscribes (plan != 'trial')
 *
 * Usage:
 *   <TrialCountdownBanner />   // place inside page layout, after auth
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { Clock, AlertTriangle, X } from "lucide-react";
import { useState } from "react";

function msToDisplay(ms: number): { days: number; hours: number; minutes: number } {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  return { days, hours, minutes };
}

export function TrialCountdownBanner() {
  const { t } = useTranslation();
  const { user } = useAuth() as any;
  const [dismissed, setDismissed] = useState(false);

  const trialInfo = useMemo(() => {
    if (!user) return null;
    if (user.plan !== 'trial') return null;
    if (!user.trial_ends_at) return null;

    const endsAt = new Date(user.trial_ends_at).getTime();
    const now = Date.now();
    const remaining = endsAt - now;
    const expired = remaining <= 0;
    const urgentHours = remaining <= 24 * 60 * 60 * 1000;
    const display = msToDisplay(remaining);

    return { remaining, expired, urgentHours, display, endsAt };
  }, [user]);

  if (!trialInfo) return null;
  if (dismissed && !trialInfo.expired) return null;

  const { expired, urgentHours, display } = trialInfo;

  const bannerColor = expired
    ? "#ef4444"
    : urgentHours
    ? "#f97316"
    : "#00C896";

  const bannerBg = expired
    ? "rgba(239,68,68,0.1)"
    : urgentHours
    ? "rgba(249,115,22,0.1)"
    : "rgba(0,200,150,0.08)";

  const bannerBorder = expired
    ? "rgba(239,68,68,0.25)"
    : urgentHours
    ? "rgba(249,115,22,0.25)"
    : "rgba(0,200,150,0.2)";

  const Icon = expired || urgentHours ? AlertTriangle : Clock;

  function buildMessage() {
    if (expired) return t('trial.banner_expired');
    if (display.days > 0) {
      return t('trial.banner_days', { days: display.days });
    }
    return t('trial.banner_hours', { hours: display.hours });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: bannerBg,
        border: `1px solid ${bannerBorder}`,
        borderRadius: 10,
        padding: "10px 16px",
        marginBottom: 20,
        color: bannerColor,
        fontSize: 13,
        fontFamily: "'DM Sans',sans-serif",
        position: "relative",
      }}
      role="alert"
    >
      <Icon size={15} style={{ flexShrink: 0 }} />

      <span style={{ flex: 1, fontWeight: 500 }}>
        {buildMessage()}
      </span>

      <a
        href="/plans"
        style={{
          background: bannerColor,
          color: expired ? "#fff" : "#04060F",
          border: "none",
          borderRadius: 6,
          padding: "5px 12px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'DM Mono',monospace",
          textDecoration: "none",
          whiteSpace: "nowrap",
          letterSpacing: "0.03em",
        }}
      >
        {t('trial.banner_cta')}
      </a>

      {!expired && (
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: bannerColor,
            padding: 2,
            display: "flex",
            alignItems: "center",
            opacity: 0.6,
          }}
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/**
 * UpgradeModal
 *
 * Full-screen overlay shown when the trial has expired and the user
 * attempts to use a locked feature.
 */
export function UpgradeModal({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4,6,15,0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 24,
      }}
    >
      <div
        className="af-glass"
        style={{
          borderRadius: 20,
          padding: "40px 36px",
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          border: "1px solid rgba(239,68,68,0.2)",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
        <h2 style={{
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "'Syne',sans-serif",
          color: "#E8EEFF",
          marginBottom: 10,
        }}>
          {t('billing.trial_ended')}
        </h2>
        <p style={{
          fontSize: 14,
          color: "rgba(232,238,255,0.5)",
          marginBottom: 28,
          lineHeight: 1.6,
        }}>
          {t('billing.upgrade_to_continue')}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 10,
                padding: "11px",
                color: "rgba(232,238,255,0.5)",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {t('common.close')}
            </button>
          )}
          <a
            href="/plans"
            style={{
              flex: 2,
              background: "#00C896",
              border: "none",
              borderRadius: 10,
              padding: "11px",
              color: "#04060F",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {t('plans.start_trial')}
          </a>
        </div>
      </div>
    </div>
  );
}
