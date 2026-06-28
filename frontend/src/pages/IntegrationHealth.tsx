/**
 * AutoFlowNG — Integration Health Page
 * Phase 13.5: Unified view of trigger health, OAuth credential status, and DLQ.
 */

import React, { useEffect, useState } from 'react';
import { Shield, Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Zap, XCircle, ChevronRight, RotateCcw, Link2, Copy } from 'lucide-react';
import { integrationsAPI } from '../lib/integrationsApi';

interface TriggerStat {
  workflow_id: string;
  trigger_id: string;
  workflow_name: string;
  is_active: boolean;
  total_polls: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  last_executed_at: string | null;
  last_status: string;
  last_error: string | null;
  healthScore: number;
}

interface OAuthCredential {
  id: string;
  platform: string;
  type: string;
  healthScore: number;
  healthStatus: string;
  expiresAt: string | null;
  timeToExpiryMs: number | null;
}

interface HealthSummary {
  overallScore: number;
  overallStatus: string;
  triggers: {
    totalTriggers: number;
    healthy: number;
    warning: number;
    critical: number;
    deadLetterCount: number;
  };
  oauth: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    avgScore: number;
  };
}

interface DeadLetter {
  id: string;
  workflow_id: string;
  trigger_id: string;
  workflow_name: string;
  error_message: string;
  attempts: number;
  created_at: string;
  replayed_at: string | null;
}

const API_BASE = '/api';

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    credentials: 'include',
  });
  return r.json();
}

