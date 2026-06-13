/**
 * RuntimeObservabilityPanel — Phase 3
 *
 * Cinematic orchestration observability widget.
 * Visualises WebSocket health, latency distribution, event rate,
 * and runtime responsiveness without any fake/simulated data.
 *
 * All metrics sourced exclusively from WebSocketContext.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocketContext, type WSQuality, type WSStatus } from "../contexts/WebSocketContext";
import {
  Activity, Wifi, WifiOff, Radio, BarChart2,
  ChevronDown, ChevronUp, Zap,
} from "lucide-react";

/* ── Helpers ─────────────────────────────────────────────────────────── */
function latencyColor(ms: number | null): string {
  if (ms === null) return "#94A3B8";
  if (ms < 80)  return "#00C896";
  if (ms < 200) return "#FBBF24";
  return "#FB7185";
}

function statusLabel(s: WSStatus): string {
  const map: Record<WSStatus, string> = {
    idle:          "IDLE",
    connecting:    "CONNECTING",
    authenticated: "LIVE",
    reconnecting:  "RECONNECTING",
    disconnected:  "DISCONNECTED",
    offline:       "OFFLINE",
    error:         "ERROR",
  };
  return map[s] ?? s.toUpperCase();
}

function statusColor(s: WSStatus): string {
  if (s === "authenticated") return "#00C896";
  if (s === "connecting" || s === "reconnecting") return "#FBBF24";
  if (s === "offline" || s === "error") return "#FB7185";
  return "#94A3B8";
}

