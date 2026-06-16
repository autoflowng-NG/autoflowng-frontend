import { useState, useEffect, useRef, useCallback } from "react";
import { pingAPI } from "../lib/api";

export type ServerStatus = "checking" | "online" | "waking" | "offline";

export function useServerStatus() {
  const [status, setStatus]   = useState<ServerStatus>("checking");
  const [latency, setLatency] = useState<number | null>(null);
  const [watching, setWatching] = useState(false);
  const onBackRef   = useRef<(() => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCount   = useRef(0);

  const check = useCallback(async () => {
    const t0 = Date.now();
    try {
      const res = await pingAPI.check();
      const ms = Date.now() - t0;
      if (res.ok) {
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
      } else {
        failCount.current++;
        if (failCount.current >= 3) { setStatus("offline"); setLatency(null); }
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
    const init = setTimeout(() => { check(); startPolling(30_000); }, 3000);
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