export default function IntegrationHealth() {
  const [summary, setSummary]         = useState<HealthSummary | null>(null);
  const [triggers, setTriggers]       = useState<TriggerStat[]>([]);
  const [credentials, setCredentials] = useState<OAuthCredential[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'triggers' | 'oauth' | 'dlq' | 'redirects'>('triggers');
  const [replayingId, setReplayingId] = useState<string | null>(null);

  // ── OAuth Redirect Config diagnostic ──────────────────────────────────────
  // Separate from `refresh()` below: this calls GET /api/integrations/oauth/
  // redirect-config through the Bearer-token api.ts client (the route uses
  // requireAuth, which checks an Authorization header — not cookies, which
  // is what this page's own apiFetch() sends). Fetched on demand, not on
  // mount, since it's a debugging tool rather than routine page data.
  const [redirectConfig, setRedirectConfig] = useState<any>(null);
  const [redirectLoading, setRedirectLoading] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadRedirectConfig = async () => {
    setRedirectLoading(true);
    setRedirectError(null);
    try {
      const res = await integrationsAPI.redirectConfig();
      setRedirectConfig(res);
    } catch (e: any) {
      setRedirectError(e?.message || 'Failed to load redirect config — make sure you are logged in.');
    } finally {
      setRedirectLoading(false);
    }
  };

  const copyToClipboard = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [healthRes, triggerRes, oauthRes, dlqRes] = await Promise.all([
        apiFetch('/integrations/health'),
        apiFetch('/integrations/triggers'),
        apiFetch('/integrations/oauth/health'),
        apiFetch('/integrations/deadletters'),
      ]);

      if (healthRes.ok)   setSummary(healthRes);
      if (triggerRes.ok)  setTriggers(triggerRes.triggers || []);
      if (oauthRes.ok)    setCredentials(oauthRes.credentials || []);
      if (dlqRes.ok)      setDeadLetters(dlqRes.deadLetters || []);
    } catch (_) {
      // silently degrade — individual panel states retain last-known data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const replayDlq = async (id: string) => {
    setReplayingId(id);
    try {
      await apiFetch(`/integrations/deadletters/${id}/replay`, { method: 'POST' });
      await refresh();
    } finally {
      setReplayingId(null);
    }
  };

  const resetTriggerState = async (workflowId: string, triggerId: string) => {
    await apiFetch(`/integrations/triggers/${workflowId}/reset`, {
      method: 'POST',
      body: JSON.stringify({ triggerId }),
    });
    await refresh();
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const statusIcon = (status: string) => {
    if (status === 'healthy' || status === 'success') return <CheckCircle size={14} color="#22c55e" />;
    if (status === 'warning') return <AlertTriangle size={14} color="#f59e0b" />;
    if (status === 'critical' || status === 'error') return <XCircle size={14} color="#ef4444" />;
    return <Clock size={14} color="#6b7280" />;
  };

  const platformIcon: Record<string, string> = {
    facebook: '🔵', instagram: '📸', whatsapp: '💬', telegram: '✈️',
    youtube: '🔴', gmail: '📧', google_sheets: '📊', salesforce: '☁️',
    tiktok: '🎵', discord: '🎮',
  };

  if (loading && !summary) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <RefreshCw size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading integration health...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <Shield size={24} color="#6366f1" />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f9fafb', margin: 0 }}>
              Integration Health
            </h1>
          </div>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>
            Trigger execution status, OAuth health, and reliability diagnostics
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 8,
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
            color: '#818cf8', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <SummaryCard
            label="Overall Health"
            value={`${summary.overallScore}%`}
            sub={summary.overallStatus}
            icon={<Activity size={20} color={scoreColor(summary.overallScore)} />}
            color={scoreColor(summary.overallScore)}
          />
          <SummaryCard
            label="Active Triggers"
            value={String(summary.triggers.totalTriggers)}
            sub={`${summary.triggers.healthy} healthy`}
            icon={<Zap size={20} color="#6366f1" />}
            color="#6366f1"
          />
          <SummaryCard
            label="OAuth Credentials"
            value={String(summary.oauth.total)}
            sub={`Score: ${summary.oauth.avgScore}`}
            icon={<Shield size={20} color="#22c55e" />}
            color={scoreColor(summary.oauth.avgScore)}
          />
          <SummaryCard
            label="Dead Letters"
            value={String(summary.triggers.deadLetterCount)}
            sub={summary.triggers.deadLetterCount > 0 ? 'Needs attention' : 'All clear'}
            icon={<AlertTriangle size={20} color={summary.triggers.deadLetterCount > 0 ? '#ef4444' : '#22c55e'} />}
            color={summary.triggers.deadLetterCount > 0 ? '#ef4444' : '#22c55e'}
          />
        </div>
      )}

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 1 }}>
        {(['triggers', 'oauth', 'dlq', 'redirects'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'redirects' && !redirectConfig) loadRedirectConfig();
            }}
            style={{
              padding: '8px 20px', borderRadius: '8px 8px 0 0',
              background: activeTab === tab ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: 'none', borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
              color: activeTab === tab ? '#818cf8' : '#6b7280',
              cursor: 'pointer', fontSize: 13, fontWeight: 500, textTransform: 'capitalize',
            }}
          >
            {tab === 'dlq' ? 'Dead Letters' : tab === 'oauth' ? 'OAuth Health' : tab === 'redirects' ? 'Redirect Config' : 'Trigger Health'}
            {tab === 'dlq' && deadLetters.length > 0 && (
              <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                {deadLetters.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'triggers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {triggers.length === 0 ? (
            <EmptyState icon={<Zap size={40} color="#374151" />} message="No active integration triggers" sub="Create a workflow with an integration trigger to see health data here" />
          ) : (
            triggers.map(t => (
              <TriggerRow key={`${t.workflow_id}:${t.trigger_id}`} stat={t} scoreColor={scoreColor} statusIcon={statusIcon} platformIcon={platformIcon} onReset={resetTriggerState} />
            ))
          )}
        </div>
      )}

      {activeTab === 'oauth' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {credentials.length === 0 ? (
            <EmptyState icon={<Shield size={40} color="#374151" />} message="No OAuth credentials found" sub="Connect integrations via the Connections page" />
          ) : (
            credentials.map(c => (
              <OAuthRow key={c.id} cred={c} scoreColor={scoreColor} platformIcon={platformIcon} statusIcon={statusIcon} />
            ))
          )}
        </div>
      )}

      {activeTab === 'dlq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deadLetters.length === 0 ? (
            <EmptyState icon={<CheckCircle size={40} color="#22c55e" />} message="Dead letter queue is empty" sub="No unrecoverable trigger failures — all systems nominal" />
          ) : (
            deadLetters.map(dl => (
              <DlqRow key={dl.id} entry={dl} replayingId={replayingId} onReplay={replayDlq} />
            ))
          )}
        </div>
      )}

      {/* Redirect Config tab — diagnostic for OAuth redirect_uri mismatches.
          See routes/integrations.js GET /oauth/redirect-config. This shows
          the EXACT redirect_uri string the backend sends to each provider,
          so it can be copied straight into Google Cloud Console / Notion's
          integration settings without guessing at BACKEND_URL's real value. */}
      {activeTab === 'redirects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, maxWidth: 560 }}>
              Shows the exact redirect_uri this backend sends for each OAuth platform.
              Copy a value and paste it into that provider's developer console if you're seeing
              a "redirect_uri_mismatch" or "invalid redirect_uri" error.
            </p>
            <button
              onClick={loadRedirectConfig}
              disabled={redirectLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: redirectLoading ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
            >
              <RefreshCw size={13} style={redirectLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
              {redirectLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {redirectError && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
              {redirectError}
            </div>
          )}

          {!redirectConfig && !redirectLoading && !redirectError && (
            <EmptyState icon={<Link2 size={40} color="#374151" />} message="No data loaded yet" sub="Click Refresh to fetch the current redirect configuration" />
          )}

          {redirectConfig && (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <ConfigBadge label="BACKEND_URL" value={redirectConfig.backendUrl} />
                <ConfigBadge label="FRONTEND_URL" value={redirectConfig.frontendUrl} />
              </div>

              <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                {redirectConfig.note}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Marketplace Connections (Notion, Slack, Twitter, LinkedIn, etc.)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(redirectConfig.marketplaceConnections || {}).map(([id, cfg]: [string, any]) => (
                    <RedirectRow key={id} id={id} cfg={cfg} copiedKey={copiedKey} onCopy={copyToClipboard} />
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Legacy Connections (Gmail, Google, Slack, GitHub, etc.)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(redirectConfig.legacyConnections || {}).map(([id, cfg]: [string, any]) => (
                    <RedirectRow key={id} id={id} cfg={cfg} copiedKey={copiedKey} onCopy={copyToClipboard} />
                  ))}
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>Discord</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{redirectConfig.discord?.note}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <span style={{ color: redirectConfig.discord?.configured ? '#22c55e' : '#ef4444' }}>
                    Client ID: {redirectConfig.discord?.configured ? 'Configured' : 'Missing'}
                  </span>
                  <span style={{ color: redirectConfig.discord?.botTokenConfigured ? '#22c55e' : '#ef4444' }}>
                    Bot Token: {redirectConfig.discord?.botTokenConfigured ? 'Configured' : 'Missing'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConfigBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '8px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#e5e7eb', fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

function RedirectRow({ id, cfg, copiedKey, onCopy }: { id: string; cfg: any; copiedKey: string | null; onCopy: (key: string, value: string) => void }) {
  const value = cfg?.redirectUri || '';
  const copyKey = `${id}-redirect`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', textTransform: 'capitalize' }}>{id.replace(/_/g, ' ')}</span>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: cfg?.configured ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: cfg?.configured ? '#22c55e' : '#ef4444' }}>
            {cfg?.configured ? 'Configured' : 'Not Configured'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{value}</div>
      </div>
      {value && !value.startsWith('(') && (
        <button
          onClick={() => onCopy(copyKey, value)}
          title="Copy redirect_uri"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: copiedKey === copyKey ? '#22c55e' : '#9ca3af', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
        >
          <Copy size={11} /> {copiedKey === copyKey ? 'Copied!' : 'Copy'}
        </button>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, icon, color }: { label: string; value: string; sub: string; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        {icon}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{sub}</div>
    </div>
  );
}

function TriggerRow({ stat, scoreColor, statusIcon, platformIcon, onReset }: { stat: TriggerStat; scoreColor: (n: number) => string; statusIcon: (s: string) => React.ReactNode; platformIcon: Record<string, string>; onReset: (wf: string, t: string) => void }) {
  const platform = stat.trigger_id.split('.')[0];
  const lastRun  = stat.last_executed_at ? new Date(stat.last_executed_at).toLocaleString() : 'Never';

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 20, minWidth: 28 }}>{platformIcon[platform] || '🔗'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f9fafb' }}>{stat.workflow_name}</span>
          {!stat.is_active && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: 4, padding: '1px 6px' }}>INACTIVE</span>}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{stat.trigger_id}</div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 80 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Success rate</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor(stat.success_rate) }}>{stat.success_rate}%</div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 80 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Polls</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb' }}>{stat.total_polls}</div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 120 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Last run</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>{lastRun}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {statusIcon(stat.last_status)}
        <span style={{ fontSize: 12, color: scoreColor(stat.healthScore), fontWeight: 600 }}>{stat.healthScore}</span>
      </div>
      <button
        onClick={() => onReset(stat.workflow_id, stat.trigger_id)}
        title="Reset trigger state"
        style={{ padding: '6px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', cursor: 'pointer' }}
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
}

function OAuthRow({ cred, scoreColor, platformIcon, statusIcon }: { cred: OAuthCredential; scoreColor: (n: number) => string; platformIcon: Record<string, string>; statusIcon: (s: string) => React.ReactNode }) {
  const expiresIn = cred.timeToExpiryMs != null
    ? cred.timeToExpiryMs < 0
      ? 'Expired'
      : `${Math.round(cred.timeToExpiryMs / 60_000)}m`
    : '—';

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 20, minWidth: 28 }}>{platformIcon[cred.platform] || '🔑'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f9fafb', textTransform: 'capitalize' }}>{cred.platform.replace('_', ' ')}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{cred.type}</div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 100 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Expires in</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: cred.timeToExpiryMs != null && cred.timeToExpiryMs < 600_000 ? '#ef4444' : '#e5e7eb' }}>{expiresIn}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {statusIcon(cred.healthStatus)}
        <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor(cred.healthScore) }}>{cred.healthScore}</span>
        <span style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{cred.healthStatus}</span>
      </div>
    </div>
  );
}

