/**
 * AutoFlowNG — Post Engagement Chart (Analytics Center · Content Tab)
 *
 * Per-post engagement trend chart for the Content/Publishing tab.
 * Shows how a single published post's engagement (views, likes, comments,
 * shares) has trended since it went live. X-axis is elapsed time since
 * publish (e.g. "2h", "1d 4h"), NOT calendar dates — the question is
 * "how has this post grown since it went live", not "on what date".
 *
 * Data source: GET /api/publishing/jobs/:id/analytics
 *
 * NOTE: This component is intentionally separate from SuccessRateChart
 * (components/analytics/ExecutionCharts.tsx) — the data shapes are
 * fundamentally different (per-post engagement counts over elapsed time vs.
 * aggregate workflow success/failure ratios over calendar buckets).
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Brush,
} from 'recharts';

// ── Design tokens (mirrors AnalyticsCenter palette) ─────────────────────────
const C = {
  bg:      '#060810',
  surface: '#0C0F1A',
  raised:  '#111520',
  border:  'rgba(255,255,255,0.06)',
  text:    '#E2E8FF',
  muted:   'rgba(226,232,255,0.45)',
  faint:   'rgba(226,232,255,0.22)',
  green:   '#00C896',
  blue:    '#38BDF8',
  purple:  '#A78BFA',
  amber:   '#FBBF24',
  red:     '#FB7185',
};

// Metric options for the toggle
type Metric = 'views' | 'likes' | 'comments' | 'shares';
const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: 'views',    label: 'Views',    color: C.blue   },
  { key: 'likes',    label: 'Likes',    color: C.green  },
  { key: 'comments', label: 'Comments', color: C.purple },
  { key: 'shares',   label: 'Shares',  color: C.amber  },
];

// ── Elapsed-time formatter ───────────────────────────────────────────────────
function fmtElapsed(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours   = Math.floor(totalMinutes / 60);
  const totalDays    = Math.floor(totalHours / 24);

  if (totalDays >= 1) {
    const remHours = totalHours % 24;
    return remHours ? `${totalDays}d ${remHours}h` : `${totalDays}d`;
  }
  if (totalHours >= 1) {
    const remMins = totalMinutes % 60;
    return remMins ? `${totalHours}h ${remMins}m` : `${totalHours}h`;
  }
  return `${totalMinutes}m`;
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.raised,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <p style={{ color: C.faint, marginBottom: 6, fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
        {label} AFTER PUBLISH
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
          <span style={{ color: C.muted }}>{entry.name}:</span>
          <span style={{ color: C.text, fontWeight: 700 }}>{Number(entry.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── Totals counter strip ─────────────────────────────────────────────────────
function TotalsStrip({ totals }: { totals: Record<string, number> }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 10,
      marginBottom: 20,
    }}>
      {METRICS.map(({ key, label, color }) => (
        <div key={key} style={{
          background: C.raised,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '12px 16px',
        }}>
          <div style={{
            fontSize: 10, fontFamily: "'DM Mono', monospace",
            color: C.faint, letterSpacing: '0.06em', marginBottom: 4,
          }}>
            {label.toUpperCase()}
          </div>
          <div style={{
            fontSize: '1.4rem', fontWeight: 900,
            fontFamily: "'Syne', sans-serif", letterSpacing: '-0.04em',
            color,
          }}>
            {Number(totals[key] ?? 0).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Metric toggle ────────────────────────────────────────────────────────────
function MetricToggle({ selected, onChange }: { selected: Metric[]; onChange: (m: Metric[]) => void }) {
  const toggle = (key: Metric) => {
    if (selected.includes(key)) {
      // Always keep at least one metric selected
      if (selected.length > 1) onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {METRICS.map(({ key, label, color }) => {
        const active = selected.includes(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              padding: '4px 12px', borderRadius: 100,
              border: `1px solid ${active ? color : C.border}`,
              background: active ? `${color}15` : 'transparent',
              color: active ? color : C.muted,
              fontSize: 11, fontWeight: 600,
              fontFamily: "'DM Mono', monospace",
              cursor: 'pointer', transition: 'all 0.14s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface PostAnalyticsSeries {
  platform:   string;
  views:      number;
  likes:      number;
  comments:   number;
  shares:     number;
  impressions: number;
  reach:      number;
  fetched_at: string;
}

export interface PostAnalyticsData {
  job: {
    id:               number;
    title:            string;
    status:           string;
    target_platforms: string[];
    completed_at:     string | null;
    created_at:       string;
  };
  series:  PostAnalyticsSeries[];
  totals:  Record<string, number>;
}

interface Props {
  data: PostAnalyticsData;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function PostEngagementChart({ data }: Props) {
  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>(['views', 'likes']);
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const publishedAt = data.job.completed_at
    ? new Date(data.job.completed_at).getTime()
    : new Date(data.job.created_at).getTime();

  // Transform series: compute elapsed ms for each snapshot, aggregate across platforms
  const chartData = React.useMemo(() => {
    // Group by fetched_at, summing across platforms
    const grouped = new Map<string, { elapsed: number; views: number; likes: number; comments: number; shares: number }>();
    for (const row of data.series) {
      const key = row.fetched_at;
      const elapsedMs = new Date(row.fetched_at).getTime() - publishedAt;
      const existing = grouped.get(key) || { elapsed: elapsedMs, views: 0, likes: 0, comments: 0, shares: 0 };
      grouped.set(key, {
        elapsed:  existing.elapsed,
        views:    existing.views    + Number(row.views),
        likes:    existing.likes    + Number(row.likes),
        comments: existing.comments + Number(row.comments),
        shares:   existing.shares   + Number(row.shares),
      });
    }

    return Array.from(grouped.values())
      .sort((a, b) => a.elapsed - b.elapsed)
      .map(row => ({
        ...row,
        elapsedLabel: fmtElapsed(Math.max(0, row.elapsed)),
      }));
  }, [data.series, publishedAt]);

  const len = chartData.length;
  const defaultStart = Math.max(0, len - 20);

  // Clamp stale brushRange if the series length changes (e.g. job switch).
  React.useEffect(() => {
    if (!brushRange || len === 0) return;
    const clamped = {
      startIndex: Math.max(0, Math.min(brushRange.startIndex, len - 1)),
      endIndex:   Math.max(0, Math.min(brushRange.endIndex,   len - 1)),
    };
    if (
      clamped.startIndex !== brushRange.startIndex ||
      clamped.endIndex   !== brushRange.endIndex
    ) {
      setBrushRange(clamped);
    }
  }, [len]); // eslint-disable-line react-hooks/exhaustive-deps

  const startIndex = brushRange?.startIndex ?? defaultStart;
  const endIndex   = brushRange?.endIndex   ?? (len - 1);

  // Scroll-wheel zoom: scroll up → zoom in, scroll down → zoom out.
  // preventDefault is gated to len > 2 so sparse charts don't block page scroll.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (len <= 2) return;
    e.preventDefault();
    const cur = brushRange ?? { startIndex: defaultStart, endIndex: len - 1 };
    const visible = cur.endIndex - cur.startIndex + 1;
    const step    = Math.max(1, Math.round(visible * 0.15));
    const delta   = e.deltaY > 0 ? step : -step;
    const newVis  = Math.max(2, Math.min(len, visible + delta));
    const newEnd  = cur.endIndex;
    const newStart = Math.max(0, newEnd - newVis + 1);
    setBrushRange({ startIndex: newStart, endIndex: newEnd });
  }, [len, brushRange, defaultStart]);

  if (chartData.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '40px 0',
        color: C.faint, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
      }}>
        No engagement data yet — data will appear as the post accumulates activity.
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <TotalsStrip totals={data.totals} />

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono', monospace" }}>
          {chartData.length} SNAPSHOT{chartData.length !== 1 ? 'S' : ''} · X-AXIS: ELAPSED SINCE PUBLISH
          {len > 4 && <span style={{ marginLeft: 8, opacity: 0.6 }}>· SCROLL TO ZOOM</span>}
        </div>
        <MetricToggle selected={selectedMetrics} onChange={setSelectedMetrics} />
      </div>

      <div onWheel={handleWheel} style={{ userSelect: 'none' }}>
        <ResponsiveContainer width="100%" height={len > 4 ? 240 : 220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {METRICS.map(({ key, color }) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis
              dataKey="elapsedLabel"
              tick={{ fill: C.faint, fontSize: 10, fontFamily: "'DM Mono', monospace" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fill: C.faint, fontSize: 10, fontFamily: "'DM Mono', monospace" }}
              axisLine={false} tickLine={false}
              width={48}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', monospace", color: C.muted }}
            />
            {METRICS.filter(m => selectedMetrics.includes(m.key)).map(({ key, label, color }) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${key})`}
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            ))}
            {len > 4 && (
              <Brush
                dataKey="elapsedLabel"
                stroke={C.border}
                fill={C.surface}
                travellerWidth={8}
                height={20}
                startIndex={startIndex}
                endIndex={endIndex}
                onChange={(range) => {
                  setBrushRange({
                    startIndex: range.startIndex ?? 0,
                    endIndex:   range.endIndex   ?? (len - 1),
                  });
                }}
                tickFormatter={() => ''}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
