import { useState, useEffect } from "react";

const tickListeners = new Set<() => void>();
let tickInterval: ReturnType<typeof setInterval> | null = null;

function startTickInterval() {
  if (tickInterval) return;
  tickInterval = setInterval(() => tickListeners.forEach(fn => fn()), 1000);
}

function stopTickIntervalIfEmpty() {
  if (tickListeners.size === 0 && tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

export function useLiveTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick(n => n + 1);
    tickListeners.add(listener);
    startTickInterval();
    return () => {
      tickListeners.delete(listener);
      stopTickIntervalIfEmpty();
    };
  }, []);
}
