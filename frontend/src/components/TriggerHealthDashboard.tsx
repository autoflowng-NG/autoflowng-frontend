/**
 * AutoFlowNG — Trigger Health Dashboard Widget
 * Phase 13.5: Inline health indicator for the main dashboard / sidebar.
 * Shows condensed trigger health without navigating away.
 */

import React, { useEffect, useState } from 'react';
import { Zap, CheckCircle, AlertTriangle, XCircle, Activity, ChevronRight } from 'lucide-react';

interface TriggerHealthData {
  overallScore: number;
  overallStatus: string;
  triggers: {
    totalTriggers: number;
    healthy: number;
    warning: number;
    critical: number;
    deadLetterCount: number;
  };
}

export function TriggerHealthDashboard({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [health, setHealth] = useState<TriggerHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/integrations/health', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.ok) setHealth(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, border: '2px solid #374151', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!health) return null;

  const scoreColor = health.overallScore >= 80 ? '#22c55e' : health.overallScore >= 50 ? '#f59e0b' : '#ef4444';
  const { triggers } = health;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${health.overallScore >= 80 ? 'rgba(34,197,94,0.2)' : health.overallScore >= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
        borderRadius: 12,
        padding: 16,
        cursor: onNavigate ? 'pointer' : 'default',
        transition: 'background 0.2s',
      }}
      onClick={() => onNavigate?.('/integration-health')}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={15} color={scoreColor} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Integration Health
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor }}>{health.overallScore}%</span>
          {onNavigate && <ChevronRight size={14} color="#4b5563" />}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <StatChip icon={<CheckCircle size={13} color="#22c55e" />} label="Healthy" value={triggers.healthy} color="#22c55e" />
        <StatChip icon={<AlertTriangle size={13} color="#f59e0b" />} label="Warning" value={triggers.warning} color="#f59e0b" />
        <StatChip icon={<XCircle size={13} color="#ef4444" />} label="Critical" value={triggers.critical} color="#ef4444" />
      </div>

      {/* Total triggers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={12} color="#6366f1" />
          <span style={{ fontSize: 12, color: '#6b7280' }}>{triggers.totalTriggers} active triggers</span>
        </div>
        {triggers.deadLetterCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '3px 8px',
          }}>
            <AlertTriangle size={11} color="#ef4444" />
            <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>
              {triggers.deadLetterCount} dead {triggers.deadLetterCount === 1 ? 'letter' : 'letters'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{
      background: `rgba(${color === '#22c55e' ? '34,197,94' : color === '#f59e0b' ? '245,158,11' : '239,68,68'},0.08)`,
      borderRadius: 8, padding: '8px 10px', textAlign: 'center',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ── OAuth Health Indicator ────────────────────────────────────────────────────
// Compact component for connection list rows

export function ConnectionHealthBadge({ platform, orgId }: { platform: string; orgId?: string }) {
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/integrations/oauth/health', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.credentials) {
          const cred = d.credentials.find((c: { platform: string }) => c.platform === platform);
          setScore(cred?.healthScore ?? null);
        }
      })
      .catch(() => {});
  }, [platform]);

  if (score === null) return null;

  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Warning' : 'Critical';
  const Icon  = score >= 80 ? CheckCircle : score >= 50 ? AlertTriangle : XCircle;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: `rgba(${color === '#22c55e' ? '34,197,94' : color === '#f59e0b' ? '245,158,11' : '239,68,68'},0.1)`,
      border: `1px solid ${color}33`,
      borderRadius: 6, padding: '3px 8px',
    }}>
      <Icon size={11} color={color} />
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
