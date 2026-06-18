/**
 * AutoFlowNG — Queue Mission Control (Phase 13)
 *
 * Enterprise queue observability page for platform admins.
 * Provides real-time visibility into all four tier queues:
 *   af-critical | af-standard | af-bulk | af-scheduled
 *
 * Features:
 *   - Live tier health cards with pressure gauges
 *   - Per-tier saturation, DLQ depth, and worker status
 *   - Cross-tier starvation risk analysis panel
 *   - DLQ intelligence feed with failure category breakdown
 *   - Queue broadcast alert log (WebSocket-sourced events)
 *   - Tier assignment UI for individual workflows
 *   - Tier metrics history chart (30-day)
 *
 * Data sources:
 *   GET /api/queue-tiers/dashboard    — compound health snapshot
 *   GET /api/queue-tiers/dlq/intelligence — DLQ trend + recommendations
 *   GET /api/queue-tiers/tier-metrics-history — 30-day persisted metrics
 *   GET /api/queue-broadcast/log      — recent WS alert events
 *   WS  queue:tier:health             — real-time heartbeat (15s cadence)
 *   WS  queue:tier:saturation/critical/dlq_spike — alert events
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, Clock,
  Cpu, Database, Layers, Radio, RefreshCw, Shield, TrendingUp,
  TrendingDown, Zap, BarChart2, Bell, Filter, ArrowUpRight,
  Server, Box, ChevronDown, ChevronRight, Info,
} from "lucide-react";

// ── API helpers ───────────────────────────────────────────────────────────────

const api = {
  get: (path: string) =>
    fetch(path, { credentials: "include" }).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    }),
  post: (path: string, body?: unknown) =>
    fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then(r => r.json()),
  patch: (path: string, body: unknown) =>
    fetch(path, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json()),
};

// ── Types ─────────────────────────────────────────────────────────────────────

type TierStatus = "healthy" | "degraded" | "critical" | "error";
type AlertSeverity = "ok" | "info" | "warning" | "critical";

interface TierHealth {
  status:          TierStatus;
  waiting:         number;
  active:          number;
  delayed:         number;
  failed:          number;
  dlq:             number;
  pressureScore:   number;
  concurrency:     number;
  bpThreshold:     number;
  backpressureActive: boolean;
  queue:           string;
  metrics?: {
    enqueued:      number;
    completed:     number;
    failed:        number;
    deadLetter:    number;
    avgLatencyMs:  number | null;
  };
}

interface TierPressure {
  score:   number;
  level:   string;
  breakdown: { depth: number; failure: number; dlq: number };
  indicators: { depthRatioPct: number; failRatePct: number; dlqDepth: number; backpressureActive: boolean };
}

interface BroadcastEvent {
  type:     string;
  tier?:    string;
  severity: AlertSeverity;
  message:  string;
  ts:       string;
  pressureScore?: number;
  waiting?: number;
  dlqNow?:  number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIERS = ["critical", "standard", "bulk", "scheduled"] as const;
type TierName = (typeof TIERS)[number];

const TIER_META: Record<TierName, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  critical:  { label: "Critical",  icon: Shield,   color: "#FF4D6D", desc: "Payment, compliance, security" },
  standard:  { label: "Standard",  icon: Zap,      color: "#7C6FFF", desc: "Regular user workflows (default)" },
  bulk:      { label: "Bulk",      icon: Database,  color: "#F59E0B", desc: "Batch exports, AI heavy tasks" },
  scheduled: { label: "Scheduled", icon: Clock,     color: "#10B981", desc: "Cron / schedule-triggered" },
};

const STATUS_META: Record<TierStatus, { color: string; Icon: React.ElementType; label: string }> = {
  healthy:  { color: "#10B981", Icon: CheckCircle2, label: "Healthy" },
  degraded: { color: "#F59E0B", Icon: AlertTriangle, label: "Degraded" },
  critical: { color: "#FF4D6D", Icon: XCircle,      label: "Critical" },
  error:    { color: "#6B7280", Icon: AlertTriangle, label: "Error" },
};

const SEV_COLOR: Record<AlertSeverity, string> = {
  ok:       "#10B981",
  info:     "#7C6FFF",
  warning:  "#F59E0B",
  critical: "#FF4D6D",
};

// ── Pressure gauge ────────────────────────────────────────────────────────────

function PressureGauge({ score, size = 80 }: { score: number; size?: number }) {
  const color = score >= 75 ? "#FF4D6D" : score >= 45 ? "#F59E0B" : "#10B981";
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.22} fontWeight={900} fill={color}
        fontFamily="'DM Mono',monospace">
        {score}
      </text>
    </svg>
  );
}

// ── Tier health card ──────────────────────────────────────────────────────────

function TierCard({ name, health, pressure }: { name: TierName; health?: TierHealth; pressure?: TierPressure }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TIER_META[name];
  const Icon = meta.icon;

  if (!health) {
    return (
      <div style={cardStyle} className="af-glass">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon size={18} color={meta.color} />
          <span style={{ fontWeight: 700, color: "#E8EEFF" }}>{meta.label}</span>
        </div>
        <div style={{ color: "rgba(232,238,255,0.35)", fontSize: 12, marginTop: 8 }}>No data</div>
      </div>
    );
  }

  const sm = STATUS_META[health.status] ?? STATUS_META.error;
  const pScore = pressure?.score ?? health.pressureScore ?? 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="af-glass">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `${meta.color}15`, border: `1px solid ${meta.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={15} color={meta.color} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>{meta.label}</div>
              <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{health.queue}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(232,238,255,0.45)" }}>{meta.desc}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: `${sm.color}15`, border: `1px solid ${sm.color}30`, borderRadius: 100, padding: "3px 10px" }}>
            <sm.Icon size={11} color={sm.color} />
            <span style={{ fontSize: 11, color: sm.color, fontWeight: 700 }}>{sm.label}</span>
          </div>
          <PressureGauge score={pScore} size={54} />
        </div>
      </div>

      {/* Backpressure banner */}
      {health.backpressureActive && (
        <div style={{ background: "#FF4D6D18", border: "1px solid #FF4D6D40", borderRadius: 8, padding: "6px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={13} color="#FF4D6D" />
          <span style={{ fontSize: 12, color: "#FF4D6D", fontWeight: 600 }}>Backpressure active — new enqueues rejected</span>
        </div>
      )}

      {/* Core metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
        {[
          { label: "Waiting",   value: health.waiting,   icon: Activity },
          { label: "Active",    value: health.active,    icon: Cpu },
          { label: "Delayed",   value: health.delayed,   icon: Clock },
          { label: "DLQ",       value: health.dlq,       icon: XCircle, warn: health.dlq > 0 },
        ].map(({ label, value, icon: MIcon, warn }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
              <MIcon size={12} color={warn ? "#FF4D6D" : "rgba(232,238,255,0.4)"} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: warn ? "#FF4D6D" : "#E8EEFF", fontFamily: "'DM Mono',monospace" }}>{value ?? 0}</div>
            <div style={{ fontSize: 10, color: "rgba(232,238,255,0.4)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Depth bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "rgba(232,238,255,0.45)" }}>Queue depth</span>
          <span style={{ fontSize: 11, color: "rgba(232,238,255,0.6)", fontFamily: "'DM Mono',monospace" }}>
            {health.waiting} / {health.bpThreshold}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3,
            background: pScore >= 75 ? "#FF4D6D" : pScore >= 45 ? "#F59E0B" : meta.color,
            width: `${Math.min(100, (health.waiting / Math.max(health.bpThreshold, 1)) * 100)}%`,
            transition: "width 0.5s ease",
          }} />
        </div>
      </div>

      {/* Concurrency bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "rgba(232,238,255,0.45)" }}>Worker utilization</span>
          <span style={{ fontSize: 11, color: "rgba(232,238,255,0.6)", fontFamily: "'DM Mono',monospace" }}>
            {health.active} / {health.concurrency} slots
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3,
            background: meta.color,
            width: `${Math.min(100, (health.active / Math.max(health.concurrency, 1)) * 100)}%`,
            transition: "width 0.5s ease",
          }} />
        </div>
      </div>

      {/* Expand toggle */}
      <button onClick={() => setExpanded(e => !e)} style={expandBtnStyle}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>{expanded ? "Hide" : "Show"} metrics detail</span>
      </button>

      <AnimatePresence>
        {expanded && health.metrics && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, marginTop: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
                {[
                  { label: "Enqueued", value: health.metrics.enqueued },
                  { label: "Completed", value: health.metrics.completed },
                  { label: "Failed (total)", value: health.metrics.failed },
                  { label: "Dead-lettered", value: health.metrics.deadLetter },
                  { label: "Avg latency", value: health.metrics.avgLatencyMs != null ? `${Math.round(health.metrics.avgLatencyMs)}ms` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ fontSize: 12 }}>
                    <span style={{ color: "rgba(232,238,255,0.45)" }}>{label}: </span>
                    <span style={{ color: "#E8EEFF", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{value ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Starvation risk panel ─────────────────────────────────────────────────────

function StarvationRiskPanel({ starvation }: { starvation: any }) {
  if (!starvation?.available) return null;
  const { risks, riskLevel } = starvation;

  const lvlColor = ({ none: "#10B981", medium: "#F59E0B", high: "#FF8C42", critical: "#FF4D6D" } as Record<string, string>)[riskLevel] ?? "#6B7280";

  return (
    <div style={sectionCardStyle} className="af-glass">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={16} color={lvlColor} />
          <span style={{ fontWeight: 800, fontSize: 14, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Starvation Risk Analysis</span>
        </div>
        <div style={{ background: `${lvlColor}15`, border: `1px solid ${lvlColor}30`, borderRadius: 100, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: lvlColor, textTransform: "capitalize" }}>
          {riskLevel}
        </div>
      </div>

      {risks.length === 0 ? (
        <div style={{ color: "#10B981", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} />
          No cross-tier starvation risks detected
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {risks.map((risk: any, i: number) => {
            const sevColor = ({ critical: "#FF4D6D", high: "#FF8C42", medium: "#F59E0B" } as Record<string, string>)[risk.severity] ?? "#7C6FFF";
            return (
              <div key={i} style={{ background: `${sevColor}08`, border: `1px solid ${sevColor}25`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <AlertTriangle size={13} color={sevColor} />
                  <span style={{ fontWeight: 700, fontSize: 12, color: sevColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>{risk.severity}</span>
                  <span style={{ fontSize: 11, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace" }}>{risk.tiers?.join(" + ")}</span>
                </div>
                <p style={{ fontSize: 12, color: "rgba(232,238,255,0.7)", margin: "0 0 8px", lineHeight: 1.5 }}>{risk.message}</p>
                <div>
                  {(risk.remediation || []).map((r: string, ri: number) => (
                    <div key={ri} style={{ fontSize: 11, color: "rgba(232,238,255,0.5)", display: "flex", gap: 6, marginTop: 3 }}>
                      <span style={{ color: sevColor }}>→</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DLQ intelligence panel ────────────────────────────────────────────────────

function DLQIntelPanel({ data }: { data: any }) {
  if (!data) return null;

  const cats = data.categories?.slice(0, 6) || [];
  const recs  = data.recommendations?.filter((r: any) => r.type !== 'ok') || [];

  return (
    <div style={sectionCardStyle} className="af-glass">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <XCircle size={16} color="#FF4D6D" />
        <span style={{ fontWeight: 800, fontSize: 14, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>DLQ Intelligence</span>
      </div>

      {cats.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Failure Categories (7d)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {cats.map((c: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", width: 80 }}>{c.failure_category}</span>
                <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "#FF4D6D", width: `${Math.min(100, (c.count / (cats[0]?.count || 1)) * 100)}%` }} />
                </div>
                <span style={{ fontSize: 11, color: "#E8EEFF", fontFamily: "'DM Mono',monospace", width: 30, textAlign: "right" }}>{c.count}</span>
                <span style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>[{c.queue_tier}]</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Auto-Recommendations</div>
          {recs.map((r: any, i: number) => (
            <div key={i} style={{ fontSize: 12, color: "rgba(232,238,255,0.65)", display: "flex", gap: 6, marginTop: 5, lineHeight: 1.5 }}>
              <span style={{ color: "#F59E0B", flexShrink: 0 }}>⚠</span>
              <span>{r.message}</span>
            </div>
          ))}
        </div>
      )}

      {recs.length === 0 && cats.length === 0 && (
        <div style={{ color: "#10B981", fontSize: 13 }}>No DLQ issues detected in the last 7 days.</div>
      )}
    </div>
  );
}

// ── Broadcast alert log ───────────────────────────────────────────────────────

function AlertLog({ events }: { events: BroadcastEvent[] }) {
  const alertEvts = events.filter(e => e.type !== "queue:tier:health").slice(-20).reverse();

  return (
    <div style={sectionCardStyle} className="af-glass">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Bell size={16} color="#7C6FFF" />
        <span style={{ fontWeight: 800, fontSize: 14, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Recent Queue Alerts</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(232,238,255,0.35)" }}>Last {alertEvts.length} events</span>
      </div>

      {alertEvts.length === 0 ? (
        <div style={{ color: "#10B981", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} />
          No alerts — all queues operating normally
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
          {alertEvts.map((evt, i) => {
            const color = SEV_COLOR[evt.severity] ?? "#6B7280";
            const relTime = _relativeTime(evt.ts);
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "rgba(232,238,255,0.8)", lineHeight: 1.4 }}>{evt.message}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                    {evt.tier && <span style={{ fontSize: 10, color, fontFamily: "'DM Mono',monospace" }}>{evt.tier}</span>}
                    <span style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>{relTime}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tier metrics history chart (simple bar chart) ─────────────────────────────

function MetricsHistoryChart({ history }: { history: Record<string, any[]> }) {
  const [selectedTier, setSelectedTier] = useState<TierName>("standard");
  const data = (history[selectedTier] || []).slice(0, 14).reverse();

  if (data.length === 0) return null;

  const maxCompleted = Math.max(...data.map((d: any) => d.completed), 1);

  return (
    <div style={sectionCardStyle} className="af-glass">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <BarChart2 size={16} color="#7C6FFF" />
        <span style={{ fontWeight: 800, fontSize: 14, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>14-Day Execution History</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {TIERS.map(t => (
            <button key={t} onClick={() => setSelectedTier(t)}
              style={{ ...tabBtnStyle, ...(selectedTier === t ? { background: `${TIER_META[t].color}25`, color: TIER_META[t].color, borderColor: `${TIER_META[t].color}40` } : {}) }}>
              {TIER_META[t].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
        {data.map((d: any, i: number) => {
          const h = Math.max(4, (d.completed / maxCompleted) * 100);
          const color = TIER_META[selectedTier].color;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: `${color}50`, position: "relative" }}>
                {d.failed > 0 && (
                  <div style={{ position: "absolute", bottom: 0, width: "100%", height: Math.max(2, (d.failed / maxCompleted) * 100), background: "#FF4D6D60", borderRadius: "3px 3px 0 0" }} />
                )}
              </div>
              <span style={{ fontSize: 8, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
                {new Date(d.date).toLocaleDateString("en", { month: "2-digit", day: "2-digit" })}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(232,238,255,0.4)" }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: `${TIER_META[selectedTier].color}50` }} />
          Completed
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(232,238,255,0.4)" }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#FF4D6D60" }} />
          Failed
        </div>
      </div>
    </div>
  );
}

// ── Optimization recommendations ──────────────────────────────────────────────

function OptimizationPanel({ recs }: { recs: any[] }) {
  if (!recs?.length) return null;
  const visRecs = recs.filter(r => r.type !== "ok").slice(0, 5);
  if (visRecs.length === 0) return null;

  return (
    <div style={sectionCardStyle} className="af-glass">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TrendingUp size={16} color="#10B981" />
        <span style={{ fontWeight: 800, fontSize: 14, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>Optimization Recommendations</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visRecs.map((r: any, i: number) => {
          const tierMeta = r.tier ? TIER_META[r.tier as TierName] : null;
          return (
            <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: r.priority === 1 ? "#FF4D6D" : "#F59E0B", background: r.priority === 1 ? "#FF4D6D15" : "#F59E0B15", borderRadius: 100, padding: "2px 8px", fontFamily: "'DM Mono',monospace" }}>
                  P{r.priority}
                </span>
                {tierMeta && (
                  <span style={{ fontSize: 10, color: tierMeta.color, fontFamily: "'DM Mono',monospace" }}>[{r.tier}]</span>
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF" }}>{r.title}</span>
              </div>
              <p style={{ fontSize: 11, color: "rgba(232,238,255,0.55)", margin: 0, lineHeight: 1.5 }}>{r.description}</p>
              {r.envVar && (
                <div style={{ marginTop: 6, fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
                  env: {r.envVar}{r.suggestedValue !== undefined ? ` → ${r.suggestedValue}` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QueueMissionControl() {
  const qc = useQueryClient();
  const [liveAlerts, setLiveAlerts] = useState<BroadcastEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const dashboard = useQuery({
    queryKey: ["queue-dashboard"],
    queryFn:  () => api.get("/api/queue-tiers/dashboard"),
    refetchInterval: 20_000,
  });

  const dlqIntel = useQuery({
    queryKey: ["queue-dlq-intelligence"],
    queryFn:  () => api.get("/api/queue-tiers/dlq/intelligence"),
    refetchInterval: 60_000,
  });

  const broadcastLog = useQuery({
    queryKey: ["queue-broadcast-log"],
    queryFn:  () => api.get("/api/queue-broadcast/log?limit=50"),
    refetchInterval: 30_000,
  });

  const history = useQuery({
    queryKey: ["queue-metrics-history"],
    queryFn:  () => api.get("/api/queue-tiers/tier-metrics-history?days=14"),
    refetchInterval: 300_000,
  });

  const optimize = useQuery({
    queryKey: ["queue-optimize"],
    queryFn:  () => api.get("/api/queue-tiers/tier-optimize"),
    refetchInterval: 60_000,
  });

  // ── WebSocket for live queue health events ───────────────────────────────────
  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data) as BroadcastEvent;
          if (evt.type?.startsWith("queue:tier:")) {
            setLiveAlerts(prev => [...prev.slice(-99), evt]);
            if (evt.type !== "queue:tier:health") {
              qc.invalidateQueries({ queryKey: ["queue-dashboard"] });
            }
          }
        } catch (_) {}
      };

      ws.onclose = () => { setTimeout(connect, 3000); };
    };
    connect();
    return () => wsRef.current?.close();
  }, [qc]);

  // Merge WS events with persisted broadcast log
  const allAlerts: BroadcastEvent[] = [
    ...(broadcastLog.data?.events || []),
    ...liveAlerts,
  ];

  const d = dashboard.data;
  const health  = d?.health?.health || {};
  const pressure = d?.pressure?.tiers || {};
  const starvation = d?.starvation;

  const refetchAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["queue-dashboard"] });
    qc.invalidateQueries({ queryKey: ["queue-dlq-intelligence"] });
    qc.invalidateQueries({ queryKey: ["queue-broadcast-log"] });
  }, [qc]);

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", padding: "24px 28px", background: "transparent", fontFamily: "'DM Sans',sans-serif" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(124,111,255,0.15)", border: "1px solid rgba(124,111,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={18} color="#7C6FFF" />
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", letterSpacing: "-0.03em", margin: 0 }}>
              Queue Mission Control
            </h1>
          </div>
          <p style={{ color: "rgba(232,238,255,0.4)", fontSize: 13, margin: 0 }}>
            Multi-tier enterprise execution infrastructure — Phase 13
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 100, padding: "5px 12px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", animation: "af-blink 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>LIVE</span>
          </div>
          <button onClick={refetchAll} style={{ ...iconBtnStyle, opacity: dashboard.isFetching ? 0.5 : 1 }}>
            <RefreshCw size={15} color="rgba(232,238,255,0.6)" style={{ animation: dashboard.isFetching ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* Tier health grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginBottom: 20 }}>
        {TIERS.map(tier => (
          <TierCard
            key={tier}
            name={tier}
            health={health[tier] as TierHealth}
            pressure={pressure[tier] as TierPressure}
          />
        ))}
      </div>

      {/* Bottom panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <StarvationRiskPanel starvation={starvation} />
        <DLQIntelPanel data={dlqIntel.data} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <AlertLog events={allAlerts} />
        <OptimizationPanel recs={optimize.data?.recommendations} />
      </div>

      {history.data?.history && (
        <MetricsHistoryChart history={history.data.history} />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.07)",
  position: "relative",
  overflow: "hidden",
};

const sectionCardStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.07)",
};

const expandBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 5,
  background: "none", border: "none", cursor: "pointer",
  fontSize: 11, color: "rgba(232,238,255,0.4)", padding: 0,
};

const iconBtnStyle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer",
};

const tabBtnStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, padding: "3px 9px",
  borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)", color: "rgba(232,238,255,0.5)",
  cursor: "pointer", fontFamily: "'DM Mono',monospace",
  transition: "all 0.2s",
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function _relativeTime(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)  return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}
