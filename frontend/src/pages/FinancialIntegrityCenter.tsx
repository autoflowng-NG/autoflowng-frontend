/**
 * AutoFlowNG — Financial Integrity Center (Phase 10D)
 *
 * Unified dashboard for financial health monitoring:
 *   - Paystack balance intelligence
 *   - Wallet health (total liquidity, frozen wallets, anomalies)
 *   - Payout pipeline health (pending, failures, risk withdrawals)
 *   - Referral ecosystem integrity
 *   - Fraud risk scores
 *   - Operational alerts
 */

import { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Banknote, Users, TrendingDown, TrendingUp, Lock, Unlock,
  Activity, Eye, DollarSign, Zap,
} from 'lucide-react';
import PaystackBalanceWidget from '../components/PaystackBalanceWidget';
import OperationalAlertsBadge from '../components/OperationalAlertsBadge';

function fmt(n: number) {
  return '₦' + (n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n: string | number) {
  return parseInt(String(n) || '0').toLocaleString();
}

interface OverviewData {
  generatedAt: string;
  paystackBalance: any;
  fraud: any;
  walletHealth: any;
  payoutHealth: any;
  referralHealth: any;
  frozenWallets: any[];
  suspiciousWithdrawals: any[];
  openInvestigations: any;
  mfaHealth: any;
  activeAlerts: any[];
}

type Tab = 'overview' | 'paystack' | 'wallets' | 'payouts' | 'fraud' | 'referrals' | 'alerts';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',   icon: Activity },
  { id: 'paystack',  label: 'Paystack',   icon: Banknote },
  { id: 'wallets',   label: 'Wallets',    icon: DollarSign },
  { id: 'payouts',   label: 'Payouts',    icon: TrendingUp },
  { id: 'fraud',     label: 'Fraud Risk', icon: Shield },
  { id: 'referrals', label: 'Referrals',  icon: Users },
  { id: 'alerts',    label: 'Alerts',     icon: AlertTriangle },
];

