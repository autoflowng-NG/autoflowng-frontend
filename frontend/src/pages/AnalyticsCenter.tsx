/**
 * AutoFlowNG — Phase 14 Analytics Center
 * Enterprise Automation Command Center — full analytics dashboard.
 *
 * Route: /analytics
 * Preserves existing cinematic design language.
 */

import React, { useState, useCallback } from 'react';
import {
  useExecutionSummary,
  useExecutionVolume,
  useThroughput,
  useWorkflowRankings,
  useBottlenecks,
  useIntegrationSummary,
  useErrorHeatmap,
  useTopErrorCauses,
  useHealthScores,
  useHealthTrend,
  useForecasts,
  analyticsApi,
} from '../api/analyticsApi';
import { ExecutionVolumeChart, SuccessRateChart, ThroughputChart, DurationChart } from '../components/analytics/ExecutionCharts';
import { WorkflowRankingsTable, BottleneckList } from '../components/analytics/WorkflowRankings';
import { IntegrationUsageChart, IntegrationErrorRateChart, IntegrationUsageRanking } from '../components/analytics/IntegrationUsage';
import { ErrorHeatmap, TopErrorCausesList } from '../components/analytics/ErrorHeatmap';
import { ForecastGrid } from '../components/analytics/ForecastChart';
import { OperationalHealthPanel, HealthTrendChart, StatCard } from '../components/analytics/HealthScoreWidgets';

// ── Layout primitives ─────────────────────────────────────────────────────────
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({
  title, children, className = '',
}) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
    {title && (
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
    )}
    {children}
  </div>
);

const Skeleton: React.FC<{ h?: string }> = ({ h = 'h-40' }) => (
  <div className={`${h} bg-slate-800 rounded-lg animate-pulse`} />
);

const ErrorState: React.FC<{ error: string }> = ({ error }) => (
  <div className="flex items-center gap-2 text-red-400 text-xs p-4 bg-red-950/30 rounded-lg border border-red-900">
    <span>⚠</span>
    <span>{error}</span>
  </div>
);

// ── Period selector ───────────────────────────────────────────────────────────
type Period = 'hourly' | 'daily' | 'weekly' | 'monthly';
const PERIODS: Period[] = ['hourly', 'daily', 'weekly', 'monthly'];

const PeriodSelector: React.FC<{ value: Period; onChange: (p: Period) => void }> = ({ value, onChange }) => (
  <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
    {PERIODS.map(p => (
      <button
        key={p}
        onClick={() => onChange(p)}
        className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
          value === p
            ? 'bg-indigo-600 text-white shadow'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {p}
      </button>
    ))}
  </div>
);

// ── Tab system ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',      label: 'Overview'        },
  { id: 'workflows',     label: 'Workflows'        },
  { id: 'integrations',  label: 'Integrations'     },
  { id: 'errors',        label: 'Errors'           },
  { id: 'intelligence',  label: 'Intelligence'     },
  { id: 'forecasts',     label: 'Forecasts'        },
] as const;
type Tab = (typeof TABS)[number]['id'];

