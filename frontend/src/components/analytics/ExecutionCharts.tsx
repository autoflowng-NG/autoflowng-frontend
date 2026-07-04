/**
 * AutoFlowNG — Phase 14 Execution Charts
 * Recharts-based charts for execution volume, success/failure rates,
 * throughput, and duration metrics.
 *
 * Bug B FIX: All charts were completely static — no pan, zoom, or scroll.
 *   - Added <Brush> to ExecutionVolumeChart, SuccessRateChart, DurationChart,
 *     and ThroughputChart.
 *   - ExecutionVolumeChart adds scroll-wheel zoom and notifies the parent via
 *     onRangeExtend (debounced — 1.5 s cooldown) when the user reaches the
 *     left edge, so the parent can fetch a wider historical window.
 *   - brushRange is clamped whenever the data array length changes (e.g. after
 *     the parent fetches more history) so stale indices never go out of range.
 *   - wheel preventDefault is gated: only called when there are enough points
 *     to zoom (len > 2), so normal page-scroll is not blocked on sparse data.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Brush,
} from 'recharts';
import type { VolumeDataPoint } from '../../api/analyticsApi';

const COLORS = {
  success:  '#10b981',
  failure:  '#ef4444',
  timeout:  '#f59e0b',
  total:    '#6366f1',
  duration: '#8b5cf6',
  muted:    '#334155',
  grid:     '#1e293b',
  text:     '#94a3b8',
};

/**
 * GAP 1 FIX: Previously used toLocaleDateString() with no timeZone option, which
 * converts the UTC bucket timestamp to the browser's local timezone before formatting.
 * For users behind UTC (e.g. Americas) a midnight-UTC bucket like "2026-07-04T00:00:00Z"
 * would render as "Jul 3" — the same off-by-one bug the backend fix was meant to remove.
 *
 * Fix: pass timeZone:'UTC' so the label always reflects the UTC day the backend
 * bucketed into, regardless of where the user's browser is running.
 *
 * Verification:
 *   bucket = "2026-07-04T00:00:00.000Z"
 *   LA  (UTC-7): new Date(bucket).toLocaleDateString('en-US',{month:'short',day:'numeric'})
 *                → "Jul 3"  ❌  (old)
 *                → "Jul 4"  ✅  (new, timeZone:'UTC')
 *   NZ  (UTC+12): both old and new → "Jul 4" ✅ (no regression)
 */
function fmtDate(bucket: string) {
  const d = new Date(bucket);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function fmtMs(ms: number) {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}
const DarkTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span style={{ color: p.color }}>●</span>
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-semibold">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const BRUSH_PROPS = {
  stroke:         COLORS.grid,
  fill:           '#0f172a',
  travellerWidth: 8,
  height:         20,
  tickFormatter:  () => '',
} as const;

// ── Execution Volume Chart ────────────────────────────────────────────────────
export const ExecutionVolumeChart: React.FC<{
  data: VolumeDataPoint[] | null | undefined;
  inProgressData?: Array<{ bucket: string; in_progress: number }> | null;
    /** Called (debounced) when the user reaches the left edge of the loaded range. */
  onRangeExtend?: (direction: 'left') => void;
  /**
   * Called whenever the brush/wheel moves, reporting the current startIndex.
   * Used by the parent to know when the user has panned away from the left edge
   * (e.g. to hide the "at history cap" message when startIndex > 0).
   */
  onBrushChange?: (startIndex: number) => void;
}> = ({ data, inProgressData, onRangeExtend, onBrushChange }) => {
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  // Debounce ref: track last time onRangeExtend was fired so rapid wheel/drag
  // events at the left boundary don't trigger multiple sequential fetches.
  const lastExtendAt = useRef<number>(0);

  const inProgressMap = new Map((inProgressData || []).map(d => [d.bucket, d.in_progress]));

  const formatted = (data || []).map(d => ({
    ...d,
    date:        fmtDate(d.bucket),
    successRate: d.total > 0 ? Math.round((d.successes / d.total) * 100) : 0,
    inProgress:  inProgressMap.get(d.bucket) ?? 0,
  }));

  const len = formatted.length;
  // Default visible window: last 14 points (zoomed in on recent activity).
  const defaultStart = Math.max(0, len - 14);

  // BUGFIX (React error #310 — "rendered more hooks than during the previous
  // render"): this useEffect used to sit AFTER an early `if (!data...) return`
  // above, so the hook was skipped entirely on empty-data renders but called
  // on renders once data arrived — a rules-of-hooks violation that crashed
  // the whole app with a blank screen. All hooks now run unconditionally on
  // every render; the "no data" early return has moved below, after the hooks.
  useEffect(() => {
    if (!data || data.length === 0) return;
    if (!brushRange) return;
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
  }, [len, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const startIndex = brushRange?.startIndex ?? defaultStart;
  const endIndex   = brushRange?.endIndex   ?? (len - 1);

  /** Fire onRangeExtend at most once per 1.5 s to avoid fetch storms. */
  const maybeExtend = useCallback((si: number) => {
    if (si === 0) {
      const now = Date.now();
      if (now - lastExtendAt.current > 1_500) {
        lastExtendAt.current = now;
        onRangeExtend?.('left');
      }
    }
  }, [onRangeExtend]);

  const handleBrushChange = useCallback((range: { startIndex?: number; endIndex?: number }) => {
    const si = range.startIndex ?? 0;
    const ei = range.endIndex   ?? (len - 1);
    setBrushRange({ startIndex: si, endIndex: ei });
    maybeExtend(si);
    onBrushChange?.(si);
  }, [len, maybeExtend, onBrushChange]);

  // Scroll-wheel zoom: wheel-up = zoom in (fewer bars), wheel-down = zoom out.
  // preventDefault is only called when there is actual data to zoom (len > 2)
  // so normal page scroll is not blocked on empty/minimal charts.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (len <= 2) return;
    e.preventDefault();
    const cur     = brushRange ?? { startIndex: defaultStart, endIndex: len - 1 };
    const visible = cur.endIndex - cur.startIndex + 1;
    const step    = Math.max(1, Math.round(visible * 0.15));
    const delta   = e.deltaY > 0 ? step : -step; // scroll-down = zoom out (show more)
    const newVis  = Math.max(2, Math.min(len, visible + delta));
    // Anchor right edge (today stays pinned).
    const newEnd   = cur.endIndex;
    const newStart = Math.max(0, newEnd - newVis + 1);
    setBrushRange({ startIndex: newStart, endIndex: newEnd });
    maybeExtend(newStart);
    onBrushChange?.(newStart);
  }, [len, brushRange, defaultStart, maybeExtend, onBrushChange]);

  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data available</div>;
  }

  return (
    <div onWheel={handleWheel} style={{ userSelect: 'none' }}>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS.success} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="gradFailure" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS.failure} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS.failure} stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="gradProgress" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS.total} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS.total} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={<DarkTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: COLORS.text }} />
          <Area type="monotone" dataKey="successes"  name="Successful"  stroke={COLORS.success} fill="url(#gradSuccess)"  strokeWidth={2} />
          <Area type="monotone" dataKey="failures"   name="Failed"      stroke={COLORS.failure} fill="url(#gradFailure)"  strokeWidth={2} />
          <Area type="monotone" dataKey="inProgress" name="In Progress" stroke={COLORS.total}   fill="url(#gradProgress)" strokeWidth={2} />
          {len > 3 && (
            <Brush
              {...BRUSH_PROPS}
              dataKey="date"
              startIndex={startIndex}
              endIndex={endIndex}
              onChange={handleBrushChange}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {len > 3 && (
        <p style={{ textAlign: 'right', fontSize: 10, color: COLORS.text, marginTop: 2, opacity: 0.5 }}>
          Scroll to zoom · drag handles to pan · drag to left edge to load more history
        </p>
      )}
    </div>
  );
};

