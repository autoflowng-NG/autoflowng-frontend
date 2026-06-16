/**
 * AutoFlowNG — Phase 14 Integration Usage Charts
 * Bar charts, reliability scores, and usage rankings for all integrations.
 */

import React from 'react';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { IntegrationSummary } from '../../api/analyticsApi';

const PLATFORM_COLORS: Record<string, string> = {
  youtube:         '#ff0000',
  facebook:        '#1877f2',
  instagram:       '#e1306c',
  tiktok:          '#69c9d0',
  whatsapp:        '#25d366',
  telegram:        '#229ed9',
  discord:         '#5865f2',
  google_workspace:'#4285f4',
  salesforce:      '#00a1e0',
  webhook:         '#8b5cf6',
  database:        '#f59e0b',
  universal_api:   '#6366f1',
};

const DEFAULT_COLOR = '#475569';

function platformColor(name: string) {
  return PLATFORM_COLORS[name.toLowerCase()] || DEFAULT_COLOR;
}

const COLORS = {
  text: '#94a3b8',
  grid: '#1e293b',
};

const DarkTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload??.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload?.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span style={{ color: p.color }}>●</span>
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-semibold">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ── Integration call volume bar chart ─────────────────────────────────────────
export const IntegrationUsageChart: React.FC<{ data: IntegrationSummary[] }> = ({ data }) => {
  const sorted = [...data].sort((a, b) => Number(b.total_calls) - Number(a.total_calls))?.slice(0, 12);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false}
               tickFormatter={v => v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v)} />
        <YAxis type="category" dataKey="integration" tick={{ fill: COLORS.text, fontSize: 11 }}
               axisLine={false} tickLine={false} width={100} />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="total_calls" name="API Calls" radius={[0, 3, 3, 0]}>
          {sorted?.map(entry => (
            <Cell key={entry.integration} fill={platformColor(entry.integration)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Integration reliability radar ─────────────────────────────────────────────
export const IntegrationReliabilityRadar: React.FC<{
  data: Array<{ integration: string; reliability_score: number }>
}> = ({ data }) => {
  const top8 = data?.slice(0, 8)?.map(d => ({
    name: d.integration,
    score: Math.max(0, Math.min(100, Math.round(Number(d.reliability_score)))),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={top8}>
        <PolarGrid stroke={COLORS.grid} />
        <PolarAngleAxis dataKey="name" tick={{ fill: COLORS.text, fontSize: 10 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: COLORS.text, fontSize: 9 }} />
        <Radar name="Reliability" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
        <Tooltip content={<DarkTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
};

// ── Integration error rate chart ──────────────────────────────────────────────
export const IntegrationErrorRateChart: React.FC<{ data: IntegrationSummary[] }> = ({ data }) => {
  const withErrors = [...data]
    ?.filter(d => Number(d.error_rate) > 0)
    .sort((a, b) => Number(b.error_rate) - Number(a.error_rate))
    ?.slice(0, 10);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={withErrors} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false}
               tickFormatter={v => `${v}%`} domain={[0, 100]} />
        <YAxis type="category" dataKey="integration" tick={{ fill: COLORS.text, fontSize: 11 }}
               axisLine={false} tickLine={false} width={100} />
        <Tooltip content={<DarkTooltip />} formatter={(v: number) => [`${v}%`, 'Error Rate']} />
        <Bar dataKey="error_rate" name="Error Rate" radius={[0, 3, 3, 0]} fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Most / Least used integration cards ──────────────────────────────────────
export const IntegrationUsageRanking: React.FC<{
  mostUsed:  IntegrationSummary[];
  leastUsed: IntegrationSummary[];
}> = ({ mostUsed, leastUsed }) => (
  <div className="grid grid-cols-2 gap-4">
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Most Used</p>
      <div className="space-y-1.5">
        {mostUsed?.map((i, idx) => (
          <div key={i.integration} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 w-4">{idx + 1}</span>
              <span style={{ color: platformColor(i.integration) }} className="w-2 h-2 rounded-full bg-current inline-block" />
              <span className="text-slate-300 capitalize">{i.integration.replace('_', ' ')}</span>
            </div>
            <span className="text-slate-400">{Number(i.total_calls).toLocaleString()} calls</span>
          </div>
        ))}
      </div>
    </div>
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Least Used</p>
      <div className="space-y-1.5">
        {leastUsed?.map((i, idx) => (
          <div key={i.integration} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 w-4">{idx + 1}</span>
              <span style={{ color: platformColor(i.integration) }} className="w-2 h-2 rounded-full bg-current inline-block" />
              <span className="text-slate-300 capitalize">{i.integration.replace('_', ' ')}</span>
            </div>
            <span className="text-slate-400">{Number(i.total_calls).toLocaleString()} calls</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