// ── Main Component ────────────────────────────────────────────────────────────
export default function AnalyticsCenter() {
  const [activeTab,  setActiveTab]  = useState<Tab>('overview');
  const [period,     setPeriod]     = useState<Period>('daily');
  const [computing,  setComputing]  = useState(false);

  const summary      = useExecutionSummary(30);
  const volume       = useExecutionVolume(period);
  const throughput   = useThroughput();
  const rankings     = useWorkflowRankings('health_score');
  const bottlenecks  = useBottlenecks();
  const integrations = useIntegrationSummary(30);
  const heatmap      = useErrorHeatmap();
  const topErrors    = useTopErrorCauses(30);
  const health       = useHealthScores();
  const healthTrend  = useHealthTrend(30);
  const forecasts    = useForecasts();

  const recomputeAll = useCallback(async () => {
    setComputing(true);
    try {
      await Promise.all([
        analyticsApi.computeForecasts(),
        analyticsApi.computeIntelligence(),
      ]);
      window.location.reload();
    } finally {
      setComputing(false);
    }
  }, []);

  const s = summary.data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Header ── */}
      <div className="border-b border-slate-800 bg-slate-900/50 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Analytics Center
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Enterprise Automation Intelligence — last 30 days
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PeriodSelector value={period} onChange={setPeriod} />
              <button
                onClick={recomputeAll}
                disabled={computing}
                className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                           text-white rounded-lg transition-colors"
              >
                {computing ? 'Computing…' : 'Refresh Intelligence'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'text-indigo-400 border-indigo-500 bg-slate-800/50'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {summary.loading ? Array(6).fill(null).map((_, i) => <Skeleton key={i} h="h-24" />) : s ? (
                <>
                  <StatCard label="Total Executions"  value={s.total_executions?.toLocaleString() ?? '—'} color="#6366f1" />
                  <StatCard label="Success Rate"       value={`${s.success_rate ?? 0}%`}                  color="#10b981" />
                  <StatCard label="Total Failures"     value={s.total_failures?.toLocaleString() ?? '—'}  color="#ef4444" />
                  <StatCard label="Avg Duration"       value={s.avg_duration_ms ? `${(s.avg_duration_ms/1000).toFixed(1)}s` : '—'} color="#8b5cf6" />
                  <StatCard label="P95 Duration"       value={s.p95_ms ? `${(s.p95_ms/1000).toFixed(1)}s` : '—'}         color="#f59e0b" />
                  <StatCard label="Active Workflows"   value={s.active_workflows?.toLocaleString() ?? '—'} color="#06b6d4" />
                </>
              ) : null}
              {summary.error && <ErrorState error={summary.error} />}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Execution Volume">
                {volume.loading ? <Skeleton /> : volume.data ? <ExecutionVolumeChart data={volume.data} /> : null}
                {volume.error && <ErrorState error={volume.error} />}
              </Card>
              <Card title="Success Rate Trend">
                {volume.loading ? <Skeleton h="h-48" /> : volume.data ? <SuccessRateChart data={volume.data} /> : null}
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Hourly Throughput (48h)">
                {throughput.loading ? <Skeleton h="h-48" /> : throughput.data ? <ThroughputChart data={throughput.data} /> : null}
              </Card>
              <Card title="Execution Duration (Avg & P95)">
                {volume.loading ? <Skeleton h="h-52" /> : volume.data ? <DurationChart data={volume.data} /> : null}
              </Card>
            </div>

            {/* Health summary */}
            {health.data && (
              <Card title="Operational Health">
                <OperationalHealthPanel health={health.data} />
              </Card>
            )}
          </>
        )}

        {/* ── Workflows Tab ── */}
        {activeTab === 'workflows' && (
          <>
            <Card title="Performance Rankings">
              {rankings.loading ? <Skeleton h="h-64" /> : rankings.data
                ? <WorkflowRankingsTable data={rankings.data} />
                : null}
              {rankings.error && <ErrorState error={rankings.error} />}
            </Card>

            <Card title="Detected Bottlenecks">
              {bottlenecks.loading ? <Skeleton h="h-40" /> : bottlenecks.data
                ? <BottleneckList data={bottlenecks.data} />
                : null}
            </Card>
          </>
        )}

        {/* ── Integrations Tab ── */}
        {activeTab === 'integrations' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="API Call Volume (Top 12)">
                {integrations.loading ? <Skeleton h="h-60" /> : integrations.data
                  ? <IntegrationUsageChart data={integrations.data} />
                  : null}
              </Card>
              <Card title="Integration Error Rates">
                {integrations.loading ? <Skeleton h="h-52" /> : integrations.data
                  ? <IntegrationErrorRateChart data={integrations.data} />
                  : null}
              </Card>
            </div>

            {integrations.data && (
              <Card title="Most & Least Used Integrations">
                <IntegrationUsageRanking
                  mostUsed={[...integrations.data].sort((a,b) => Number(b.total_calls)-Number(a.total_calls)).slice(0,5)}
                  leastUsed={[...integrations.data].sort((a,b) => Number(a.total_calls)-Number(b.total_calls)).slice(0,5)}
                />
              </Card>
            )}

            {integrations.data && (
              <Card title="Integration Summary Table">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {['Integration','Total Calls','Total Errors','Error Rate','Avg Latency','Last Used'].map(h => (
                          <th key={h} className="text-left text-slate-500 font-medium py-2 pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {integrations.data.map(i => (
                        <tr key={i.integration} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="py-2 pr-4 text-slate-200 capitalize font-medium">{i.integration.replace('_',' ')}</td>
                          <td className="py-2 pr-4 text-indigo-400">{Number(i.total_calls).toLocaleString()}</td>
                          <td className="py-2 pr-4 text-red-400">{Number(i.total_errors).toLocaleString()}</td>
                          <td className="py-2 pr-4 text-slate-300">{i.error_rate}%</td>
                          <td className="py-2 pr-4 text-slate-300">{i.avg_latency_ms}ms</td>
                          <td className="py-2 pr-4 text-slate-500">{i.last_used_at ? new Date(i.last_used_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── Errors Tab ── */}
        {activeTab === 'errors' && (
          <>
            <Card title="Error Frequency Heatmap">
              {heatmap.loading ? <Skeleton h="h-52" /> : heatmap.data
                ? <ErrorHeatmap data={heatmap.data} />
                : null}
            </Card>

            <Card title="Top Error Causes (30d)">
              {topErrors.loading ? <Skeleton h="h-48" /> : topErrors.data
                ? <TopErrorCausesList data={topErrors.data} />
                : null}
            </Card>
          </>
        )}

        {/* ── Intelligence Tab ── */}
        {activeTab === 'intelligence' && (
          <>
            {health.loading ? <Skeleton h="h-64" /> : health.data ? (
              <Card title="Operational Health Scores">
                <OperationalHealthPanel health={health.data} />
              </Card>
            ) : null}

            {healthTrend.data && (
              <Card title="Health Score Trend (30d)">
                <HealthTrendChart data={healthTrend.data} />
              </Card>
            )}
          </>
        )}

        {/* ── Forecasts Tab ── */}
        {activeTab === 'forecasts' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">
                Statistical forecasts using linear regression + exponential smoothing.
                Confidence scores reflect available data quality.
              </p>
              <button
                onClick={() => analyticsApi.computeForecasts()}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Recompute
              </button>
            </div>
            {forecasts.loading ? <Skeleton h="h-80" /> : forecasts.data
              ? <ForecastGrid data={forecasts.data} />
              : <div className="text-center py-12 text-slate-600">No forecast data. Run workflows first.</div>}
          </>
        )}

      </div>
    </div>
  );
}