// ── Success Rate Chart ─────────────────────────────────────────────────────────
export const SuccessRateChart: React.FC<{ data: VolumeDataPoint[] | null | undefined }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data available</div>;
  }
  const formatted = data.map(d => ({
    date:        fmtDate(d.bucket),
    successRate: d.total > 0 ? parseFloat(((d.successes / d.total) * 100).toFixed(1)) : 0,
  }));
  const len = formatted.length;
  const defaultStart = Math.max(0, len - 14);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} width={36}
               tickFormatter={v => `${v}%`} />
        <Tooltip content={<DarkTooltip />} />
        <ReferenceLine y={95} stroke={COLORS.success} strokeDasharray="4 4" label={{ value: '95%', fill: COLORS.text, fontSize: 10 }} />
        <Line type="monotone" dataKey="successRate" name="Success Rate" stroke={COLORS.total}
              strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        {len > 3 && (
          <Brush
            {...BRUSH_PROPS}
            dataKey="date"
            startIndex={defaultStart}
            endIndex={len - 1}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Throughput Chart ──────────────────────────────────────────────────────────
export const ThroughputChart: React.FC<{
  data: Array<{ hour: string; executions: number }>
}> = ({ data }) => {
  const formatted = data.map(d => ({
    hour:       new Date(d.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    executions: d.executions,
  }));
  const len = formatted.length;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis dataKey="hour" tick={{ fill: COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false}
               interval={3} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="executions" name="Executions" fill={COLORS.total} radius={[2, 2, 0, 0]} />
        {len > 12 && (
          <Brush
            {...BRUSH_PROPS}
            dataKey="hour"
            startIndex={Math.max(0, len - 24)}
            endIndex={len - 1}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Duration Distribution Chart ───────────────────────────────────────────────
export const DurationChart: React.FC<{ data: VolumeDataPoint[] | null | undefined }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data available</div>;
  }
  const formatted = data.map(d => ({
    date: fmtDate(d.bucket),
    avg:  d.avg_duration_ms,
    p95:  d.p95_ms,
  }));
  const len = formatted.length;
  const defaultStart = Math.max(0, len - 14);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} width={44}
               tickFormatter={v => fmtMs(v)} />
        <Tooltip content={<DarkTooltip />} formatter={(v: number) => [fmtMs(v)]} />
        <Legend wrapperStyle={{ fontSize: 11, color: COLORS.text }} />
        <Line type="monotone" dataKey="avg" name="Avg Duration" stroke={COLORS.total}   strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="p95" name="P95 Duration" stroke={COLORS.timeout} strokeWidth={2} dot={false} strokeDasharray="4 2" />
        {len > 3 && (
          <Brush
            {...BRUSH_PROPS}
            dataKey="date"
            startIndex={defaultStart}
            endIndex={len - 1}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
};
