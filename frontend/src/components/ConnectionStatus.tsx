/**
 * ConnectionStatus — Phase 3
 * Consumes from shared WebSocketContext. No new WS connection created.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWebSocketContext, type WSStatus, type WSQuality } from "../contexts/WebSocketContext";
import { useAuth } from "../contexts/AuthContext";
import { Wifi, WifiOff, RefreshCw, AlertCircle, Radio } from "lucide-react";

const VISIBLE: Partial<Record<WSStatus, true>> = {
  reconnecting: true,
  disconnected: true,
  offline:      true,
  error:        true,
};

const STATUS_CONFIG: Record<string, {
  icon: any; color: string; bg: string; border: string; label: (q: WSQuality) => string;
}> = {
  reconnecting: {
    icon:   RefreshCw,
    color:  "#FBBF24",
    bg:     "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.22)",
    label:  (q) => q.reconnectIn > 0
      ? `Reconnecting in ${q.reconnectIn}s… (attempt ${q.attempts})`
      : `Reconnecting…`,
  },
  disconnected: {
    icon:   WifiOff,
    color:  "#94A3B8",
    bg:     "rgba(148,163,184,0.06)",
    border: "rgba(148,163,184,0.18)",
    label:  () => "Connection lost. Attempting to restore…",
  },
  offline: {
    icon:   WifiOff,
    color:  "#FB7185",
    bg:     "rgba(251,113,133,0.08)",
    border: "rgba(251,113,133,0.22)",
    label:  () => "No internet connection",
  },
  error: {
    icon:   AlertCircle,
    color:  "#FB7185",
    bg:     "rgba(251,113,133,0.08)",
    border: "rgba(251,113,133,0.22)",
    label:  () => "WebSocket error — retrying…",
  },
};

function LatencyBadge({ ms }: { ms: number | null }) {
  if (ms === null) return null;
  const color = ms < 100 ? "#00C896" : ms < 300 ? "#FBBF24" : "#FB7185";
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, fontFamily: "'DM Mono',monospace",
      color, background: `${color}12`, border: `1px solid ${color}25`,
      borderRadius: 100, padding: "1px 6px",
    }}>
      {ms}ms
    </span>
  );
}

export function ConnectionStatus() {
  const { isAuthenticated } = useAuth();
  const { status, quality, forceReconnect } = useWebSocketContext();

  const [showRestored, setShowRestored] = useState(false);
  const [prevStatus]  = useState(status);

  useEffect(() => {
    if (status === "authenticated" && prevStatus !== "authenticated") {
      setShowRestored(true);
      const t = setTimeout(() => setShowRestored(false), 2500);
      return () => clearTimeout(t);
    }
  }, [status, prevStatus]);

  const cfg     = STATUS_CONFIG[status];
  const visible = !!VISIBLE[status] || showRestored;

  if (!isAuthenticated) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="conn-bar"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -48,  opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          style={{
            position:       "fixed",
            top: 0, left: 0, right: 0,
            zIndex:         1000,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            10,
            padding:        "8px 20px",
            background:     showRestored
              ? "rgba(0,200,150,0.09)"
              : (cfg?.bg ?? "rgba(0,0,0,0.5)"),
            borderBottom: `1px solid ${showRestored ? "rgba(0,200,150,0.22)" : (cfg?.border ?? "transparent")}`,
            backdropFilter: "blur(16px)",
          }}
        >
          {showRestored ? (
            <>
              <Radio size={12} color="#00C896" />
              <span style={{
                fontSize: 12, fontWeight: 700, color: "#00C896",
                fontFamily: "'DM Sans',sans-serif",
              }}>
                Orchestration restored
              </span>
              <LatencyBadge ms={quality.latencyMs} />
            </>
          ) : cfg ? (
            <>
              <cfg.icon
                size={12}
                color={cfg.color}
                style={status === "reconnecting" ? { animation: "spin-slow 1.2s linear infinite" } : undefined}
              />
              <span style={{
                fontSize: 12, fontWeight: 600, color: cfg.color,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                {cfg.label(quality)}
              </span>
              {(status === "reconnecting" || status === "disconnected") && (
                <button
                  onClick={forceReconnect}
                  style={{
                    fontSize: 10, fontWeight: 700, color: cfg.color,
                    background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`,
                    borderRadius: 100, padding: "2px 8px", cursor: "pointer",
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  Reconnect now
                </button>
              )}
            </>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function WSStatusDot({ status, quality }: { status: WSStatus; quality: WSQuality }) {
  const color =
    status === "authenticated" ? "#00C896" :
    status === "connecting" || status === "reconnecting" ? "#FBBF24" :
    status === "offline" ? "#FB7185" : "#94A3B8";

  const pulsing = status === "authenticated" || status === "connecting" || status === "reconnecting";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0,
        animation: pulsing ? "glw 2s ease infinite" : "none",
      }} />
      <span style={{ fontSize: 10, fontWeight: 600, color, fontFamily: "'DM Mono',monospace" }}>
        {status === "authenticated"
          ? quality.latencyMs !== null ? `${quality.latencyMs}ms` : "online"
          : status === "reconnecting"
          ? quality.reconnectIn > 0 ? `retry ${quality.reconnectIn}s` : "retrying…"
          : status === "connecting" ? "connecting…"
          : status === "offline" ? "offline"
          : "offline"}
      </span>
    </div>
  );
}
