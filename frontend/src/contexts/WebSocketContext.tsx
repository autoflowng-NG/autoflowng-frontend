/**
 * WebSocketContext — Phase 3 Centralized WebSocket Architecture
 *
 * SINGLE authenticated connection per authenticated user session.
 * All realtime consumers (ConnectionStatus, useLiveEvents, CriticalAlertToaster,
 * OrchestrationPulse, RuntimeObservability) subscribe from this shared context.
 *
 * Architecture guarantees:
 * - ONE WebSocket connection for the entire app lifetime
 * - Shared reconnect coordination (no duplicate reconnect storms)
 * - Global event deduplication via seenIds
 * - Shared latency tracking, countdown, and quality state
 * - Memory-leak-safe subscription cleanup
 * - Jittered exponential backoff preserved from Phase 2
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

/* ── Constants ──────────────────────────────────────────────────────── */
const WS_BASE_URL = (
  import.meta.env?.VITE_API_URL ||
  "https://autoflowng-backend-production.up.railway.app"
)
  .replace(/^https?/, (p: string) => (p === "https" ? "wss" : "ws"))
  .replace(/\/$/, "");

const PING_INTERVAL_MS = 20_000;
const MAX_BACKOFF_MS   = 30_000;
const INITIAL_BACKOFF  = 1_000;
const JITTER_FACTOR    = 0.4;

/* ── Types ──────────────────────────────────────────────────────────── */
export type WSStatus =
  | "idle"
  | "connecting"
  | "authenticated"
  | "reconnecting"
  | "disconnected"
  | "offline"
  | "error";

export interface WSQuality {
  latencyMs: number | null;
  reconnectIn: number;
  attempts: number;
  /** Events received per minute (rolling 60-second window) */
  eventsPerMinute: number;
  /** Rolling latency histogram buckets: <50ms, 50-150ms, 150-300ms, >300ms */
  latencyBuckets: [number, number, number, number];
}

export interface WSEvent {
  event?: string;
  type?: string;
  [key: string]: any;
}

