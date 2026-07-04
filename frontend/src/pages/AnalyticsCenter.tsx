/**
 * AutoFlowNG — Analytics Center (Enterprise Redesign)
 *
 * Visual redesign only — all hooks, API calls, and logic preserved exactly.
 * Layout matches the reference design: KPI row, execution chart + top workflows,
 * AI usage donut + performance metrics, tabbed sections below.
 *
 * Design system:
 *   bg: #060810 | surface: #0C0F1A | raised: #111520
 *   border: rgba(255,255,255,0.06)
 *   text: #E2E8FF | muted: rgba(226,232,255,0.45) | faint: rgba(226,232,255,0.22)
 *   green: #00C896 | blue: #38BDF8 | purple: #A78BFA | amber: #FBBF24 | red: #FB7185
 *   Fonts: Syne (headers/values) · DM Sans (body) · DM Mono (labels/badges)
 *
 * Overview tab — restructured per analytics best practices:
 *   REMOVED: "Executions Over Time" — redundant with Dashboard execution charts
 *   REMOVED: "Hourly Throughput" — operational monitoring, not analytics
 *   REMOVED: "Success Rate Trend" — workflow-level version; SuccessRateChart component
 *     is intentionally kept (not deleted) in ExecutionCharts.tsx for potential
 *     reuse in a future per-workflow drill-down view. It is NOT the component
 *     that powers the Content tab's per-post trend — that is PostEngagementChart.
 *   KEPT: Top Workflows ranking, Execution Duration (Avg & P95), Operational Health
 *   Layout: 2-col grid so the 3 remaining panels read as an intentional layout.
 *
 * Content tab (new) — per-post scheduled-content engagement trends.
 *   Post picker (list of recent publishing jobs) + detail panel showing engagement
 *   time series (views/likes/comments/shares) since publish, with elapsed-time x-axis.
 *
 * BUG A FIX: Top Workflows rows are now clickable.
 *   - useNavigate imported from react-router-dom and instantiated in the component.
 *   - Each row has onClick={() => navigate(`/workflow-builder/${wf.workflow_id}`) so tapping
 *     a workflow opens it in the Workflow Builder (same route Dashboard uses for
 *     its "Top Workflows" card: onNav(`/workflow-builder/${wf.id}`)).
 *   - cursor: 'pointer' added to the row style so it's visually clear.
 *   - workflow_name is now returned by the backend (getWorkflowRankings LEFT JOINs
 *     the workflows table), so wf.workflow_name renders the real name instead of
 *     the 'Unnamed' fallback. The fallback chain is preserved as a safety net.
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useExecutionSummary,
  useExecutionVolume,
  useWorkflowRankings,
  useBottlenecks,
  useIntegrationSummary,
  useErrorHeatmap,
  useTopErrorCauses,
  useHealthScores,
  useHealthTrend,
  useForecasts,
  usePostAnalytics,
  analyticsApi,
  type ExecutionSummary,
} from '../api/analyticsApi';
import { useMemo } from 'react';
import { DurationChart } from '../components/analytics/ExecutionCharts';
// SuccessRateChart is intentionally NOT rendered on the Overview tab (see header note above).
// Import is kept here in case a future per-workflow drill-down reuses it.
// import { SuccessRateChart } from '../components/analytics/ExecutionCharts';
import { WorkflowRankingsTable, BottleneckList } from '../components/analytics/WorkflowRankings';
import { IntegrationUsageChart, IntegrationErrorRateChart, IntegrationUsageRanking } from '../components/analytics/IntegrationUsage';
import { ErrorHeatmap, TopErrorCausesList } from '../components/analytics/ErrorHeatmap';
import { ForecastGrid } from '../components/analytics/ForecastChart';
import { OperationalHealthPanel, HealthTrendChart } from '../components/analytics/HealthScoreWidgets';
import PostEngagementChart from '../components/analytics/PostEngagementChart';
import {
  BarChart3, TrendingUp, TrendingDown, Clock, Zap, Activity,
  Download, RefreshCw, GitBranch, AlertTriangle, Brain,
  LineChart, Layers, Bug, Cpu, FileText, ChevronRight,
} from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:      '#060810',
  surface: '#0C0F1A',
  raised:  '#111520',
  border:  'rgba(255,255,255,0.06)',
  borderH: 'rgba(255,255,255,0.11)',
  text:    '#E2E8FF',
  muted:   'rgba(226,232,255,0.45)',
  faint:   'rgba(226,232,255,0.22)',
  green:   '#00C896',
  blue:    '#38BDF8',
  purple:  '#A78BFA',
  amber:   '#FBBF24',
  red:     '#FB7185',
};

/* ── Skeleton ──────────────────────────────────────────────────────── */
function Sk({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'rgba(255,255,255,0.05)',
      animation: 'af-skeleton-pulse 1.8s ease-in-out infinite',
    }} />
  );
}

