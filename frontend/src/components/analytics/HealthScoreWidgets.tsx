/**
 * AutoFlowNG — Phase 14 Health Score Widgets & Operational Intelligence Panels
 */

import React from 'react';
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { OperationalHealth } from '../../api/analyticsApi';

// ── Score colour helpers ──────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function riskColor(score: number): string {
  if (score <= 20) return '#10b981';
  if (score <= 50) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

// ── Radial gauge widget ───────────────────────────────────────────────────────
export const HealthGauge: React.FC<{
  label:    string;
  score:    number;
  subtitle?: string;
}> = ({ label, score, subtitle }) => {
  const color = scoreColor(score);
  const data  = [{ value: score, fill: color }];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="relative" style={{ height: 110 }}>
        <ResponsiveContainer width="100%" height={110}>
          <RadialBarChart
            cx="50%" cy="55%" innerRadius="70%" outerRadius="100%"
            startAngle={180} endAngle={0}
            data={[{ value: 100, fill: '#1e293b' }, ...data]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background={false} dataKey="value" angleAxisId={0} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-3">
          <p style={{ color }} className="text-2xl font-bold">{score}</p>
          <p style={{ color }} className="text-[10px] font-semibold">{scoreLabel(score)}</p>
        </div>
      </div>
      {subtitle && <p className="text-[10px] text-slate-600 mt-1">{subtitle}</p>}
    </div>
  );
};

// ── Operational Health Dashboard ──────────────────────────────────────────────
export const OperationalHealthPanel: React.FC<{
  health: OperationalHealth;
}> = ({ health }) => (
  <div className="space-y-4">
    {/* Score gauges */}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <HealthGauge label="Overall Health"     score={health.overall_health}          subtitle="Platform-wide" />
      <HealthGauge label="Workflow Reliability" score={health.workflow_reliability}   subtitle="Success consistency" />
      <HealthGauge label="Integration Health" score={health.integration_reliability}  subtitle="OAuth & API" />
    </div>

    {/* Risk & Pressure meters */}
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Risk Score</p>
        <p style={{ color: riskColor(health.risk_score) }} className="text-3xl font-bold">
          {health.risk_score}
        </p>
        <p className="text-slate-600 text-xs mt-1">
          {health.risk_score <= 20 ? 'Low risk' : health.risk_score <= 50 ? 'Moderate risk' : 'High risk — action needed'}
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Queue Pressure</p>
        <p style={{ color: riskColor(health.queue_pressure) }} className="text-3xl font-bold">
          {health.queue_pressure}
        </p>
        <p className="text-slate-600 text-xs mt-1">
          {health.queue_pressure <= 10 ? 'Queue clear' : health.queue_pressure <= 40 ? 'Moderate backlog' : 'Heavy backpressure'}
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Anomaly Score</p>
        <p style={{ color: riskColor(health.anomaly_score) }} className="text-3xl font-bold">
          {health.anomaly_score}
        </p>
        <p className="text-slate-600 text-xs mt-1">
          {health.anomaly_score <= 20 ? 'Normal patterns' : health.anomaly_score <= 60 ? 'Minor deviation' : 'Abnormal traffic'}
        </p>
      </div>
    </div>

    <p className="text-xs text-slate-600 text-right">
      Last computed: {health.computed_at ? new Date(health.computed_at).toLocaleTimeString() : '—'}
    </p>
  </div>
);

// ── Health Trend Line ─────────────────────────────────────────────────────────
export const HealthTrendChart: React.FC<{
  data: Array<{ day: string; overall_health: number; risk_score: number }>
}> = ({ data }) => {
  const formatted = data.map(d => ({
    ...d,
    date: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#64748b' }}
        />
        <Line type="monotone" dataKey="overall_health" name="Health" stroke="#10b981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="risk_score"     name="Risk"   stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
export const StatCard: React.FC<{
  label:     string;
  value:     string | number;
  sub?:      string;
  trend?:    number;
  color?:    string;
}> = ({ label, value, sub, trend, color = '#6366f1' }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</p>
    <p style={{ color }} className="text-2xl font-bold">{value}</p>
    <div className="flex items-center gap-2 mt-1">
      {sub && <p className="text-xs text-slate-600">{sub}</p>}
      {trend !== undefined && (
        <span className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  </div>
);
