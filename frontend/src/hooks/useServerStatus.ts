/**
 * AutoFlowNG — useServerStatus (improved)
 * Uses auth token as a proxy for connectivity — if we have a valid token
 * and the app is responding, we show online.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { pingAPI, tokenStore } from "../lib/api";

export type ServerStatus = "checking" | "online" | "waking" | "offline";

export function useServerStatus() {
  const [status,  setStatus]  = useState<ServerStatus>("checking");
  const [latency, setLatency] = useState<number | null>(null);
  const [watching, setWatching] = useState(false);
  const onBackRef   = useRef<(() => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCount   = useRef(0);

  const check = useCallback(async () => {
    // If no token at all, skip (not authenticated yet)
    if (!tokenStore.exists()) { setStatus("checking"); return; }

    const t0 = Date.now();
    try {
      const res = await pingAPI.check();
      const ms = Date.now() - t0;
      if (res.ok || res.status === 401) {
        // 401 still means server is reachable
        failCount.current = 0;
        setLatency(ms);
        setStatus(prev => {
          if (prev !== "online" && onBackRef.current) {
            onBackRef.current();
            onBackRef.current = null;
            setWatching(false);
          }
          return "online";
        });
      } else if (res.status >= 500) {
        failCount.current++;
        if (failCount.current >= 2) { setStatus("waking"); setLatency(null); }
      } else {
        // 4xx other than 401 — server is running
        failCount.current = 0;
        setLatency(Date.now() - t0);
        setStatus("online");
      }
    } catch (e: any) {
      failCount.current++;
      if (failCount.current === 1) {
        setStatus("waking");
      } else if (failCount.current >= 3) {
        setStatus(e.name === "TimeoutError" || e.name === "AbortError" ? "waking" : "offline");
        setLatency(null);
      }
    }
  }, []);

  const startPolling = useCallback((ms: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(check, ms);
  }, [check]);

  useEffect(() => {
    // Small delay before first check to let auth settle
    const init = setTimeout(() => { check(); startPolling(30_000); }, 2000);
    return () => { clearTimeout(init); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [check, startPolling]);

  useEffect(() => {
    startPolling(watching ? 5_000 : 30_000);
  }, [watching, startPolling]);

  const notifyWhenOnline = useCallback((cb: () => void) => {
    onBackRef.current = cb;
    setWatching(true);
    check();
  }, [check]);

  const cancelNotify = useCallback(() => {
    onBackRef.current = null;
    setWatching(false);
  }, []);

  return { status, latency, watching, recheck: check, notifyWhenOnline, cancelNotify };
}