function SkBlock({ height = 180 }: { height?: number }) {
  return (
    <div style={{
      height, borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      animation: 'af-skeleton-pulse 1.8s ease-in-out infinite',
    }} />
  );
}

/* ── Card wrapper ──────────────────────────────────────────────────── */
function Card({
  children, style = {}, accent,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
}) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
      minWidth: 0,
      ...style,
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
        }} />
      )}
      {children}
    </div>
  );
}

/* ── Section header ────────────────────────────────────────────────── */
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: C.text,
        fontFamily: "'Syne',sans-serif", letterSpacing: '-0.02em',
      }}>
        {title}
      </div>
      {sub && (
        <div style={{
          fontSize: 10, color: C.faint,
          fontFamily: "'DM Mono',monospace", letterSpacing: '0.05em', marginTop: 2,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── Error state ───────────────────────────────────────────────────── */
function ErrorState({ error }: { error: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '12px 14px', borderRadius: 10,
      background: 'rgba(251,113,133,0.06)',
      border: '1px solid rgba(251,113,133,0.18)',
      fontSize: 12, color: C.red,
      fontFamily: "'DM Sans',sans-serif",
    }}>
      <AlertTriangle size={13} />
      {error}
    </div>
  );
}

/* ── Period selector ───────────────────────────────────────────────── */
type Period = 'hourly' | 'daily' | 'weekly' | 'monthly';
const PERIODS: Period[] = ['hourly', 'daily', 'weekly', 'monthly'];

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 2,
      background: C.raised, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: 3,
    }}>
      {PERIODS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: '5px 12px', borderRadius: 7, border: 'none',
            cursor: 'pointer', fontSize: 11, fontWeight: 600,
            fontFamily: "'DM Mono',monospace", letterSpacing: '0.04em',
            textTransform: 'capitalize',
            background: value === p ? C.purple : 'transparent',
            color: value === p ? '#fff' : C.muted,
            transition: 'all 0.14s',
          }}
          onMouseEnter={e => { if (value !== p) (e.currentTarget as HTMLElement).style.color = C.text; }}
          onMouseLeave={e => { if (value !== p) (e.currentTarget as HTMLElement).style.color = C.muted; }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

/* ── Tab system ────────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview',     label: 'Overview',      icon: BarChart3  },
  { id: 'workflows',    label: 'Workflows',     icon: GitBranch  },
  { id: 'integrations', label: 'Integrations',  icon: Layers     },
  { id: 'errors',       label: 'Errors',        icon: Bug        },
  { id: 'intelligence', label: 'Intelligence',  icon: Brain      },
  { id: 'forecasts',    label: 'Forecasts',     icon: LineChart  },
  { id: 'content',      label: 'Content',       icon: FileText   },
] as const;
type Tab = (typeof TABS)[number]['id'];

/* ── KPI Card ──────────────────────────────────────────────────────── */
function KpiCard({
  label, value, change, color, icon: Icon, loading,
}: {
  label: string; value: string; change?: number;
  color: string; icon: any; loading?: boolean;
}) {
  const positive = (change ?? 0) >= 0;
  if (loading) {
    return (
      <Card accent={color}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Sk w={32} h={32} r={8} />
          <Sk w={52} h={20} r={100} />
        </div>
        <Sk w="55%" h={28} r={6} />
        <div style={{ marginTop: 6 }}><Sk w="70%" h={11} /></div>
      </Card>
    );
  }
  return (
    <Card accent={color}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `${color}12`, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} color={color} />
        </div>
        {change !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 700,
            color: positive ? C.green : C.red,
            background: positive ? 'rgba(0,200,150,0.08)' : 'rgba(251,113,133,0.08)',
            borderRadius: 100, padding: '3px 8px',
            fontFamily: "'DM Mono',monospace",
          }}>
            {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div style={{
        fontSize: '1.65rem', fontWeight: 900,
        fontFamily: "'Syne',sans-serif", letterSpacing: '-0.04em',
        color: C.text, lineHeight: 1,
      }}>
        {value ?? '—'}
      </div>
      <div style={{
        fontSize: 11, color: C.muted, marginTop: 5,
        fontFamily: "'DM Sans',sans-serif",
      }}>
        {label}
      </div>
    </Card>
  );
}