/* ── Latency sparkline (last 20 readings stored in ref) ──────────────── */
function LatencySparkline({ readings }: { readings: number[] }) {
  if (readings.length < 2) {
    return (
      <div style={{ fontSize: 10, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Mono',monospace" }}>
        awaiting data…
      </div>
    );
  }
  const max  = Math.max(...readings, 1);
  const w    = 120;
  const h    = 28;
  const step = w / (readings.length - 1);

  const points = readings
    .map((v, i) => `${i * step},${h - (v / max) * h * 0.9}`)
    .join(" ");

  const lastColor = latencyColor(readings[readings.length - 1]);

  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lastColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lastColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <polygon
        points={`0,${h} ${points} ${(readings.length - 1) * step},${h}`}
        fill="url(#spark-grad)"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={lastColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Latest dot */}
      <circle
        cx={(readings.length - 1) * step}
        cy={h - (readings[readings.length - 1] / max) * h * 0.9}
        r="2.5"
        fill={lastColor}
      />
    </svg>
  );
}

/* ── Histogram bars ──────────────────────────────────────────────────── */
function LatencyHistogram({ buckets }: { buckets: [number, number, number, number] }) {
  const labels = ["<50ms", "50–150", "150–300", ">300ms"];
  const colors = ["#00C896", "#FBBF24", "#FB7185", "#FB7185"];
  const total  = buckets.reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 32 }}>
      {buckets.map((v, i) => {
        const pct = (v / total) * 100;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <motion.div
              animate={{ height: Math.max(pct * 0.28, 2) }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
              style={{
                width:        20,
                background:   `${colors[i]}`,
                borderRadius: "2px 2px 0 0",
                opacity:      v === 0 ? 0.15 : 0.75,
              }}
            />
            <span style={{
              fontSize: 8, color: "rgba(232,238,255,0.3)",
              fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap",
            }}>
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Event rate pill ─────────────────────────────────────────────────── */
function EventRatePill({ epm }: { epm: number }) {
  const color = epm > 20 ? "#A78BFA" : epm > 5 ? "#38BDF8" : "#94A3B8";
  return (
    <motion.div
      animate={{ scale: epm > 0 ? [1, 1.06, 1] : 1 }}
      transition={{ duration: 0.4 }}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          4,
        background:   `${color}12`,
        border:       `1px solid ${color}30`,
        borderRadius: 100,
        padding:      "2px 8px",
      }}
    >
      <Zap size={9} color={color} />
      <span style={{
        fontSize: 10, fontWeight: 800, color,
        fontFamily: "'DM Mono',monospace",
      }}>
        {epm} evt/min
      </span>
    </motion.div>
  );
}

/* ── Main panel ──────────────────────────────────────────────────────── */
export function RuntimeObservabilityPanel({ className }: { className?: string }) {
  const { status, quality } = useWebSocketContext();
  const [expanded, setExpanded] = useState(false);
  const latencyReadings = useRef<number[]>([]);

  /* Accumulate latency readings for sparkline */
  useEffect(() => {
    if (quality.latencyMs !== null) {
      latencyReadings.current = [
        ...latencyReadings.current,
        quality.latencyMs,
      ].slice(-20);
    }
  }, [quality.latencyMs]);

  const color = statusColor(status);

  return (
    <div
      className={className}
      style={{
        background:   "rgba(8,11,22,0.85)",
        border:       `1px solid rgba(255,255,255,0.07)`,
        borderRadius: 14,
        overflow:     "hidden",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* ── Collapsed header ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width:       "100%",
          background:  "none",
          border:      "none",
          cursor:      "pointer",
          padding:     "10px 14px",
          display:     "flex",
          alignItems:  "center",
          gap:         10,
        }}
      >
        {/* Status dot */}
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: color, flexShrink: 0,
          boxShadow: status === "authenticated" ? `0 0 8px ${color}` : "none",
          animation: status === "authenticated" ? "glw 2s ease infinite" : "none",
        }} />

        <span style={{
          fontSize: 11, fontWeight: 700, color,
          fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", flex: 1,
          textAlign: "left",
        }}>
          {statusLabel(status)}
        </span>

        {quality.latencyMs !== null && (
          <span style={{
            fontSize: 10, fontWeight: 800,
            color: latencyColor(quality.latencyMs),
            fontFamily: "'DM Mono',monospace",
          }}>
            {quality.latencyMs}ms
          </span>
        )}

        <span style={{ color: "rgba(232,238,255,0.25)", display: "flex" }}>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {/* ── Expanded detail ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="obs-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              padding:     "0 14px 14px",
              borderTop:   "1px solid rgba(255,255,255,0.05)",
              paddingTop:  12,
              display:     "flex",
              flexDirection: "column",
              gap:         14,
            }}>

              {/* Row 1: Latency sparkline */}
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)",
                  fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em",
                  marginBottom: 6, textTransform: "uppercase",
                }}>
                  RTT Latency
                </div>
                <LatencySparkline readings={latencyReadings.current} />
              </div>

              {/* Row 2: Histogram */}
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)",
                  fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em",
                  marginBottom: 6, textTransform: "uppercase",
                }}>
                  Latency Distribution
                </div>
                <LatencyHistogram buckets={quality.latencyBuckets} />
              </div>

              {/* Row 3: Event rate + reconnect info */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <EventRatePill epm={quality.eventsPerMinute} />

                {quality.attempts > 0 && (
                  <span style={{
                    fontSize: 10, color: "#FBBF24",
                    fontFamily: "'DM Mono',monospace",
                  }}>
                    {quality.attempts} reconnect{quality.attempts !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Row 4: Countdown if reconnecting */}
              {quality.reconnectIn > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px",
                  background: "rgba(251,191,36,0.06)",
                  border: "1px solid rgba(251,191,36,0.15)",
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 10, color: "#FBBF24", fontFamily: "'DM Mono',monospace" }}>
                    Next attempt in {quality.reconnectIn}s
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Compact inline variant for AppShell sidebar ─────────────────────── */
export function RuntimeHealthDot() {
  const { status, quality } = useWebSocketContext();
  const color = statusColor(status);
  const pulsing = status === "authenticated" || status === "connecting" || status === "reconnecting";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: color, flexShrink: 0,
        animation: pulsing ? "glw 2s ease infinite" : "none",
        boxShadow: status === "authenticated" ? `0 0 6px ${color}` : "none",
      }} />
      <span style={{
        fontSize: 10, fontWeight: 600, color,
        fontFamily: "'DM Mono',monospace",
      }}>
        {status === "authenticated"
          ? quality.latencyMs !== null ? `${quality.latencyMs}ms` : "online"
          : status === "reconnecting"
          ? quality.reconnectIn > 0 ? `retry ${quality.reconnectIn}s` : "retrying…"
          : status === "connecting" ? "connecting…"
          : status === "offline"    ? "offline"
          : "offline"}
      </span>
    </div>
  );
}
