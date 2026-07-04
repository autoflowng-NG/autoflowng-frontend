/**
 * AutoFlowNG — Phase 14 Execution Charts
 * Recharts-based charts for execution volume, success/failure rates,
 * throughput, and duration metrics.
 *
 * BUG 9 FIX: Removed <Brush> from all four charts.
 *   - ExecutionVolumeChart uses direct pointer/touch drag-to-pan
 *     (onPointerDown/onPointerMove/onPointerUp) — no brush strip, no
 *     drag-affordance UI, just grab-and-slide. cursor: grab / cursor: grabbing
 *     indicates the interaction.
 *   - handleWheel (scroll/pinch zoom) is preserved unchanged.
 *   - Range-preset pills (7d / 30d / 90d) give a fast way to jump windows.
 *   - When startIndex reaches 0, onRangeExtend('left') fires (debounced) to
 *     fetch real history from the backend — never pads with fake data.
 *   - Loading indicator shown at the left edge while a fetch is in flight.
 *   - SuccessRateChart, ThroughputChart, DurationChart are fixed-window
 *     (bound to the period toggle on Analytics Center) — Brush removed,
 *     no drag-pan replacement needed.
 *
 * BUG 10 FIX: DurationChart Avg vs P95 visual hierarchy.
 *   - Avg Duration: strokeWidth={2.5}, full opacity — hero/primary line.
 *   - P95 Duration: strokeWidth={1.5}, strokeOpacity={0.55}, dashed — reference.
 *   - Legend/tooltip order: Avg first, P95 second.
 *
 * HOOKS ORDER: All React hooks are declared unconditionally at the top of each
 *   component, before any conditional return — this satisfies the Rules of Hooks
 *   and prevents "Rendered fewer hooks than expected" at runtime.
 *
 * GAP 1 FIX (preserved): fmtDate uses timeZone:'UTC' to avoid off-by-one day
 *   rendering for users behind UTC.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
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
 * GAP 1 FIX: timeZone:'UTC' ensures bucket labels always match the UTC day
 * the backend bucketed into, regardless of the browser's local timezone.
 */
function fmtDate(bucket: string) {
  return new Date(bucket).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}
/**
 * BUG 3 FIX (duplicate x-axis labels in Hourly view):
 * fmtDate formats by calendar date only, so multiple hourly buckets on the
 * same day all get the same label (e.g. "Jul 3 Jul 3 Jul 3 ...").
 * fmtBucket is period-aware: hourly view includes the hour ("Jul 3, 2 PM")
 * so each tick is visually distinct. All other periods delegate to fmtDate.
 */
function fmtBucket(bucket: string, period: string): string {
  if (period === 'hourly') {
    const d = new Date(bucket);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const hourPart = d.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'UTC' });
    return `${datePart}, ${hourPart}`;
  }
  return fmtDate(bucket);
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

/** Range pills shown above the ExecutionVolumeChart */
const RANGE_PILLS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