function DlqRow({ entry, replayingId, onReplay }: { entry: DeadLetter; replayingId: string | null; onReplay: (id: string) => void }) {
  return (
    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <XCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f9fafb', marginBottom: 2 }}>{entry.workflow_name}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{entry.trigger_id}</div>
        <div style={{ fontSize: 12, color: '#f87171', fontFamily: 'monospace' }}>{entry.error_message?.slice(0, 120)}</div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 80 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Attempts</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{entry.attempts}</div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 110 }}>
        <div style={{ fontSize: 11, color: '#6b7280' }}>{new Date(entry.created_at).toLocaleDateString()}</div>
        {entry.replayed_at && <div style={{ fontSize: 11, color: '#22c55e' }}>Replayed ✓</div>}
      </div>
      {!entry.replayed_at && (
        <button
          onClick={() => onReplay(entry.id)}
          disabled={replayingId === entry.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 7,
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
            color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
          }}
        >
          <RotateCcw size={12} style={{ animation: replayingId === entry.id ? 'spin 1s linear infinite' : 'none' }} />
          Replay
        </button>
      )}
    </div>
  );
}

function EmptyState({ icon, message, sub }: { icon: React.ReactNode; message: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: '#6b7280' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>{message}</div>
      <div style={{ fontSize: 13 }}>{sub}</div>
    </div>
  );
}
