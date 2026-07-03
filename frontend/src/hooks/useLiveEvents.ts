/**
 * useLiveEvents — Phase 3 refactor
 * Now consumes from shared WebSocketContext instead of spawning its own connection.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocketContext, type WSStatus } from "../contexts/WebSocketContext";

export type LiveEventType =
  | "workflow_run"
  | "workflow_run_start"
  | "workflow_run_end"
  | "automation_trigger"
  | "status_change"
  | "connection_event"
  | "generic";

export type LiveEventStatus = "success" | "failed" | "running" | "pending";

export interface LiveEvent {
  id: string;
  type: LiveEventType;
  title: string;
  detail: string;
  status: LiveEventStatus;
  ts: number;
  raw?: any;
}

const MAX_EVENTS = 50;

function toEventType(raw: any): LiveEventType {
  const ev = (raw.event || raw.type || "").toLowerCase();
  if (
    ev.includes("workflow.run") || ev.includes("workflow_run") ||
    ev === "run_started" || ev === "run_completed" || ev === "run_failed"
  ) {
    if (ev.includes("start")) return "workflow_run_start";
    if (ev.includes("end") || ev.includes("complete") || ev.includes("finish")) return "workflow_run_end";
    return "workflow_run";
  }
  if (ev.includes("automation") || ev.includes("trigger")) return "automation_trigger";
  if (ev.includes("status")) return "status_change";
  if (ev.includes("connection")) return "connection_event";
  return "generic";
}

function toStatus(raw: any): LiveEventStatus {
  const s = (raw.status || raw.result || "").toLowerCase();
  if (s.includes("success") || s.includes("complete") || s === "ok") return "success";
  if (s.includes("fail") || s.includes("error")) return "failed";
  if (s.includes("running") || s.includes("start")) return "running";
  return "pending";
}

function buildTitle(raw: any, type: LiveEventType): string {
  if (raw.workflow_name || raw.name) {
    const n = raw.workflow_name || raw.name;
    if (type === "workflow_run_start") return `▶ ${n} started`;
    if (type === "workflow_run_end" || type === "workflow_run") return `${n}`;
    if (type === "automation_trigger") return `⚡ ${n} triggered`;
  }
  if (type === "automation_trigger") return "Automation triggered";
  if (type === "workflow_run_start") return "Workflow started";
  if (type === "workflow_run_end") return "Workflow completed";
  if (type === "status_change") return "Status changed";
  if (type === "connection_event") return "Connection event";
  return raw.event || raw.type || "Event received";
}

function buildDetail(raw: any): string {
  const parts: string[] = [];
  if (raw.trigger_type) parts.push(raw.trigger_type);
  if (raw.duration !== undefined) parts.push(`${raw.duration}ms`);
  if (raw.step_count !== undefined) parts.push(`${raw.step_count} steps`);
  if (raw.error) parts.push(raw.error);
  if (raw.message && parts.length === 0) parts.push(raw.message);
  return parts.join(" · ");
}

function normalize(raw: any): LiveEvent | null {
  const skippedEvents = [
    "ping", "pong", "authenticated", "auth", "connected",
    // Admin-only queue health heartbeats (websocket/queue-health-broadcaster.js)
    // — infrastructure telemetry, not user-facing workflow events.
    "queue:tier:health", "queue:tier:saturation", "queue:tier:critical",
    "queue:tier:worker_error", "queue:tier:dlq_spike", "queue:tier:recovery",
  ];
  const evType = (raw.event || raw.type || "").toLowerCase();
  if (skippedEvents.includes(evType)) return null;

  const type = toEventType(raw);
  return {
    id:     raw.id || raw.run_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title:  buildTitle(raw, type),
    detail: buildDetail(raw),
    status: toStatus(raw),
    ts:     raw.ts || raw.timestamp || Date.now(),
    raw,
  };
}

export function useLiveEvents() {
  const { status, subscribe, isConnected } = useWebSocketContext();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const seenIds = useRef(new Set<string>());

  const pushEvent = useCallback((raw: any) => {
    const ev = normalize(raw);
    if (!ev) return;
    if (seenIds.current.has(ev.id)) return;
    seenIds.current.add(ev.id);
    if (seenIds.current.size > MAX_EVENTS * 2) {
      const arr = [...seenIds.current];
      seenIds.current = new Set(arr.slice(arr.length - MAX_EVENTS));
    }
    setEvents(prev => [ev, ...prev].slice(0, MAX_EVENTS));
  }, []);

  useEffect(() => {
    const unsub = subscribe("*", pushEvent);
    return unsub;
  }, [subscribe, pushEvent]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    seenIds.current.clear();
  }, []);

  return {
    events,
    wsStatus: status as WSStatus,
    isConnected,
    clearEvents,
  };
}