// ── Execution Volume Chart ────────────────────────────────────────────────────
export const ExecutionVolumeChart: React.FC<{
  data: VolumeDataPoint[] | null | undefined;
  inProgressData?: Array<{ bucket: string; in_progress: number }> | null;
  /** Called (debounced) when the user reaches the left edge of loaded data. */
  onRangeExtend?: (direction: 'left') => void;
  /** Called whenever the view window moves, reporting current startIndex. */
  onBrushChange?: (startIndex: number) => void;
  /** True while the parent is fetching more history. */
  isLoadingMore?: boolean;
}> = ({ data, inProgressData, onRangeExtend, onBrushChange, isLoadingMore }) => {

  // ── ALL HOOKS FIRST — before any conditional returns ──────────────────────
  // This satisfies the Rules of Hooks: hooks must be called unconditionally
  // on every render, in the same order. The early "no data" return below is
  // safe because it comes after every hook declaration.
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activePill, setActivePill] = useState<number>(7);
  const lastExtendAt = useRef<number>(0);
  const pointerRef   = useRef<{ x: number; si: number; ei: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const inProgressMap = useMemo(
    () => new Map((inProgressData || []).map(d => [d.bucket, d.in_progress])),
    [inProgressData]
  );

  const formatted = useMemo(
    () => (data || []).map(d => ({
      ...d,
      date:        fmtDate(d.bucket),
      successRate: d.total > 0 ? Math.round((d.successes / d.total) * 100) : 0,
      inProgress:  inProgressMap.get(d.bucket) ?? 0,
    })),
    [data, inProgressMap]
  );

  const len = formatted.length;
  const defaultWindowSize = Math.min(activePill, len);
  const defaultStart = Math.max(0, len - defaultWindowSize);

  // Clamp stale brushRange whenever data grows (parent fetched more history).
  useEffect(() => {
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
  }, [len]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Scroll/pinch zoom — preserved from original.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (len <= 2) return;
    e.preventDefault();
    const cur     = brushRange ?? { startIndex: defaultStart, endIndex: len - 1 };
    const visible = cur.endIndex - cur.startIndex + 1;
    const step    = Math.max(1, Math.round(visible * 0.15));
    const delta   = e.deltaY > 0 ? step : -step;
    const newVis  = Math.max(2, Math.min(len, visible + delta));
    const newEnd   = cur.endIndex;
    const newStart = Math.max(0, newEnd - newVis + 1);
    setBrushRange({ startIndex: newStart, endIndex: newEnd });
    setActivePill(-1);
    maybeExtend(newStart);
    onBrushChange?.(newStart);
  }, [len, brushRange, defaultStart, maybeExtend, onBrushChange]);

  // Pointer drag-to-pan.
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const si = brushRange?.startIndex ?? defaultStart;
    const ei = brushRange?.endIndex   ?? (len - 1);
    pointerRef.current = { x: e.clientX, si, ei };
    setIsDragging(true);
  }, [brushRange, defaultStart, len]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    // Approximate plot width: container width minus YAxis (36px) and margins (8px).
    const plotWidth  = Math.max(1, container.clientWidth - 44);
    const windowSize = pointerRef.current.ei - pointerRef.current.si;
    const pxPerPoint = plotWidth / Math.max(1, windowSize);
    const dx    = e.clientX - pointerRef.current.x;
    const shift = Math.round(-dx / pxPerPoint); // drag-left → shift toward older data

    let newSi = Math.max(0, pointerRef.current.si + shift);
    let newEi = newSi + windowSize;
    if (newEi >= len) {
      newEi = len - 1;
      newSi = Math.max(0, newEi - windowSize);
    }
    setBrushRange({ startIndex: newSi, endIndex: newEi });
    setActivePill(-1);
    maybeExtend(newSi);
    onBrushChange?.(newSi);
  }, [len, maybeExtend, onBrushChange]);

  const handlePointerUp = useCallback(() => {
    pointerRef.current = null;
    setIsDragging(false);
  }, []);

  const handlePill = useCallback((days: number) => {
    setActivePill(days);
    const windowSize = Math.min(days, len);
    const newEnd   = len - 1;
    const newStart = Math.max(0, newEnd - windowSize + 1);
    setBrushRange({ startIndex: newStart, endIndex: newEnd });
    onBrushChange?.(newStart);
  }, [len, onBrushChange]);

  // ── Conditional early return — safe here because all hooks are above ───────
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
        No data available
      </div>
    );
  }

  // Derived state (not hooks)
  const startIndex = brushRange?.startIndex ?? defaultStart;
  const endIndex   = brushRange?.endIndex   ?? (len - 1);
  const sliced     = formatted.slice(startIndex, endIndex + 1);

  return (
    <div style={{ position: 'relative' }}>
      {/* Range pills + loading indicator row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6, paddingRight: 4,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGE_PILLS.map(pill => (
            <button
              key={pill.days}
              onClick={() => handlePill(pill.days)}
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                border: `1px solid ${activePill === pill.days ? COLORS.total : COLORS.grid}`,
                background: activePill === pill.days ? `${COLORS.total}22` : 'transparent',
                color: activePill === pill.days ? COLORS.total : COLORS.text,
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'monospace',
                transition: 'all 0.12s',
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>
        {isLoadingMore && startIndex === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 10, color: COLORS.text, opacity: 0.6,
          }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10,
              borderRadius: '50%',
              border: `2px solid ${COLORS.total}`,
              borderTopColor: 'transparent',
              animation: 'evc-spin 0.7s linear infinite',
            }} />
            Loading history…
          </div>
        )}
      </div>

      {/* Chart container — drag-to-pan target */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={sliced} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
            <Area type="monotone" dataKey="successes"  name="Successful"  stroke={COLORS.success} fill="url(#gradSuccess)"  strokeWidth={2} dot={{ r: 3, fill: COLORS.success }} />
            <Area type="monotone" dataKey="failures"   name="Failed"      stroke={COLORS.failure} fill="url(#gradFailure)"  strokeWidth={2} dot={{ r: 3, fill: COLORS.failure }} />
            <Area type="monotone" dataKey="inProgress" name="In Progress" stroke={COLORS.total}   fill="url(#gradProgress)" strokeWidth={2} dot={{ r: 3, fill: COLORS.total   }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <style>{`
        @keyframes evc-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ── Success Rate Chart ─────────────────────────────────────────────────────────
// Fixed-window, bound to period toggle — Brush removed, no drag-pan needed.
export const SuccessRateChart: React.FC<{ data: VolumeDataPoint[] | null | undefined }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data available</div>;
  }
  const formatted = data.map(d => ({
    date:        fmtDate(d.bucket),
    successRate: d.total > 0 ? parseFloat(((d.successes / d.total) * 100).toFixed(1)) : 0,
  }));
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
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Throughput Chart ──────────────────────────────────────────────────────────
// Fixed 48-hour operational view — Brush removed, no drag-pan needed.
export const ThroughputChart: React.FC<{
  data: Array<{ hour: string; executions: number }>
}> = ({ data }) => {
  const formatted = data.map(d => ({
    hour:       new Date(d.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    executions: d.executions,
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis dataKey="hour" tick={{ fill: COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="executions" name="Executions" fill={COLORS.total} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Duration Distribution Chart ───────────────────────────────────────────────
// Fixed-window, bound to period toggle — Brush removed, no drag-pan needed.
//
// BUG 10 FIX:
//   Avg Duration (hero):      strokeWidth={2.5}, full opacity, primary color.
//   P95 Duration (reference): strokeWidth={1.5}, strokeOpacity={0.55}, dashed.
//   Legend/tooltip order: Avg first, P95 second.
export const DurationChart: React.FC<{ data: VolumeDataPoint[] | null | undefined; lowDataLabel?: string; period?: string }> = ({ data, lowDataLabel, period = 'daily' }) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data available</div>;
  }

  // BUG FIX (duration chart unreadable on sparse data):
  // getExecutionVolume zero-fills every bucket in the requested lookback
  // window via generate_series (so `total` is always a real 0, not missing),
  // but avg_duration_ms/p95_ms are left NULL for buckets with no executions
  // (AVG/PERCENTILE_CONT over zero rows). Rendering the full window
  // regardless of how many buckets actually have data meant a workspace with
  // 1-2 real executions in a 3-day hourly window got a chart stretched
  // across ~72 empty hourly ticks with a single real point crammed at one
  // edge — technically accurate, practically unreadable as a "trend".
  // Fix: trim to the span that actually contains real executions, and if
  // there still isn't enough inside that span to draw a meaningful line,
  // show an explicit low-data message instead of a near-empty squiggle.
  const MIN_READABLE_POINTS = 4;
  const hasReal = (d: VolumeDataPoint) => (d.total ?? 0) > 0 && d.avg_duration_ms != null;
  const realCount = data.filter(hasReal).length;

  if (realCount < MIN_READABLE_POINTS) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm text-center gap-1 px-4">
        <span>{lowDataLabel || 'Not enough execution history yet to show a duration trend.'}</span>
        <span className="text-xs text-slate-600">Run a few more workflows and check back.</span>
      </div>
    );
  }

  const firstRealIdx = data.findIndex(hasReal);
  const lastRealIdx  = data.length - 1 - [...data].reverse().findIndex(hasReal);
  const trimmed = data.slice(firstRealIdx, lastRealIdx + 1);

  const formatted = trimmed.map(d => ({
    date: fmtBucket(d.bucket, period),
    avg:  d.avg_duration_ms,
    p95:  d.p95_ms,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} width={44}
               tickFormatter={v => fmtMs(v)} />
        <Tooltip content={<DarkTooltip />} formatter={(v: number) => [fmtMs(v)]} />
        <Legend wrapperStyle={{ fontSize: 11, color: COLORS.text }} />
        {/* Avg — hero/primary line: rendered first → appears first in legend/tooltip */}
        <Line
          type="monotone"
          dataKey="avg"
          name="Avg Duration"
          stroke={COLORS.total}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
        />
        {/* P95 — secondary/reference line: thinner, dimmed, dashed */}
        <Line
          type="monotone"
          dataKey="p95"
          name="P95 Duration"
          stroke={COLORS.timeout}
          strokeWidth={1.5}
          strokeOpacity={0.55}
          strokeDasharray="4 2"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
