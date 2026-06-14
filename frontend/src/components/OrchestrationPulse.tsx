/**
 * OrchestrationPulse
 * Renders a compact ambient energy strip that pulses whenever a real
 * WebSocket orchestration event arrives.  Zero fake activity — it only
 * reacts to events forwarded from useLiveEvents / useWebSocket.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocketContext } from "../contexts/WebSocketContext";

/* ── Types ───────────────────────────────────────────────────────────── */
interface Pulse {
  id: string;
  color: string;
  x: number;      // 0–100%
  ts: number;
}

export type PulseEventKind =
  | "workflow_run"
  | "workflow_run_start"
  | "workflow_run_end"
  | "automation_trigger"
  | "status_change"
  | "error"
  | "generic";

const KIND_COLOR: Record<PulseEventKind, string> = {
  workflow_run:       "#00C896",
  workflow_run_start: "#38BDF8",
  workflow_run_end:   "#00C896",
  automation_trigger: "#A78BFA",
  status_change:      "#FBBF24",
  error:              "#FB7185",
  generic:            "rgba(232,238,255,0.4)",
};

const MAX_PULSES = 12;

/* ── Horizontal pulse strip ──────────────────────────────────────────── */
export function OrchestrationPulse({
  subscribe: subscribeProp,
  className,
}: {
  subscribe?: (event: string, handler: (e: any) => void) => () => void;
  className?: string;
}) {
  const ctx = useWebSocketContext();
  const subscribe = subscribeProp ?? ctx.subscribe;
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const counter = useRef(0);

  const addPulse = useCallback((kind: PulseEventKind) => {
    const id    = `pulse-${counter.current++}`;
    const color = KIND_COLOR[kind] ?? KIND_COLOR.generic;
    const x     = 5 + Math.random() * 90;

    setPulses(prev => [
      { id, color, x, ts: Date.now() },
      ...prev,
    ].slice(0, MAX_PULSES));
  }, []);

  useEffect(() => {
    const map: Record<string, PulseEventKind> = {
      workflow_run:        "workflow_run",
      "workflow_run_start":"workflow_run_start",
      "workflow_run_end":  "workflow_run_end",
      automation_trigger:  "automation_trigger",
      status_change:       "status_change",
      error:               "error",
    };

    const unsub = subscribe("*", (event: any) => {
      const raw  = (event.event || event.type || "").toLowerCase();
      const kind = map[raw] ?? "generic";
      // Skip non-orchestration noise
      const skip = ["ping", "pong", "auth", "authenticated", "connected"];
      if (skip.includes(raw)) return;
      addPulse(kind as PulseEventKind);
    });

    return unsub;
  }, [subscribe, addPulse]);

  // Auto-expire pulses after 3 s
  useEffect(() => {
    if (pulses.length === 0) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setPulses(prev => prev.filter(p => now - p.ts < 3000));
    }, 3200);
    return () => clearTimeout(t);
  }, [pulses]);

  return (
    <div
      className={className}
      style={{
        position:      "relative",
        height:        2,
        borderRadius:  2,
        overflow:      "visible",
        background:    "rgba(255,255,255,0.04)",
      }}
    >
      <AnimatePresence>
        {pulses.map(p => (
          <motion.div
            key={p.id}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1, opacity: 0.9 }}
            exit={{   scale: 0, opacity: 0 }}
            transition={{ duration: 2.4, ease: "easeOut" }}
            style={{
              position:     "absolute",
              top:          "50%",
              left:         `${p.x}%`,
              transform:    "translate(-50%, -50%)",
              width:        8,
              height:       8,
              borderRadius: "50%",
              background:   p.color,
              boxShadow:    `0 0 12px 4px ${p.color}`,
              pointerEvents:"none",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ── Compact pulse ring (for AppShell status) ────────────────────────── */
export function PulseRing({
  active,
  color = "#00C896",
  size = 8,
}: {
  active: boolean;
  color?: string;
  size?: number;
}) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: active ? color : "rgba(255,255,255,0.15)",
        animation: active ? "glw 2s ease infinite" : "none",
      }} />
      {active && (
        <motion.div
          animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          style={{
            position: "absolute", inset: 0,
            borderRadius: "50%",
            border: `1px solid ${color}`,
          }}
        />
      )}
    </div>
  );
}

/* ── Full-width execution glow bar (top of page) ─────────────────────── */
export function ExecutionGlowBar({
  running,
  color = "#00C896",
}: {
  running: boolean;
  color?: string;
}) {
  return (
    <AnimatePresence>
      {running && (
        <motion.div
          key="glow-bar"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{   opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position:        "absolute",
            top:             0, left: 0, right: 0,
            height:          2,
            background:      `linear-gradient(90deg, transparent, ${color}, ${color}80, transparent)`,
            transformOrigin: "left center",
            animation:       "scan-x 2.4s ease-in-out infinite",
          }}
        />
      )}
    </AnimatePresence>
  );
}