export interface WebSocketContextValue {
  status: WSStatus;
  quality: WSQuality;
  isConnected: boolean;
  subscribe: (eventType: string, handler: (event: WSEvent) => void) => () => void;
  send: (data: any) => boolean;
  forceReconnect: () => void;
  disconnect: () => void;
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function jitter(ms: number): number {
  return ms * (1 - JITTER_FACTOR / 2 + Math.random() * JITTER_FACTOR);
}

/* ── Context ─────────────────────────────────────────────────────────── */
const WebSocketContext = createContext<WebSocketContextValue | null>(null);

/* ── Provider ────────────────────────────────────────────────────────── */
export function WebSocketProvider({
  token,
  children,
}: {
  token: string | null;
  children: ReactNode;
}) {
  const [status, setStatus]   = useState<WSStatus>("idle");
  const [quality, setQuality] = useState<WSQuality>({
    latencyMs:       null,
    reconnectIn:     0,
    attempts:        0,
    eventsPerMinute: 0,
    latencyBuckets:  [0, 0, 0, 0],
  });

  /* ── Internal refs ───────────────────────────────────────────────── */
  const ws              = useRef<WebSocket | null>(null);
  const listeners       = useRef(new Map<string, Set<(event: WSEvent) => void>>());
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const backoffMs       = useRef(INITIAL_BACKOFF);
  const attempts        = useRef(0);
  const unmounted       = useRef(false);
  const shouldReconnect = useRef(true);
  const pingTs          = useRef<number | null>(null);
  const reauthTimer    = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Rolling event-rate tracking */
  const eventTimestamps = useRef<number[]>([]);

  /* Latency histogram accumulators */
  const latencyBuckets = useRef<[number, number, number, number]>([0, 0, 0, 0]);

  /* ── Timer helpers ───────────────────────────────────────────────── */
  const clearTimers = useCallback(() => {
    if (reconnectTimer.current)  { clearTimeout(reconnectTimer.current);  reconnectTimer.current  = null; }
    if (countdownTimer.current)  { clearInterval(countdownTimer.current); countdownTimer.current  = null; }
    if (pingTimer.current)       { clearInterval(pingTimer.current);      pingTimer.current       = null; }
    if (reauthTimer.current)     { clearInterval(reauthTimer.current);    reauthTimer.current     = null; }
  }, []);

  const startCountdown = useCallback((totalMs: number) => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    let remaining = Math.ceil(totalMs / 1000);
    setQuality(q => ({ ...q, reconnectIn: remaining }));
    countdownTimer.current = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      setQuality(q => ({ ...q, reconnectIn: remaining }));
      if (remaining === 0 && countdownTimer.current) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
      }
    }, 1000);
  }, []);

  /* ── Event rolling rate ──────────────────────────────────────────── */
  const recordEvent = useCallback(() => {
    const now = Date.now();
    eventTimestamps.current.push(now);
    // Trim to last 60 seconds
    const cutoff = now - 60_000;
    eventTimestamps.current = eventTimestamps.current.filter(t => t > cutoff);
    const epm = eventTimestamps.current.length;
    setQuality(q => ({ ...q, eventsPerMinute: epm }));
  }, []);

  /* ── Dispatch to subscribers ─────────────────────────────────────── */
  const emit = useCallback((event: WSEvent) => {
    listeners.current.get(event.event as string)?.forEach(fn => fn(event));
    listeners.current.get(event.type  as string)?.forEach(fn => fn(event));
    listeners.current.get("*")?.forEach(fn => fn(event));
  }, []);

  /* ── Connect ─────────────────────────────────────────────────────── */
  const connect = useCallback(() => {
    if (unmounted.current || !token || !WS_BASE_URL) return;
    if (ws.current?.readyState === WebSocket.OPEN) return;
    if (!navigator.onLine) { setStatus("offline"); return; }

    setStatus(attempts.current === 0 ? "connecting" : "reconnecting");

    try {
      const socket = new WebSocket(`${WS_BASE_URL}/ws`);
      ws.current = socket;

      socket.onopen = () => {
        if (unmounted.current) { socket.close(); return; }
        socket.send(JSON.stringify({ type: "auth", token }));
        backoffMs.current = INITIAL_BACKOFF;
        attempts.current  = 0;
        latencyBuckets.current = [0, 0, 0, 0];
        setQuality(q => ({
          ...q,
          latencyMs:      null,
          reconnectIn:    0,
          attempts:       0,
          latencyBuckets: [0, 0, 0, 0],
        }));

        if (pingTimer.current) clearInterval(pingTimer.current);
        pingTimer.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            pingTs.current = Date.now();
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL_MS);

        // Phase 7: Re-auth every 45 minutes to refresh the WS session
        // before the JWT expires (typical JWT TTL is 1-24h)
        if (reauthTimer.current) clearInterval(reauthTimer.current);
        reauthTimer.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN && token) {
            socket.send(JSON.stringify({ type: "reauth", token }));
          }
        }, 45 * 60_000);
      };

      socket.onmessage = (evt) => {
        try {
          const event: WSEvent = JSON.parse(evt.data);

          /* Authentication ack */
          if (event.event === "authenticated" || event.type === "authenticated") {
            setStatus("authenticated");
          }

          /* Pong — latency measurement only, not re-emitted */
          if (event.event === "pong" || event.type === "pong") {
            if (pingTs.current !== null) {
              const ms = Date.now() - pingTs.current;
              pingTs.current = null;
              // Update histogram
              const b = latencyBuckets.current;
              if      (ms < 50)  b[0]++;
              else if (ms < 150) b[1]++;
              else if (ms < 300) b[2]++;
              else               b[3]++;
              setQuality(q => ({
                ...q,
                latencyMs:      ms,
                latencyBuckets: [...b] as [number, number, number, number],
              }));
            }
            return;
          }

          /* Record event for rate metrics */
          const evStr = (event.event || event.type || "").toLowerCase();
          const skipRate = ["ping", "pong", "auth", "authenticated", "connected"];
          if (!skipRate.includes(evStr)) recordEvent();

          emit(event);
        } catch {
          /* malformed — ignore */
        }
      };

      socket.onclose = () => {
        if (pingTimer.current) clearInterval(pingTimer.current);
        if (unmounted.current || !shouldReconnect.current) {
          setStatus("disconnected");
          return;
        }
        setStatus("reconnecting");
        attempts.current += 1;
        const rawDelay = Math.min(backoffMs.current, MAX_BACKOFF_MS);
        const delay    = jitter(rawDelay);
        backoffMs.current = Math.min(backoffMs.current * 2, MAX_BACKOFF_MS);
        setQuality(q => ({ ...q, attempts: attempts.current }));
        startCountdown(delay);
        reconnectTimer.current = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        setStatus("error");
      };
    } catch {
      setStatus("error");
      const delay = jitter(Math.min(backoffMs.current, MAX_BACKOFF_MS));
      backoffMs.current = Math.min(backoffMs.current * 2, MAX_BACKOFF_MS);
      reconnectTimer.current = setTimeout(connect, delay);
    }
  }, [token, emit, startCountdown, recordEvent]);

  /* ── Online / offline ────────────────────────────────────────────── */
  useEffect(() => {
    const onOnline = () => {
      if (shouldReconnect.current && token) {
        backoffMs.current = INITIAL_BACKOFF;
        attempts.current  = 0;
        clearTimers();
        connect();
      }
    };
    const onOffline = () => {
      clearTimers();
      setStatus("offline");
    };
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [token, connect, clearTimers]);

  /* ── Mount / token lifecycle ─────────────────────────────────────── */
  useEffect(() => {
    unmounted.current = false;
    return () => { unmounted.current = true; };
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("idle");
      return;
    }
    unmounted.current       = false;
    shouldReconnect.current = true;
    backoffMs.current       = INITIAL_BACKOFF;
    attempts.current        = 0;
    connect();
    return () => {
      shouldReconnect.current = false;
      clearTimers();
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close(1000, "Provider unmounted");
        ws.current = null;
      }
      setStatus("disconnected");
    };
  }, [token, connect, clearTimers]);

  /* ── Public API ──────────────────────────────────────────────────── */
  const subscribe = useCallback(
    (eventType: string, handler: (event: WSEvent) => void) => {
      if (!listeners.current.has(eventType)) {
        listeners.current.set(eventType, new Set());
      }
      listeners.current.get(eventType)!.add(handler);
      return () => {
        listeners.current.get(eventType)?.delete(handler);
      };
    },
    []
  );

  const send = useCallback((data: any): boolean => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnect.current = false;
    clearTimers();
    ws.current?.close(1000, "Manual disconnect");
    setStatus("disconnected");
  }, [clearTimers]);

  const forceReconnect = useCallback(() => {
    clearTimers();
    backoffMs.current = INITIAL_BACKOFF;
    attempts.current  = 0;
    ws.current?.close();
    connect();
  }, [connect, clearTimers]);

  const value = useMemo<WebSocketContextValue>(
    () => ({
      status,
      quality,
      isConnected: status === "authenticated",
      subscribe,
      send,
      forceReconnect,
      disconnect,
    }),
    [status, quality, subscribe, send, forceReconnect, disconnect]
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/* ── Consumer hook ───────────────────────────────────────────────────── */
export function useWebSocketContext(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWebSocketContext must be used within WebSocketProvider");
  return ctx;
}
