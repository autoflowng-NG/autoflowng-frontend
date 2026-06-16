/**
 * AutoFlowNG — Phase 14 Execution Charts
 * Recharts-based charts for execution volume, success/failure rates,
 * throughput, and duration metrics.
 */

import React from 'react';
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

function fmtDate(bucket: string) {
  const d = new Date(bucket);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// ── Execution Volume Chart ─────────────────────────────────────────────────────
export const ExecutionVolumeChart: React.FC<{ data: VolumeDataPoint[] | null | undefined }> = ({ data }) => {
  if (!data || data.length === 0) return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data available</div>;
  const formatted = data.map(d => ({
    ...d,
    date: fmtDate(d.bucket),
    successRate: d.total > 0 ? Math.round((d.successes / d.total) * 100) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
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
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<DarkTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: COLORS.text }} />
        <Area type="monotone" dataKey="successes" name="Success" stroke={COLORS.success} fill="url(#gradSuccess)" strokeWidth={2} />
        <Area type="monotone" dataKey="failures"  name="Failure" stroke={COLORS.failure} fill="url(#gradFailure)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ── Success Rate Chart ─────────────────────────────────────────────────────────
export const SuccessRateChart: React.FC<{ data: VolumeDataPoint[] | null | undefined }> = ({ data }) => {
  if (!data || data.length === 0) return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data available</div>;
  const formatted = data.map(d => ({
    date: fmtDate(d.bucket),
    successRate: d.total > 0 ? parseFloat(((d.successes / d.total) * 100).toFixed(1)) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
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
export const ThroughputChart: React.FC<{
  data: Array<{ hour: string; executions: number }>
}> = ({ data }) => {
  const formatted = data.map(d => ({
    hour: new Date(d.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    executions: d.executions,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis dataKey="hour" tick={{ fill: COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false}
               interval={3} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="executions" name="Executions" fill={COLORS.total} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Duration Distribution Chart ───────────────────────────────────────────────
export const DurationChart: React.FC<{ data: VolumeDataPoint[] | null | undefined }> = ({ data }) => {
  if (!data || data.length === 0) return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data available</div>;
  const formatted = data.map(d => ({
    date: fmtDate(d.bucket),
    avg: d.avg_duration_ms,
    p95: d.p95_ms,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} width={44}
               tickFormatter={v => fmtMs(v)} />
        <Tooltip content={<DarkTooltip />} formatter={(v: number) => [fmtMs(v)]} />
        <Legend wrapperStyle={{ fontSize: 11, color: COLORS.text }} />
        <Line type="monotone" dataKey="avg" name="Avg Duration" stroke={COLORS.total}  strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="p95" name="P95 Duration" stroke={COLORS.timeout} strokeWidth={2} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
};
