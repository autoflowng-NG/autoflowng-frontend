/**
 * AutoFlowNG — OAuth Health Monitor Component
 * Phase 13.5: Real-time OAuth token expiry warnings with auto-reconnect prompts.
 * Renders as a dismissible banner or sidebar widget.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Shield, AlertTriangle, XCircle, RefreshCw, X, ChevronRight, Clock } from 'lucide-react';

interface CredentialHealth {
  id: string;
  platform: string;
  type: string;
  expiresAt: string | null;
  healthScore: number;
  healthStatus: string;
  timeToExpiryMs: number | null;
  scannedAt: string | null;
}

interface OAuthHealthSummary {
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  avgScore: number;
}

const PLATFORM_NAMES: Record<string, string> = {
  facebook:       'Facebook',
  instagram:      'Instagram',
  whatsapp:       'WhatsApp Business',
  telegram:       'Telegram',
  youtube:        'YouTube',
  gmail:          'Gmail',
  google_sheets:  'Google Sheets',
  google_drive:   'Google Drive',
  salesforce:     'Salesforce',
  tiktok:         'TikTok',
};

const PLATFORM_ICONS: Record<string, string> = {
  facebook: '🔵', instagram: '📸', whatsapp: '💬', telegram: '✈️',
  youtube: '🔴', gmail: '📧', google_sheets: '📊', google_drive: '📁',
  salesforce: '☁️', tiktok: '🎵',
};

export function OAuthHealthMonitor({
  variant = 'banner',
  onNavigate,
  refreshIntervalMs = 5 * 60_000,
}: {
  variant?: 'banner' | 'widget';
  onNavigate?: (path: string) => void;
  refreshIntervalMs?: number;
}) {
  const [credentials, setCredentials] = useState<CredentialHealth[]>([]);
  const [summary, setSummary]         = useState<OAuthHealthSummary | null>(null);
  const [loading, setLoading]         = useState(true);
  const [dismissed, setDismissed]     = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations/oauth/health', { credentials: 'include' });
      const d = await r.json();
      if (d.ok) {
        setCredentials(d.credentials || []);
        setSummary(d.summary);
        setLastRefresh(new Date());
      }
    } catch (e) {
      console.warn('[OAuthHealthMonitor] Fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchHealth, refreshIntervalMs]);

  const dismiss = (id: string) => setDismissed(prev => new Set([...prev, id]));

  const critical = credentials.filter(c =>
    !dismissed.has(c.id) &&
    (c.healthStatus === 'critical' || c.healthStatus === 'expired')
  );
  const warnings = credentials.filter(c =>
    !dismissed.has(c.id) &&
    c.healthStatus === 'warning'
  );

  // Banner variant: show dismissible alerts for critical/expiring tokens
  if (variant === 'banner') {
    if (!critical.length && !warnings.length) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 0 16px 0' }}>
        {critical.map(cred => (
          <OAuthAlert key={cred.id} cred={cred} level="critical" onDismiss={dismiss} onNavigate={onNavigate} />
        ))}
        {warnings.slice(0, 2).map(cred => (
          <OAuthAlert key={cred.id} cred={cred} level="warning" onDismiss={dismiss} onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  // Widget variant: compact health card
  if (loading) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={16} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!summary) return null;

  const avgColor = summary.avgScore >= 80 ? '#22c55e' : summary.avgScore >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: 16,
        cursor: onNavigate ? 'pointer' : 'default',
      }}
      onClick={() => onNavigate?.('/integration-health')}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={14} color={avgColor} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            OAuth Credentials
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: avgColor }}>{summary.avgScore}</span>
          {onNavigate && <ChevronRight size={13} color="#4b5563" />}
        </div>
      </div>

      {/* Credential pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {credentials.slice(0, 8).map(cred => {
          const c = cred.healthScore >= 80 ? '#22c55e' : cred.healthScore >= 50 ? '#f59e0b' : '#ef4444';
          return (
            <div
              key={cred.id}
              title={`${PLATFORM_NAMES[cred.platform] || cred.platform} — Score: ${cred.healthScore}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: `rgba(${c === '#22c55e' ? '34,197,94' : c === '#f59e0b' ? '245,158,11' : '239,68,68'},0.1)`,
                border: `1px solid ${c}33`, borderRadius: 6, padding: '4px 8px',
              }}
            >
              <span style={{ fontSize: 12 }}>{PLATFORM_ICONS[cred.platform] || '🔑'}</span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
            </div>
          );
        })}
        {credentials.length > 8 && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', color: '#6b7280', fontSize: 11 }}>
            +{credentials.length - 8} more
          </div>
        )}
      </div>

      {/* Expiry warnings */}
      {critical.length > 0 && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={12} color="#ef4444" />
          <span style={{ fontSize: 12, color: '#f87171', fontWeight: 500 }}>
            {critical.length} credential{critical.length > 1 ? 's' : ''} need{critical.length === 1 ? 's' : ''} attention
          </span>
        </div>
      )}

      {/* Last refresh */}
      {lastRefresh && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, color: '#4b5563' }}>
          <Clock size={10} />
          <span style={{ fontSize: 10 }}>
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Alert banner for critical/expiring tokens ─────────────────────────────────

function OAuthAlert({
  cred,
  level,
  onDismiss,
  onNavigate,
}: {
  cred: CredentialHealth;
  level: 'critical' | 'warning';
  onDismiss: (id: string) => void;
  onNavigate?: (path: string) => void;
}) {
  const isCrit  = level === 'critical';
  const color   = isCrit ? '#ef4444' : '#f59e0b';
  const bgColor = isCrit ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
  const border  = isCrit ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)';
  const Icon    = isCrit ? XCircle : AlertTriangle;

  const ttl = cred.timeToExpiryMs != null
    ? cred.timeToExpiryMs < 0
      ? 'has expired'
      : `expires in ${formatTtl(cred.timeToExpiryMs)}`
    : 'is expiring';

  const platform = PLATFORM_NAMES[cred.platform] || cred.platform;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: bgColor, border: `1px solid ${border}`,
      borderRadius: 10, padding: '10px 14px',
    }}>
      <Icon size={16} color={color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f9fafb' }}>
          {platform} token {ttl}
        </span>
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>
          {isCrit ? 'Reconnect to restore automation' : 'Reconnect soon to avoid interruption'}
        </span>
      </div>
      {onNavigate && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate('/integration-health'); }}
          style={{
            padding: '5px 12px', borderRadius: 6, border: `1px solid ${color}44`,
            background: `${color}15`, color, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          Fix now
        </button>
      )}
      <button
        onClick={() => onDismiss(cred.id)}
        style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTtl(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
