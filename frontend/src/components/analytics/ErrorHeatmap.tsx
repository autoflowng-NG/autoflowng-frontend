/**
 * AutoFlowNG — Phase 14 Error Heatmap Component
 * 7×24 calendar heatmap of error frequency by day-of-week × hour-of-day.
 */

import React, { useMemo } from 'react';
import type { HeatmapCell } from '../../api/analyticsApi';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

function interpolateColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#1e293b';
  const pct = Math.min(1, value / max);
  if (pct < 0.33) return `rgba(99, 102, 241, ${0.2 + pct * 0.8})`; // indigo
  if (pct < 0.66) return `rgba(245, 158, 11, ${0.4 + pct * 0.6})`; // amber
  return `rgba(239, 68, 68, ${0.5 + pct * 0.5})`; // red
}

interface Props {
  data: HeatmapCell[];
  title?: string;
}

export const ErrorHeatmap: React.FC<Props> = ({ data, title = 'Error Heatmap (30 days)' }) => {
  const { matrix, maxCount } = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let max = 0;
    for (const cell of data) {
      grid[cell.day][cell.hour] = cell.count;
      if (cell.count > max) max = cell.count;
    }
    return { matrix: grid, maxCount: max };
  }, [data]);

  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-slate-300 mb-3">{title}</h3>}

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Hour axis */}
          <div className="flex ml-9 mb-1">
            {HOURS.filter((_, i) => i % 3 === 0).map((h, i) => (
              <div key={i} className="text-slate-600 text-[9px]" style={{ width: `${100 / 8}%` }}>{h}</div>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map((day, d) => (
            <div key={day} className="flex items-center gap-1 mb-0.5">
              <span className="text-slate-600 text-[10px] w-8 shrink-0 text-right pr-1">{day}</span>
              <div className="flex gap-0.5 flex-1">
                {matrix[d].map((count, h) => (
                  <div
                    key={h}
                    title={`${day} ${h}:00 — ${count} errors`}
                    className="flex-1 rounded-[2px] cursor-pointer hover:ring-1 hover:ring-slate-400 transition-all"
                    style={{
                      height: 16,
                      backgroundColor: interpolateColor(count, maxCount),
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 ml-9">
            <span className="text-slate-600 text-[10px]">Less</span>
            {[0, 0.1, 0.33, 0.66, 1].map(pct => (
              <div key={pct} className="w-3 h-3 rounded-[2px]"
                   style={{ backgroundColor: interpolateColor(pct * maxCount, maxCount) }} />
            ))}
            <span className="text-slate-600 text-[10px]">More ({maxCount} peak)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Top Error Causes List ─────────────────────────────────────────────────────
export const TopErrorCausesList: React.FC<{
  data: Array<{
    error_type: string;
    total_occurrences: number;
    affected_workflows: number;
    last_seen: string;
  }>;
}> = ({ data }) => {
  const maxCount = Math.max(...data.map(e => e.total_occurrences), 1);

  const CATEGORY_COLORS: Record<string, string> = {
    AUTH:       '#f59e0b',
    RATE_LIMIT: '#8b5cf6',
    TIMEOUT:    '#ef4444',
    NETWORK:    '#3b82f6',
    NOT_FOUND:  '#6366f1',
    VALIDATION: '#10b981',
    DEPENDENCY: '#f97316',
    INTERNAL:   '#ec4899',
    UNKNOWN:    '#475569',
  };

  return (
    <div className="space-y-2">
      {data.length === 0 && (
        <p className="text-slate-600 text-sm text-center py-4">No errors recorded</p>
      )}
      {data.map(err => {
        const barPct = (err.total_occurrences / maxCount) * 100;
        const color  = CATEGORY_COLORS[err.error_type] || '#475569';
        return (
          <div key={err.error_type} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-slate-300 font-medium">{err.error_type}</span>
                <span className="text-slate-600">({err.affected_workflows} workflows)</span>
              </div>
              <span className="text-slate-400 font-mono">{err.total_occurrences.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${barPct}%`, backgroundColor: color, opacity: 0.7 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
