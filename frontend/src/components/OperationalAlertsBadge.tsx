/**
 * AutoFlowNG — Operational Alerts Badge (Phase 10D)
 *
 * Compact badge showing unresolved critical/warning alert counts.
 * Suitable for nav bars, admin headers, and dashboards.
 */

import { useState, useEffect, useCallback } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';

interface AlertCount {
  total: string;
  critical: string;
  warning: string;
}

interface Props {
  onClick?: () => void;
  className?: string;
  pollingIntervalMs?: number;
}

export default function OperationalAlertsBadge({
  onClick,
  className = '',
  pollingIntervalMs = 60_000,
}: Props) {
  const [counts, setCounts] = useState<AlertCount | null>(null);
  const [error, setError]   = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/operational-alerts/unread-count', {
        headers: { Authorization: `Bearer ${localStorage.getItem('autoflowng_token')}` },
      });
      if (!r.ok) { setError(true); return; }
      setCounts(await r.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollingIntervalMs);
    return () => clearInterval(id);
  }, [load, pollingIntervalMs]);

  if (error || !counts) return null;

  const total    = parseInt(counts.total);
  const critical = parseInt(counts.critical);

  if (total === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
        critical > 0
          ? 'border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400'
          : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
      } ${className}`}
      title={`${total} unresolved operational alert(s)`}
    >
      {critical > 0 ? <AlertTriangle size={14} /> : <Bell size={14} />}
      <span className="text-xs font-semibold">{total}</span>
      {critical > 0 && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border border-black animate-pulse" />
      )}
    </button>
  );
}
