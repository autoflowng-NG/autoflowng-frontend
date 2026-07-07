/**
 * CriticalAlertToaster — Phase 3
 * Refactored to consume shared WebSocketContext.
 * No longer spawns its own WebSocket connection.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { useAuth } from "../contexts/AuthContext";
import {
  XCircle, AlertTriangle, CheckCircle2, Zap,
  GitBranch, X, ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";

type AlertSeverity = "critical" | "warning" | "success";

interface CriticalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  eventType: string;
  action?: { label: string; path: string };
  ts: number;
}

const AUTO_DISMISS_MS = 7000;
const MAX_ALERTS      = 4;

const SEVERITY_THEME: Record<AlertSeverity, {
  color: string; bg: string; border: string; glow: string; icon: any;
}> = {
  critical: {
    color: "#FB7185", bg: "rgba(251,113,133,0.07)",
    border: "rgba(251,113,133,0.22)", glow: "rgba(251,113,133,0.15)", icon: XCircle,
  },
  warning: {
    color: "#FBBF24", bg: "rgba(251,191,36,0.07)",
    border: "rgba(251,191,36,0.2)", glow: "rgba(251,191,36,0.12)", icon: AlertTriangle,
  },
  success: {
    color: "#00C896", bg: "rgba(0,200,150,0.07)",
    border: "rgba(0,200,150,0.2)", glow: "rgba(0,200,150,0.12)", icon: CheckCircle2,
  },
};

function toAlert(raw: any): CriticalAlert | null {
  const ev     = (raw.event || raw.type || "").toLowerCase();
  const status = (raw.status || raw.result || "").toLowerCase();

  const skipped = ["ping", "pong", "authenticated", "auth", "connected", "reauth_confirmed"];
  if (skipped.includes(ev)) return null;

  let severity: AlertSeverity | null = null;
  let title = "", detail = "", eventType = "generic";
  let action: CriticalAlert["action"] | undefined;

  // Phase 10D: operational_alert events broadcast by the alert scheduler / writeAlert()
  // Payload shape: { event:"operational_alert", alertType, severity, title, message, alertId, createdAt }
  if (ev === "operational_alert") {
    const rawSev = (raw.severity || "warning").toLowerCase();
    severity  = rawSev === "critical" ? "critical" : rawSev === "warning" ? "warning" : null;
    if (!severity) return null;
    eventType = "operational";
    title  = raw.title   || "Platform Alert";
    detail = raw.message || raw.detail || raw.alertType || "";
    action = { label: "View alerts", path: "/financial-integrity" };
  } else if ((ev.includes("workflow") || ev.includes("run")) &&
      (status.includes("fail") || status.includes("error") || raw.error)) {
    severity = "critical"; eventType = "workflow";
    const name = raw.workflow_name || raw.name || "Workflow";
    title  = `${name} failed`;
    detail = raw.error || (raw.duration ? `After ${raw.duration}ms` : "Run did not complete");
    action = { label: "View workflows", path: "/workflows" };
  } else if (ev.includes("automation") &&
      (status.includes("fail") || status.includes("error") || raw.error)) {
    severity = "critical"; eventType = "automation";
    const name = raw.name || raw.automation_name || "Automation";
    title  = `${name} failed`;
    detail = raw.error || "Trigger did not execute";
    action = { label: "View automations", path: "/automations" };
  } else if (ev === "step_log" && status === "error") {
    // FIX C: step_log errors from reply/comment nodes — surface the real message
    severity  = "critical"; eventType = "workflow";
    title     = raw.stepType ? `${raw.stepType} failed` : "Step failed";
    detail    = raw.msg || raw.message || "An error occurred in a workflow step";
    action    = { label: "View workflows", path: "/workflows" };
  } else if (ev.includes("error") || status.includes("error")) {
    severity = "critical"; eventType = "error";
    title  = raw.message || "An error occurred";
    detail = raw.detail  || raw.description || "";
  } else if (ev.includes("connection") &&
      (status.includes("fail") || ev.includes("lost") || ev.includes("disconnect"))) {
    severity = "warning"; eventType = "connection";
    title  = "Connection lost";
    detail = "Attempting to reconnect…";
  }

  if (!severity) return null;

  return {
    id:        raw.id || raw.run_id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    severity, title, detail, eventType, action,
    ts:        raw.ts || raw.timestamp || Date.now(),
  };
}

function ProgressBar({ color, duration }: { color: string; duration: number }) {
  return (
    <motion.div
      initial={{ scaleX: 1 }}
      animate={{ scaleX: 0 }}
      transition={{ duration: duration / 1000, ease: "linear" }}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: color, transformOrigin: "left center",
        opacity: 0.5, borderRadius: "0 0 14px 14px",
      }}
    />
  );
}

function AlertCard({ alert, onDismiss }: { alert: CriticalAlert; onDismiss: (id: string) => void }) {
  const [, nav] = useLocation();
  const theme   = SEVERITY_THEME[alert.severity];
  const Icon    = theme.icon;
  const TypeIcon = alert.eventType === "workflow" ? GitBranch
                 : alert.eventType === "automation" ? Zap : null;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(alert.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [alert.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0,  scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.88, transition: { duration: 0.22, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      data-testid={`critical-alert-${alert.id}`}
      style={{
        position: "relative", width: 340,
        background: `linear-gradient(135deg, ${theme.bg}, rgba(4,6,15,0.95))`,
        border: `1px solid ${theme.border}`, borderRadius: 14,
        padding: "14px 16px 18px",
        boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${theme.border}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        backdropFilter: "blur(20px)", overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${theme.glow}, transparent)`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `${theme.color}12`, border: `1px solid ${theme.color}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginTop: 1,
        }}>
          <Icon size={15} color={theme.color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            {TypeIcon && <TypeIcon size={11} color={theme.color} style={{ opacity: 0.7 }} />}
            <span style={{
              fontSize: 10, fontWeight: 800, color: theme.color,
              fontFamily: "'DM Mono',monospace", letterSpacing: "0.07em", opacity: 0.85,
            }}>
              {alert.severity === "critical" ? "CRITICAL" : alert.severity === "warning" ? "WARNING" : "NOTICE"}
            </span>
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "#E8EEFF",
            fontFamily: "'Syne',sans-serif", lineHeight: 1.3,
            marginBottom: alert.detail ? 3 : 0,
          }}>
            {alert.title}
          </div>
          {alert.detail && (
            <div style={{
              fontSize: 11, color: "rgba(232,238,255,0.45)",
              fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {alert.detail}
            </div>
          )}
        </div>

        <button
          onClick={() => onDismiss(alert.id)}
          data-testid={`alert-dismiss-${alert.id}`}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(232,238,255,0.3)", padding: 4, borderRadius: 6,
            display: "flex", alignItems: "center", flexShrink: 0, transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(232,238,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(232,238,255,0.3)")}
        >
          <X size={13} />
        </button>
      </div>

      {alert.action && (
        <button
          onClick={() => { onDismiss(alert.id); nav(alert.action!.path); }}
          data-testid={`alert-action-${alert.id}`}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            marginTop: 10, marginLeft: 42,
            background: `${theme.color}12`, border: `1px solid ${theme.color}25`,
            borderRadius: 7, padding: "5px 10px",
            color: theme.color, fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = `${theme.color}22`)}
          onMouseLeave={e => (e.currentTarget.style.background = `${theme.color}12`)}
        >
          {alert.action.label}
          <ChevronRight size={10} />
        </button>
      )}

      <ProgressBar color={theme.color} duration={AUTO_DISMISS_MS} />
    </motion.div>
  );
}

export function CriticalAlertToaster() {
  const { isAuthenticated } = useAuth();
  /* Phase 3: consume shared context — no new WS connection */
  const { subscribe } = useWebSocketContext();
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const seenIds             = useRef(new Set<string>());

  const dismiss = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const push = useCallback((raw: any) => {
    const alert = toAlert(raw);
    if (!alert) return;
    if (seenIds.current.has(alert.id)) return;
    seenIds.current.add(alert.id);
    if (seenIds.current.size > MAX_ALERTS * 4) {
      const arr = [...seenIds.current];
      seenIds.current = new Set(arr.slice(arr.length - MAX_ALERTS));
    }
    setAlerts(prev => [alert, ...prev].slice(0, MAX_ALERTS));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = subscribe("*", push);
    return unsub;
  }, [subscribe, push, isAuthenticated]);

  return (
    <div
      data-testid="critical-alert-toaster"
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 10,
        pointerEvents: alerts.length === 0 ? "none" : "auto",
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {alerts.map(alert => (
          <AlertCard key={alert.id} alert={alert} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