function StatCard({
  label, value, sub, color = 'text-zinc-200', icon: Icon,
}: { label: string; value: string | number; sub?: string; color?: string; icon?: React.ElementType }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        {Icon && <Icon size={14} className="text-zinc-500" />}
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function AlertRow({ alert }: { alert: any }) {
  const isC = alert.severity === 'critical';
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${isC ? 'border-red-500/30 bg-red-950/20' : 'border-amber-500/30 bg-amber-950/20'}`}>
      <AlertTriangle size={14} className={isC ? 'text-red-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isC ? 'text-red-300' : 'text-amber-300'}`}>{alert.title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{alert.message}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${
        isC ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      }`}>{alert.severity.toUpperCase()}</span>
    </div>
  );
}

export default function FinancialIntegrityCenter() {
  const [overview, setOverview]   = useState<OverviewData | null>(null);
  const [tabData, setTabData]     = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading]     = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [alerts, setAlerts]       = useState<any[]>([]);

  const token = localStorage.getItem('autoflowng_token');
  const headers = { Authorization: `Bearer ${token}` };

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/financial-integrity/overview', { headers });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setOverview(d);
      setAlerts(d.activeAlerts || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadTab(tab: Tab) {
    if (tab === 'overview') { loadOverview(); return; }
    setTabLoading(true);
    const endpointMap: Partial<Record<Tab, string>> = {
      paystack:  '/api/financial-integrity/paystack-balance',
      wallets:   '/api/financial-integrity/wallet-health',
      payouts:   '/api/financial-integrity/payout-health',
      fraud:     '/api/financial-integrity/fraud-risk',
      referrals: '/api/financial-integrity/referral-health',
      alerts:    '/api/operational-alerts?resolved=false',
    };
    const endpoint = endpointMap[tab];
    if (!endpoint) { setTabLoading(false); return; }
    try {
      const r = await fetch(endpoint, { headers });
      if (!r.ok) throw new Error(await r.text());
      setTabData(await r.json());
    } catch (e: any) { setTabData({ error: e?.message ?? 'Failed to load data' }); }
    finally { setTabLoading(false); }
  }

  useEffect(() => { loadOverview(); }, []);
  useEffect(() => { if (activeTab !== 'overview') loadTab(activeTab); }, [activeTab]);

  async function checkAlerts() {
    try {
      const r = await fetch('/api/operational-alerts/check', { method: 'POST', headers });
      if (r.ok) loadOverview();
    } catch (_) {}
  }

  async function resolveAlert(id: number) {
    try {
      await fetch(`/api/operational-alerts/${id}/resolve`, { method: 'PATCH', headers });
      loadOverview();
    } catch (_) {}
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={20} className="text-amber-400" />
              <h1 className="text-xl font-bold text-white">Financial Integrity Center</h1>
            </div>
            <p className="text-sm text-zinc-500">
              Platform-wide financial health, fraud monitoring, and operational alerts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <OperationalAlertsBadge onClick={() => setActiveTab('alerts')} />
            <button
              onClick={checkAlerts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 transition-colors"
            >
              <Zap size={13} />
              Run Alert Check
            </button>
            <button
              onClick={loadOverview}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Active Alerts Banner */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.slice(0, 3).map(a => (
              <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                a.severity === 'critical' ? 'border-red-500/40 bg-red-950/20' : 'border-amber-500/40 bg-amber-950/20'
              }`}>
                <AlertTriangle size={16} className={a.severity === 'critical' ? 'text-red-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${a.severity === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>{a.title}</p>
                  <p className="text-xs text-zinc-500">{a.message}</p>
                </div>
                <button onClick={() => resolveAlert(a.id)} className="text-xs text-zinc-500 hover:text-zinc-300 flex-shrink-0 px-2 py-1 border border-zinc-700 rounded hover:border-zinc-500 transition-colors">
                  Resolve
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500 py-12 justify-center">
            <RefreshCw size={16} className="animate-spin" />
            Loading financial integrity data…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-red-300 text-sm">{error}</div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-6">
                {/* Paystack Balance */}
                <PaystackBalanceWidget className="w-full" />

                {/* KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    icon={DollarSign}
                    label="Total Wallet Liquidity"
                    value={fmt(parseFloat(overview.walletHealth?.total_available || 0))}
                    sub={`${fmtNum(overview.walletHealth?.total_wallets)} wallets`}
                  />
                  <StatCard
                    icon={Lock}
                    label="Frozen Wallets"
                    value={fmtNum(overview.walletHealth?.frozen_wallets)}
                    color={parseInt(overview.walletHealth?.frozen_wallets) > 0 ? 'text-amber-400' : 'text-emerald-400'}
                    sub="require manual review"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Pending Payouts"
                    value={fmt(parseFloat(overview.payoutHealth?.pending_amount || 0))}
                    sub={`${fmtNum(overview.payoutHealth?.pending_count)} pending`}
                    color={parseInt(overview.payoutHealth?.pending_count) > 5 ? 'text-amber-400' : 'text-zinc-200'}
                  />
                  <StatCard
                    icon={Shield}
                    label="Open Fraud Flags"
                    value={fmtNum(overview.openInvestigations?.open_flags)}
                    color={parseInt(overview.openInvestigations?.critical) > 0 ? 'text-red-400' : parseInt(overview.openInvestigations?.open_flags) > 0 ? 'text-amber-400' : 'text-emerald-400'}
                    sub={`${fmtNum(overview.openInvestigations?.critical)} critical`}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard icon={XCircle} label="Failed Transfers" value={fmtNum(overview.payoutHealth?.failed_transfers)} color={parseInt(overview.payoutHealth?.failed_transfers) > 0 ? 'text-red-400' : 'text-emerald-400'} />
                  <StatCard icon={Users} label="Referrals Fraud Flagged" value={fmtNum(overview.referralHealth?.fraud_flagged)} color={parseInt(overview.referralHealth?.fraud_flagged) > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                  <StatCard icon={Activity} label="MFA Failures (24h)" value={fmtNum(overview.mfaHealth?.failures_24h)} color={parseInt(overview.mfaHealth?.failures_24h) > 10 ? 'text-red-400' : 'text-zinc-200'} />
                  <StatCard icon={TrendingDown} label="Suspicious Withdrawals" value={overview.suspiciousWithdrawals?.length || 0} color={overview.suspiciousWithdrawals?.length > 0 ? 'text-amber-400' : 'text-emerald-400'} sub="fraud score ≥40, pending" />
                </div>

                {/* Frozen Wallets */}
                {overview.frozenWallets?.length > 0 && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2"><Lock size={14} />Frozen Wallets</h3>
                    <div className="space-y-2">
                      {overview.frozenWallets.slice(0, 5).map((w: any) => (
                        <div key={w.user_id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="text-zinc-300">{w.name || w.email}</span>
                            <span className="text-zinc-600 ml-2">{w.frozen_reason}</span>
                          </div>
                          <span className="text-amber-400 font-semibold">{fmt(parseFloat(w.available_balance))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PAYSTACK TAB */}
            {activeTab === 'paystack' && (
              <div className="space-y-4">
                <PaystackBalanceWidget className="w-full" />
                {tabLoading ? (
                  <div className="flex items-center gap-2 text-zinc-500 text-sm"><RefreshCw size={14} className="animate-spin" />Loading history…</div>
                ) : tabData?.history?.length > 0 && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-3">Balance History</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-zinc-400">
                        <thead><tr className="border-b border-zinc-800 text-zinc-500">
                          <th className="text-left py-2 pr-4">Time</th>
                          <th className="text-right py-2 pr-4">Available</th>
                          <th className="text-right py-2 pr-4">Pending</th>
                          <th className="text-right py-2">Projected</th>
                        </tr></thead>
                        <tbody>{tabData.history.slice(0, 20).map((s: any, i: number) => (
                          <tr key={i} className="border-b border-zinc-900">
                            <td className="py-1.5 pr-4">{new Date(s.created_at).toLocaleString()}</td>
                            <td className={`text-right pr-4 ${s.threshold_critical ? 'text-red-400' : s.threshold_warning ? 'text-amber-400' : 'text-emerald-400'}`}>{fmt(parseFloat(s.available_balance))}</td>
                            <td className="text-right pr-4">{fmt(parseFloat(s.pending_withdrawals))}</td>
                            <td className={`text-right ${parseFloat(s.projected_balance) < 0 ? 'text-red-400' : 'text-zinc-300'}`}>{fmt(parseFloat(s.projected_balance))}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* WALLETS TAB */}
            {activeTab === 'wallets' && (
              <div className="space-y-4">
                {tabLoading ? (
                  <div className="flex items-center gap-2 text-zinc-500"><RefreshCw size={14} className="animate-spin" />Loading…</div>
                ) : tabData && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <StatCard label="Total Wallets" value={fmtNum(tabData.stats?.total_wallets)} icon={DollarSign} />
                      <StatCard label="Frozen Wallets" value={fmtNum(tabData.stats?.frozen_wallets)} color="text-amber-400" icon={Lock} />
                      <StatCard label="High Balance Wallets" value={fmtNum(tabData.stats?.high_balance_wallets)} sub="balance >₦50k" icon={TrendingUp} />
                      <StatCard label="Total Liquidity" value={fmt(parseFloat(tabData.stats?.total_liquidity || 0))} icon={Banknote} />
                      <StatCard label="Max Balance" value={fmt(parseFloat(tabData.stats?.max_balance || 0))} icon={TrendingUp} />
                      <StatCard label="Avg Balance" value={fmt(parseFloat(tabData.stats?.avg_balance || 0))} icon={Activity} />
                    </div>
                    {tabData.frozen?.length > 0 && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                        <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2"><Lock size={14} />Frozen Wallets ({tabData.frozen.length})</h3>
                        <div className="space-y-2">
                          {tabData.frozen.map((w: any) => (
                            <div key={w.user_id} className="flex items-center justify-between text-sm border-b border-zinc-800 pb-2 last:border-0">
                              <div>
                                <p className="text-zinc-300">{w.name || w.email}</p>
                                <p className="text-xs text-zinc-600">{w.frozen_reason}</p>
                              </div>
                              <span className="text-amber-400 font-semibold">{fmt(parseFloat(w.available_balance))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ALERTS TAB */}
            {activeTab === 'alerts' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-300">Operational Alerts</h3>
                  <button onClick={checkAlerts} className="flex items-center gap-1.5 text-xs text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors">
                    <Zap size={12} />Run Check
                  </button>
                </div>
                {tabLoading ? (
                  <div className="flex items-center gap-2 text-zinc-500"><RefreshCw size={14} className="animate-spin" />Loading…</div>
                ) : tabData?.alerts?.length > 0 ? (
                  tabData.alerts.map((a: any) => (
                    <div key={a.id} className={`flex items-start gap-3 p-4 rounded-xl border ${a.severity === 'critical' ? 'border-red-500/30 bg-red-950/20' : 'border-amber-500/30 bg-amber-950/20'}`}>
                      <AlertTriangle size={16} className={a.severity === 'critical' ? 'text-red-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-sm font-semibold ${a.severity === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>{a.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${a.severity === 'critical' ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-amber-500/30 text-amber-400 bg-amber-500/10'}`}>{a.severity}</span>
                        </div>
                        <p className="text-xs text-zinc-400">{a.message}</p>
                        <p className="text-xs text-zinc-600 mt-1">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                      <button
                        onClick={async () => {
                          await resolveAlert(a.id);
                          loadTab('alerts');
                        }}
                        className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 rounded px-2 py-1 transition-colors flex-shrink-0"
                      >
                        Resolve
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 py-8 justify-center text-zinc-500">
                    <CheckCircle size={16} className="text-emerald-500" />
                    No unresolved operational alerts
                  </div>
                )}
              </div>
            )}

            {/* Generic tab content for other tabs */}
            {['payouts', 'fraud', 'referrals'].includes(activeTab) && (
              tabLoading ? (
                <div className="flex items-center gap-2 text-zinc-500"><RefreshCw size={14} className="animate-spin" />Loading {activeTab} data…</div>
              ) : tabData ? (
                <pre className="text-xs text-zinc-500 bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 overflow-auto max-h-96">
                  {JSON.stringify(tabData, null, 2)}
                </pre>
              ) : null
            )}
          </>
        )}
      </div>
    </div>
  );
}