/* ── Integration summary table ─────────────────────────────────────── */
function IntegrationTable({ data }: { data: any[] }) {
  const cols = ['Integration', 'Total Calls', 'Errors', 'Error Rate', 'Avg Latency', 'Last Used'];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {cols.map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '8px 14px 8px 0',
                fontSize: 10, fontWeight: 700, color: C.faint,
                fontFamily: "'DM Mono',monospace", letterSpacing: '0.06em',
                borderBottom: `1px solid ${C.border}`,
              }}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(i => (
            <tr
              key={i.integration}
              style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <td style={{ padding: '12px 14px 12px 0', color: C.text, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", textTransform: 'capitalize' }}>
                {i.integration.replace('_', ' ')}
              </td>
              <td style={{ padding: '12px 14px 12px 0', color: C.purple, fontFamily: "'DM Mono',monospace" }}>
                {Number(i.total_calls).toLocaleString()}
              </td>
              <td style={{ padding: '12px 14px 12px 0', color: C.red, fontFamily: "'DM Mono',monospace" }}>
                {Number(i.total_errors).toLocaleString()}
              </td>
              <td style={{ padding: '12px 14px 12px 0', color: C.muted, fontFamily: "'DM Mono',monospace" }}>
                {i.error_rate}%
              </td>
              <td style={{ padding: '12px 14px 12px 0', color: C.muted, fontFamily: "'DM Mono',monospace" }}>
                {i.avg_latency_ms}ms
              </td>
              <td style={{ padding: '12px 14px 12px 0', color: C.faint, fontFamily: "'DM Mono',monospace" }}>
                {i.last_used_at ? new Date(i.last_used_at).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Content Tab — Post Picker + Engagement Detail ─────────────────── */
function ContentTab() {
  const [jobs, setJobs]         = React.useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = React.useState(true);
  const [jobsError, setJobsError]     = React.useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = React.useState<number | null>(null);

  const postAnalytics = usePostAnalytics(selectedJobId);

  // Load the publishing jobs list
  React.useEffect(() => {
    const token = localStorage.getItem('autoflowng_token');
    const BASE = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '') + '/api';
    fetch(`${BASE}/publishing/jobs?limit=30`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`API ${r.status}`)))
      .then(json => {
        const list: any[] = json.jobs ?? json.data ?? [];
        setJobs(list);
        // Auto-select first published job
        const first = list.find(j => j.status === 'completed' || j.status === 'published') || list[0];
        if (first) setSelectedJobId(Number(first.id));
      })
      .catch(e => setJobsError(e.message))
      .finally(() => setJobsLoading(false));
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const platformBadge = (platforms: string[]) => (
    <div style={{ display: 'flex', gap: 4 }}>
      {(platforms || []).map(p => (
        <span key={p} style={{
          fontSize: 9, fontWeight: 700, color: C.blue,
          background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 4, padding: '2px 5px',
          fontFamily: "'DM Mono',monospace", letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {p}
        </span>
      ))}
    </div>
  );

  return (
    <div className="af-an-content-grid" style={{
      display: 'grid',
      gridTemplateColumns: '300px minmax(0,1fr)',
      gap: 16, alignItems: 'start',
    }}>
      {/* Post picker */}
      <Card accent={C.blue} style={{ padding: 0 }}>
        <div style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <SectionHeader title="Published Posts" sub="SELECT A POST TO VIEW ITS TREND" />
        </div>

        {jobsLoading && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <SkBlock key={i} height={56} />)}
          </div>
        )}

        {jobsError && (
          <div style={{ padding: 16 }}>
            <ErrorState error={jobsError} />
          </div>
        )}

        {!jobsLoading && !jobsError && jobs.length === 0 && (
          <div style={{
            padding: '32px 16px', textAlign: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: C.raised, border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <FileText size={16} color={C.faint} />
            </div>
            <p style={{
              fontSize: 13, fontWeight: 600, color: C.muted,
              fontFamily: "'DM Sans',sans-serif", marginBottom: 6,
            }}>
              No posts yet
            </p>
            <p style={{
              fontSize: 11, color: C.faint,
              fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5,
            }}>
              Schedule your first post via Media Cloud → Asset Details → Schedule / Post
            </p>
          </div>
        )}

        {!jobsLoading && jobs.length > 0 && (
          <div style={{ maxHeight: 480, overflowY: 'auto', padding: '4px 0' }}>
            {jobs.map(job => {
              const isSelected = selectedJobId === Number(job.id);
              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJobId(Number(job.id))}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderLeft: isSelected ? `3px solid ${C.blue}` : '3px solid transparent',
                    background: isSelected ? 'rgba(56,189,248,0.05)' : 'transparent',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: isSelected ? C.text : C.muted,
                    fontFamily: "'DM Sans',sans-serif",
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 5,
                  }}>
                    {job.title || `Post #${job.id}`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    {platformBadge(job.target_platforms || [])}
                    <span style={{
                      fontSize: 9, color: C.faint,
                      fontFamily: "'DM Mono',monospace",
                      flexShrink: 0,
                    }}>
                      {formatDate(job.created_at)}
                    </span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: job.status === 'completed' ? C.green : job.status === 'failed' ? C.red : C.amber,
                      fontFamily: "'DM Mono',monospace", textTransform: 'uppercase',
                    }}>
                      {job.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Engagement detail panel */}
      <Card accent={C.blue}>
        {!selectedJobId && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: 320, gap: 12,
          }}>
            <ChevronRight size={24} color={C.faint} />
            <p style={{
              fontSize: 13, color: C.faint,
              fontFamily: "'DM Sans',sans-serif",
            }}>
              Select a post on the left to view its engagement trend
            </p>
          </div>
        )}

        {selectedJobId && postAnalytics.loading && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
              {[0,1,2,3].map(i => <SkBlock key={i} height={56} />)}
            </div>
            <SkBlock height={220} />
          </>
        )}

        {selectedJobId && postAnalytics.error && (
          <ErrorState error={postAnalytics.error} />
        )}

        {selectedJobId && postAnalytics.data && !postAnalytics.loading && (() => {
          const d = postAnalytics.data;
          return (
            <>
              <div style={{ marginBottom: 20 }}>
                <SectionHeader
                  title={d.job.title || `Post #${d.job.id}`}
                  sub={`${(d.job.target_platforms || []).join(' · ').toUpperCase()} · PUBLISHED ${d.job.completed_at ? new Date(d.job.completed_at).toLocaleDateString() : '—'}`}
                />
              </div>
              <PostEngagementChart data={d} />
            </>
          );
        })()}
      </Card>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */
export default function AnalyticsCenter() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [period,    setPeriod]    = useState<Period>('daily');
  const [computing, setComputing] = useState(false);

  // BUG A FIX: useNavigate for row click navigation to workflow detail pages.
  const navigate = useNavigate();

  // All hooks preserved exactly
  const summary      = useExecutionSummary(30);
  // Fetch previous 60-day window to derive real period-over-period change %
  const summaryPrev  = useExecutionSummary(60);
  // Fetch dashboard root for ai_requests count — both windows for change %
  const [aiRequests, setAiRequests] = React.useState<number | null>(null);
  const [aiRequestsPrev, setAiRequestsPrev] = React.useState<number | null>(null);
  React.useEffect(() => {
    Promise.all([
      analyticsApi.getDashboardSummary('30d'),
      analyticsApi.getDashboardSummary('60d'),
    ]).then(([curr, prev]) => {
      const currAi = curr.ai_requests ?? null;
      const prevAi = prev.ai_requests ?? null;
      setAiRequests(currAi);
      // prior 30d = 60d total minus current 30d
      setAiRequestsPrev(prevAi != null && currAi != null ? prevAi - currAi : null);
    }).catch(() => {});
  }, []);
  // FIX (Bug B): map each period to a sensible default window so "today" is
  // always in the data and the chart doesn't span an unnecessarily wide range.
  // The 'days' override here is independent of the lookback defaults hardcoded
  // inside getExecutionVolume — it lets the frontend control the window without
  // requiring a backend change for each period selection.
  const PERIOD_DAYS: Record<string, number> = { hourly: 3, daily: 7, weekly: 84, monthly: 365 };
  const volume       = useExecutionVolume(period, PERIOD_DAYS[period] ?? 7);
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

  const s  = summary.data;
  const sp = summaryPrev.data;

  // Compute real period-over-period change % (current 30d vs prior 30d window)
  // summaryPrev covers 60 days; we approximate "prior 30d" values as (60d total - current 30d)
  function pctChange(curr: number | undefined | null, prev60: number | undefined | null): number | undefined {
    if (!curr || !prev60) return undefined;
    const prior = prev60 - curr;
    if (prior <= 0) return undefined;
    return Math.round(((curr - prior) / prior) * 1000) / 10; // one decimal
  }

  const execChange     = pctChange(s?.total_executions, sp?.total_executions);
  const aiChange       = pctChange(aiRequests, aiRequestsPrev != null && aiRequests != null ? aiRequestsPrev + aiRequests : null);
  const rateChange     = pctChange(s?.success_rate,     sp?.success_rate);
  const durationPrev  = sp && s ? sp.avg_duration_ms - s.avg_duration_ms : undefined;
  const durationChange = (s?.avg_duration_ms != null && durationPrev != null && durationPrev > 0)
    ? Math.round(((s.avg_duration_ms - durationPrev) / durationPrev) * 1000) / 10
    : undefined;

  // Dynamic date range label: today minus 30 days → today
  // GAP 1 FIX: fmt previously used toLocaleDateString() with no timeZone, converting the
  // UTC-aligned bucket boundary into the browser's local timezone before display. For users
  // behind UTC this renders the start/end of a UTC-anchored range as the previous local day.
  // Fix: pass timeZone:'UTC' so the label reflects the same UTC day the backend uses.
  // (Non-bucket timestamps like last_used_at / completed_at are intentionally left local.)
  const dateRangeLabel = useMemo(() => {
    const now   = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return `${fmt(start)} – ${fmt(now)}`;
  }, []);

  // Derived KPI values — all from live API data, no hardcoded numbers
  const kpis = [
    {
      label: 'Total Executions',
      value: s?.total_executions?.toLocaleString() ?? '—',
      change: execChange,
      color: C.purple,
      icon: Activity,
    },
    {
      label: 'Success Rate',
      value: s?.success_rate != null ? `${s.success_rate}%` : '—',
      change: rateChange,
      color: C.green,
      icon: TrendingUp,
    },
    {
      label: 'Avg Execution Time',
      value: s?.avg_duration_ms != null ? `${(s.avg_duration_ms / 1000).toFixed(2)}s` : '—',
      change: durationChange,
      color: C.blue,
      icon: Clock,
    },
    {
      label: 'AI Credits Used',
      value: aiRequests != null ? aiRequests.toLocaleString() : '—',
      change: aiChange,
      color: C.amber,
      icon: Zap,
    },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100%' }}>

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(6,8,16,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 32px 0' }}>

          {/* Title row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16, flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.purple,
                fontFamily: "'DM Mono',monospace", letterSpacing: '0.1em', marginBottom: 6,
              }}>
                INSIGHTS
              </div>
              <h1 style={{
                fontSize: 'clamp(1.5rem,2.5vw,2rem)', fontWeight: 900,
                fontFamily: "'Syne',sans-serif", letterSpacing: '-0.04em',
                color: C.text, margin: 0, lineHeight: 1,
              }}>
                Analytics Center
              </h1>
              <p style={{
                fontSize: 12, color: C.muted, marginTop: 5,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                Enterprise Automation Intelligence — last 30 days
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Date range pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '7px 13px',
                fontSize: 12, color: C.muted, fontFamily: "'DM Sans',sans-serif",
              }}>
                <Clock size={12} color={C.muted} />
                {dateRangeLabel}
              </div>

              <PeriodSelector value={period} onChange={setPeriod} />

              {/* Export button */}
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: C.purple, border: 'none',
                  borderRadius: 10, padding: '8px 16px',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                  transition: 'opacity 0.14s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              >
                <Download size={13} />
                Export Report
              </button>

              {/* Refresh intelligence */}
              <button
                onClick={recomputeAll}
                disabled={computing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '8px 14px',
                  color: C.muted, fontSize: 12, fontWeight: 600,
                  cursor: computing ? 'wait' : 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  opacity: computing ? 0.6 : 1,
                  transition: 'all 0.14s',
                }}
                onMouseEnter={e => { if (!computing) (e.currentTarget as HTMLElement).style.color = C.text; }}
                onMouseLeave={e => { if (!computing) (e.currentTarget as HTMLElement).style.color = C.muted; }}
              >
                <RefreshCw size={12} style={{ animation: computing ? 'spin 1s linear infinite' : 'none' }} />
                {computing ? 'Computing…' : 'Refresh Intelligence'}
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
                    padding: '9px 16px', border: 'none', cursor: 'pointer',
                    background: active ? 'rgba(167,139,250,0.1)' : 'transparent',
                    color: active ? C.purple : C.muted,
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    fontFamily: "'DM Sans',sans-serif",
                    borderRadius: '8px 8px 0 0',
                    borderBottom: active ? `2px solid ${C.purple}` : '2px solid transparent',
                    marginBottom: -1,
                    transition: 'all 0.14s',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.text; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.muted; }}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Page content ── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <>
            {/* KPI row — 4 cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
            }}>
              {kpis.map(kpi => (
                <KpiCard
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  change={kpi.change}
                  color={kpi.color}
                  icon={kpi.icon}
                  loading={summary.loading}
                />
              ))}
            </div>
            {summary.error && <ErrorState error={summary.error} />}

            {/*
              Overview panels — 2-column grid.
              Row 1: Top Workflows (left) + Execution Duration (right)
              Row 2: Operational Health (full-width)
              Panels removed from here (not deleted from codebase):
                - "Executions Over Time" — duplicates Dashboard execution charts
                - "Hourly Throughput" — operational monitoring, not analytics
                - "Success Rate Trend" — use SuccessRateChart in a future per-workflow drill-down
            */}
            <div className="af-an-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>

              {/* Top Workflows ranked list */}
              <Card accent={C.green}>
                <SectionHeader title="Top Workflows" sub="BY EXECUTIONS" />
                {rankings.loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Sk w={20} h={20} r={100} />
                        <Sk w="70%" h={12} />
                        <Sk w={40} h={12} />
                      </div>
                    ))}
                  </div>
                ) : rankings.data ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {(rankings.data as any[]).slice(0, 8).map((wf: any, idx: number) => (
                      <div
                        key={wf.workflow_id || idx}
                        onClick={() => navigate(`/workflow-builder/${wf.workflow_id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 8,
                          cursor: 'pointer',                    // BUG A FIX: pointer cursor
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: C.faint,
                          fontFamily: "'DM Mono',monospace", width: 18, flexShrink: 0,
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{
                          flex: 1, fontSize: 12, color: C.text,
                          fontFamily: "'DM Sans',sans-serif",
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {/* BUG A FIX: wf.workflow_name is now returned by the backend
                              (getWorkflowRankings LEFT JOINs workflows). The fallback chain
                              handles legacy responses / external-source workflows gracefully. */}
                          {wf.workflow_name || wf.name || wf.workflow_id || 'Unnamed'}
                        </span>
                        <span style={{
                          fontSize: 11, color: C.green,
                          fontFamily: "'DM Mono',monospace", fontWeight: 700,
                        }}>
                          {Number(wf.total_executions || wf.executions || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {rankings.error && <ErrorState error={rankings.error} />}
              </Card>

              {/* Execution Duration — Avg & P95 (genuinely analytical — percentile analysis) */}
              <Card accent={C.amber}>
                <SectionHeader title="Execution Duration" sub="AVG & P95" />
                {volume.loading ? <SkBlock height={220} /> : volume.data
                  ? <DurationChart data={volume.data} />
                  : null}
              </Card>
            </div>

            {/* Operational Health — full-width (correctly analytical/derived) */}
            <Card accent={C.purple}>
              <SectionHeader title="Operational Health" />
              {health.loading ? <SkBlock height={180} /> : health.data
                ? <OperationalHealthPanel health={health.data} />
                : null}
            </Card>
          </>
        )}

        {/* ── Workflows Tab ── */}
        {activeTab === 'workflows' && (
          <>
            <Card accent={C.green}>
              <SectionHeader title="Performance Rankings" sub="SORTED BY HEALTH SCORE" />
              {rankings.loading ? <SkBlock height={260} /> : rankings.data
                ? <WorkflowRankingsTable data={rankings.data} />
                : null}
              {rankings.error && <ErrorState error={rankings.error} />}
            </Card>

            <Card accent={C.amber}>
              <SectionHeader title="Detected Bottlenecks" />
              {bottlenecks.loading ? <SkBlock height={160} /> : bottlenecks.data
                ? <BottleneckList data={bottlenecks.data} />
                : null}
            </Card>
          </>
        )}

        {/* ── Integrations Tab ── */}
        {activeTab === 'integrations' && (
          <>
            <div className="af-an-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>
              <Card accent={C.blue}>
                <SectionHeader title="API Call Volume" sub="TOP 12 INTEGRATIONS" />
                {integrations.loading ? <SkBlock height={220} /> : integrations.data
                  ? <IntegrationUsageChart data={integrations.data} />
                  : null}
              </Card>
              <Card accent={C.red}>
                <SectionHeader title="Integration Error Rates" />
                {integrations.loading ? <SkBlock height={220} /> : integrations.data
                  ? <IntegrationErrorRateChart data={integrations.data} />
                  : null}
              </Card>
            </div>

            {integrations.data && (
              <Card accent={C.purple}>
                <SectionHeader title="Most & Least Used" />
                <IntegrationUsageRanking
                  mostUsed={[...integrations.data].sort((a, b) => Number(b.total_calls) - Number(a.total_calls)).slice(0, 5)}
                  leastUsed={[...integrations.data].sort((a, b) => Number(a.total_calls) - Number(b.total_calls)).slice(0, 5)}
                />
              </Card>
            )}

            {integrations.data && (
              <Card accent={C.blue}>
                <SectionHeader title="Integration Summary" />
                <IntegrationTable data={integrations.data} />
              </Card>
            )}
          </>
        )}

        {/* ── Errors Tab ── */}
        {activeTab === 'errors' && (
          <>
            <Card accent={C.red}>
              <SectionHeader title="Error Frequency Heatmap" />
              {heatmap.loading ? <SkBlock height={220} /> : heatmap.data
                ? <ErrorHeatmap data={heatmap.data} />
                : null}
            </Card>

            <Card accent={C.amber}>
              <SectionHeader title="Top Error Causes" sub="LAST 30 DAYS" />
              {topErrors.loading ? <SkBlock height={180} /> : topErrors.data
                ? <TopErrorCausesList data={topErrors.data} />
                : null}
            </Card>
          </>
        )}

        {/* ── Intelligence Tab ── */}
        {activeTab === 'intelligence' && (
          <>
            {health.loading ? <SkBlock height={260} /> : health.data ? (
              <Card accent={C.purple}>
                <SectionHeader title="Operational Health Scores" />
                <OperationalHealthPanel health={health.data} />
              </Card>
            ) : null}

            {healthTrend.data && (
              <Card accent={C.blue}>
                <SectionHeader title="Health Score Trend" sub="LAST 30 DAYS" />
                <HealthTrendChart data={healthTrend.data} />
              </Card>
            )}
          </>
        )}

        {/* ── Forecasts Tab ── */}
        {activeTab === 'forecasts' && (
          <>
            <Card accent={C.amber}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 16, flexWrap: 'wrap', gap: 10,
              }}>
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: C.text,
                    fontFamily: "'Syne',sans-serif",
                  }}>
                    Statistical Forecasts
                  </div>
                  <div style={{
                    fontSize: 11, color: C.muted, marginTop: 3,
                    fontFamily: "'DM Sans',sans-serif",
                  }}>
                    Linear regression + exponential smoothing. Confidence scores reflect data quality.
                  </div>
                </div>
                <button
                  onClick={() => analyticsApi.computeForecasts()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                    borderRadius: 9, padding: '7px 13px',
                    color: C.muted, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.14s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.text}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = C.muted}
                >
                  <RefreshCw size={12} />
                  Recompute
                </button>
              </div>

              {forecasts.loading ? <SkBlock height={320} /> : forecasts.data
                ? <ForecastGrid data={forecasts.data} />
                : (
                  <div style={{
                    textAlign: 'center', padding: '60px 0',
                    color: C.faint, fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                  }}>
                    No forecast data yet. Run workflows first to generate predictions.
                  </div>
                )}
            </Card>
          </>
        )}

        {/* ── Content Tab ── per-post scheduled-content engagement trends ── */}
        {activeTab === 'content' && <ContentTab />}

      </div>

      <style>{`
        @keyframes af-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 900px) {
          .af-an-grid-2 { grid-template-columns: minmax(0,1fr) !important; }
          .af-an-content-grid { grid-template-columns: minmax(0,1fr) !important; }
        }
      `}</style>
    </div>
  );
}
