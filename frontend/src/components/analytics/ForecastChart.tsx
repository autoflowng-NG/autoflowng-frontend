/**
 * AutoFlowNG — Phase 14 Forecast Charts
 * Visualise statistical forecasts with confidence intervals.
 * Shows clear confidence warnings when data is insufficient.
 */

import React from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { ForecastResult } from '../../api/analyticsApi';

const METRIC_LABELS: Record<string, string> = {
  execution_volume:        'Execution Volume',
  queue_pressure:          'Queue Pressure (DLQ)',
  integration_calls_total: 'Integration Calls',
  workflow_count:          'Active Workflows',
};

const METRIC_COLORS: Record<string, string> = {
  execution_volume:        '#6366f1',
  queue_pressure:          '#ef4444',
  integration_calls_total: '#10b981',
  workflow_count:          '#f59e0b',
};

const DarkTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number | number[]; color: string }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload?.map(p => {
        const val = Array.isArray(p.value)
          ? `${p.value[0]?.toFixed(0)} – ${p.value[1]?.toFixed(0)}`
          : p.value?.toLocaleString();
        return (
          <div key={p.name} className="flex items-center gap-2">
            <span style={{ color: p.color }}>●</span>
            <span className="text-slate-300">{p.name}:</span>
            <span className="text-white font-semibold">{val}</span>
          </div>
        );
      })}
    </div>
  );
};

function ConfidenceBadge({ confidence, warning }: { confidence: number; warning: string | null }) {
  if (warning?.includes('INSUFFICIENT')) {
    return (
      <span className="text-[10px] text-amber-400 bg-amber-950 border border-amber-800 px-1.5 py-0.5 rounded">
        ⚠ Low Confidence
      </span>
    );
  }
  const color =
    confidence >= 70 ? 'text-emerald-400 bg-emerald-950 border-emerald-800' :
    confidence >= 40 ? 'text-amber-400  bg-amber-950  border-amber-800' :
                       'text-red-400    bg-red-950     border-red-800';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${color}`}>
      {confidence}% conf
    </span>
  );
}

interface ForecastCardProps {
  metricType: string;
  forecasts:  ForecastResult[];
}

export const ForecastCard: React.FC<ForecastCardProps> = ({ metricType, forecasts }) => {
  const label = METRIC_LABELS[metricType] || metricType;
  const color = METRIC_COLORS[metricType] || '#6366f1';

  // Build chart data: today + 3 horizon points
  const today = new Date();
  const chartData = [
    { label: 'Today', predicted: null, band: null },
    ...forecasts?.map(f => ({
      label:     `+${f.horizon_days}d`,
      predicted: f.predicted_value,
      band:      f.warning?.includes('INSUFFICIENT') ? null : [f.lower_bound, f.upper_bound],
    })),
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-200">{label}</h4>
        <div className="flex gap-2">
          {forecasts?.map(f => (
            <ConfidenceBadge key={f.horizon_days} confidence={f.confidence} warning={f.warning} />
          ))}
        </div>
      </div>

      {/* Forecast horizon summary */}
      <div className="grid grid-cols-3 gap-2">
        {forecasts?.map(f => (
          <div key={f.horizon_days} className="bg-slate-800/60 rounded-lg p-2.5 text-center">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">+{f.horizon_days}d</p>
            {f.warning?.includes('INSUFFICIENT') ? (
              <p className="text-amber-400 text-xs">Insufficient data</p>
            ) : (
              <>
                <p className="text-white font-bold text-base">{f.predicted_value?.toLocaleString()}</p>
                <p className="text-slate-600 text-[10px]">
                  {f.lower_bound?.toLocaleString()} – {f.upper_bound?.toLocaleString()}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Mini trend line */}
      {forecasts.some(f => !f.warning?.includes('INSUFFICIENT')) && (
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={32}
                   tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<DarkTooltip />} />
            <Area type="monotone" dataKey="band" name="Range" stroke="none"
                  fill={color} fillOpacity={0.15} />
            <Line type="monotone" dataKey="predicted" name="Predicted"
                  stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} strokeDasharray="5 3" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ── All Forecasts Grid ─────────────────────────────────────────────────────────
export const ForecastGrid: React.FC<{ data: ForecastResult[] }> = ({ data }) => {
  // Group by metric_type
  const grouped = data.reduce<Record<string, ForecastResult[]>>((acc, f) => {
    const key = f.metric_type.startsWith('integration_calls_') && f.metric_type !== 'integration_calls_total'
      ? 'integration_calls_total'
      : f.metric_type;
    if (!acc[key]) acc[key] = [];
    // deduplicate by horizon
    if (!acc[key].find(x => x.horizon_days === f.horizon_days)) acc[key].push(f);
    return acc;
  }, {});

  const metricKeys = Object.keys(grouped)?.filter(k => Object.keys(METRIC_LABELS).includes(k));

  if (metricKeys?.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600">
        <p className="text-sm">No forecast data yet.</p>
        <p className="text-xs mt-1">Forecasts require at least 7 days of execution history.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {metricKeys?.map(key => (
        <ForecastCard
          key={key}
          metricType={key}
          forecasts={grouped[key].sort((a, b) => a.horizon_days - b.horizon_days)}
        />
      ))}
    </div>
  );
};
