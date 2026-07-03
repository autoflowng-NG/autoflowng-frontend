/**
 * RankedTopWorkflows — ranked-by-volume workflow list with % change badges
 * and progress bars, matching the enterprise dashboard reference design.
 * Data source: GET /api/analytics/executions/top-workflows (real execution_metrics data).
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../../api/analyticsApi';

interface RankedWorkflow {
  workflow_id: string;
  workflow_name: string | null;
  total_runs: number;
  success_rate: number;
  pct_change: number;
}

const C = {
  purple: '#7C3AED', green: '#10b981', red: '#ef4444',
  text: '#e2e8f0', faint: '#64748b', border: 'rgba(255,255,255,0.06)',
};

export function RankedTopWorkflows({ onNav }: { onNav: (path: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['top-workflows-ranked'],
    queryFn: () => analyticsApi.getTopWorkflows(5),
    staleTime: 60 * 1000,
  });

  const workflows: RankedWorkflow[] = (data as any) || [];
  const maxRuns = Math.max(...workflows.map(w => w.total_runs), 1);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif" }}>
          Top Workflows
        </div>
        <button
          onClick={() => onNav('/analytics')}
          style={{ fontSize: 12, color: C.purple, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          View all
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: C.faint, fontSize: 13 }}>
          No execution data yet for this billing period.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {workflows.map((wf, i) => {
            const barPct = Math.round((wf.total_runs / maxRuns) * 100);
            const changeColor = wf.pct_change >= 0 ? C.green : C.red;
            const changeSign = wf.pct_change >= 0 ? '↑' : '↓';
            return (
              <div key={wf.workflow_id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.faint, width: 14 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {wf.workflow_name || `Workflow ${wf.workflow_id}`}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{wf.total_runs.toLocaleString()}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: changeColor, minWidth: 48, textAlign: 'right' }}>
                    {changeSign} {Math.abs(wf.pct_change)}%
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${barPct}%`, borderRadius: 3,
                    background: `linear-gradient(90deg, ${C.purple}, ${C.purple}cc)`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
