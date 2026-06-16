/**
 * AutoFlowNG — Phase 14 Workflow Rankings Component
 * Ranked table with health scores, performance metrics, and bottleneck badges.
 */

import React from 'react';
import type { WorkflowRanking, BottleneckWorkflow } from '../../api/analyticsApi';

function fmtMs(ms: number | null) {
  if (!ms) return '—';
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-emerald-400 bg-emerald-950 border-emerald-800' :
    score >= 60 ? 'text-amber-400  bg-amber-950  border-amber-800' :
                  'text-red-400    bg-red-950     border-red-800';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${color}`}>
      {score}
    </span>
  );
}

const BOTTLENECK_LABELS: Record<string, string> = {
  high_failure_rate: 'High Failure',
  high_latency:      'High Latency',
  high_retry_rate:   'High Retries',
  low_health:        'Low Health',
  degraded:          'Degraded',
};

export const WorkflowRankingsTable: React.FC<{
  data: WorkflowRanking[];
  title?: string;
}> = ({ data, title = 'Workflow Performance Rankings' }) => (
  <div>
    {title && (
      <h3 className="text-sm font-semibold text-slate-300 mb-3">{title}</h3>
    )}
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left text-slate-500 font-medium py-2 pr-4">Workflow</th>
            <th className="text-center text-slate-500 font-medium py-2 px-3">Health</th>
            <th className="text-center text-slate-500 font-medium py-2 px-3">Reliability</th>
            <th className="text-right text-slate-500 font-medium py-2 px-3">Success %</th>
            <th className="text-right text-slate-500 font-medium py-2 px-3">Failure %</th>
            <th className="text-right text-slate-500 font-medium py-2 px-3">P95</th>
            <th className="text-right text-slate-500 font-medium py-2 px-3">7d Runs</th>
            <th className="text-left text-slate-500 font-medium py-2 pl-3">Last Run</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((wf, i) => (
            <tr key={wf.workflow_id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-4 shrink-0">{i + 1}</span>
                  <span className="text-slate-200 font-medium truncate max-w-[160px]" title={wf.workflow_id}>
                    {wf.workflow_id}
                  </span>
                </div>
              </td>
              <td className="py-2 px-3 text-center"><ScoreBadge score={wf.health_score} /></td>
              <td className="py-2 px-3 text-center"><ScoreBadge score={wf.reliability_score} /></td>
              <td className="py-2 px-3 text-right text-emerald-400">{wf.success_rate ?? '—'}%</td>
              <td className="py-2 px-3 text-right text-red-400">{wf.failure_rate ?? '—'}%</td>
              <td className="py-2 px-3 text-right text-slate-300">{fmtMs(wf.p95_duration_ms)}</td>
              <td className="py-2 px-3 text-right text-slate-300">{wf.executions_7d?.toLocaleString()}</td>
              <td className="py-2 pl-3 text-slate-500">
                {wf.last_executed_at
                  ? new Date(wf.last_executed_at).toLocaleDateString()
                  : '—'}
              </td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-600">No workflow data yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export const BottleneckList: React.FC<{ data: BottleneckWorkflow[] }> = ({ data }) => (
  <div className="space-y-2">
    {data?.length === 0 && (
      <p className="text-slate-600 text-sm text-center py-4">No bottlenecks detected</p>
    )}
    {data?.map(wf => (
      <div key={wf.workflow_id}
           className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <span className="text-slate-200 text-xs truncate">{wf.workflow_id}</span>
          <span className="text-xs text-red-400 bg-red-950 border border-red-800 px-1.5 py-0.5 rounded shrink-0">
            {BOTTLENECK_LABELS[wf.bottleneck_type] || wf.bottleneck_type}
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-3">
          <span className="text-slate-500 text-xs">Health <span className="text-white">{wf.health_score}</span></span>
          <span className="text-slate-500 text-xs">P95 <span className="text-white">{fmtMs(wf.p95_duration_ms)}</span></span>
          <span className="text-slate-500 text-xs">Fail <span className="text-red-400">{wf.failure_rate}%</span></span>
        </div>
      </div>
    ))}
  </div>
);
