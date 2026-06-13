/**
 * AutoFlowNG — Paystack Balance Intelligence Widget (Phase 10D)
 *
 * Displays live Paystack balance health:
 *   - Available NGN balance (color-coded)
 *   - Pending withdrawals from DB
 *   - Projected balance after pending
 *   - Critical / Warning / Healthy state indicator
 *   - Last fetched timestamp
 *   - Refresh button
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw,
  TrendingDown, Banknote, Clock, Shield,
} from 'lucide-react';

interface NgnSummary {
  available: number;
  pending: number;
  projected: number;
  warning: boolean;
  critical: boolean;
}

interface BalanceIntelligence {
  paystackConfigured: boolean;
  balances: Array<{ currency: string; balance: number }>;
  ngnSummary: NgnSummary | null;
  warnings: Array<{ level: string; message: string }>;
  thresholds: { warning: number; critical: number };
  fetchedAt: string | null;
  pendingByCurrency: Array<{ currency: string; pending_total: string; pending_count: string }>;
}

interface Props {
  compact?: boolean;
  className?: string;
  onCritical?: () => void;
}

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PaystackBalanceWidget({ compact = false, className = '', onCritical }: Props) {
  const [data, setData]       = useState<BalanceIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const qs = forceRefresh ? '?refresh=true' : '';
      const r  = await fetch(`/api/financial-integrity/paystack-balance${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('autoflowng_token')}` },
      });
      if (!r.ok) throw new Error(await r.text());
      const json: BalanceIntelligence = await r.json();
      setData(json);
      setLastRefresh(new Date());
      if (json.ngnSummary?.critical) onCritical?.();
    } catch (e: any) {
      setError(e.message || 'Failed to load balance');
    } finally {
      setLoading(false);
    }
  }, [onCritical]);

  useEffect(() => { load(); }, [load]);

  if (!data?.paystackConfigured) {
    return (
      <div className={`rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-zinc-500">
          <Shield size={16} />
          <span className="text-sm">Paystack not configured</span>
        </div>
      </div>
    );
  }

  const ngn       = data.ngnSummary;
  const isCritical = ngn?.critical;
  const isWarning  = ngn?.warning && !isCritical;
  const isHealthy  = ngn && !ngn.warning;

  const statusColor = isCritical ? 'border-red-500/50 bg-red-950/20'
    : isWarning ? 'border-amber-500/50 bg-amber-950/20'
    : 'border-emerald-500/30 bg-emerald-950/10';

  const badgeColor = isCritical ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : isWarning ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

  const Icon = isCritical ? XCircle : isWarning ? AlertTriangle : CheckCircle;
  const iconColor = isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';

  if (compact) {
    return (
      <div className={`rounded-lg border ${statusColor} p-3 flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          <Icon size={16} className={iconColor} />
          <span className="text-xs text-zinc-400">Paystack NGN</span>
          {loading ? (
            <div className="w-4 h-4 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          ) : (
            <span className={`text-sm font-semibold ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
              {ngn ? fmt(ngn.available) : '—'}
            </span>
          )}
        </div>
        <button onClick={() => load(true)} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Refresh balance">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${statusColor} p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Banknote size={18} className="text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-300">Paystack Balance</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeColor}`}>
            {isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'HEALTHY'}
          </span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
          title="Force refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <div className="w-4 h-4 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          Loading balance…
        </div>
      ) : ngn ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Available</p>
              <p className={`text-lg font-bold ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
                {fmt(ngn.available)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Pending Withdrawals</p>
              <p className="text-lg font-bold text-zinc-300">{fmt(ngn.pending)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5 flex items-center gap-1">
                <TrendingDown size={11} />Projected
              </p>
              <p className={`text-lg font-bold ${ngn.projected < 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                {fmt(ngn.projected)}
              </p>
            </div>
          </div>

          {/* Thresholds bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Balance Health</span>
              <span>Critical @ ₦{(data.thresholds.critical / 1000).toFixed(0)}k | Warning @ ₦{(data.thresholds.warning / 1000).toFixed(0)}k</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (ngn.available / (data.thresholds.warning * 4)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="space-y-1.5">
              {data.warnings.map((w, i) => (
                <div key={i} className={`text-xs px-3 py-2 rounded-lg border flex items-start gap-2 ${
                  w.level === 'critical'
                    ? 'text-red-300 bg-red-500/10 border-red-500/20'
                    : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                }`}>
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  {w.message}
                </div>
              ))}
            </div>
          )}

          {/* Last fetched */}
          {lastRefresh && (
            <div className="flex items-center gap-1 text-xs text-zinc-600">
              <Clock size={11} />
              Updated {lastRefresh.toLocaleTimeString()}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Balance data unavailable</p>
      )}
    </div>
  );
}
