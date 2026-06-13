/**
 * AutoFlowNG — Phase 45 Ops Center
 * Global Autonomous Campaign Orchestration — Operations UI
 *
 * Sections:
 *   1. Campaign Lifecycle Overview
 *   2. Approval Queue (pending items with risk score details)
 *   3. Escalation Queue
 *   4. Campaign Brief Submission
 *   5. Performance Snapshots
 */

import { useState, useEffect, useCallback } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  lifecycle_state: string;
  approval_mode: string;
  current_state_entered_at: string;
}

interface ApprovalItem {
  id: string;
  campaign_id: string;
  campaign_name?: string;
  risk_score: number;
  risk_category: string;
  contributing_factors: ContributingFactor[];
  policy_version: string;
  force_escalation_reasons: string[];
  assigned_role: string;
  sla_due_at: string;
  sla_breached: boolean;
  status: string;
  created_at: string;
}

interface EscalationItem {
  id: string;
  campaign_id: string;
  campaign_name?: string;
  source: string;
  risk_score: number | null;
  contributing_factors: ContributingFactor[];
  force_escalation_reasons: string[];
  status: string;
  created_at: string;
}

interface ContributingFactor {
  factor: string;
  weight: number;
  dimension: string;
  matched: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiBase(): string {
  return (window as any).__BASE_URL__ ?? '';
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${getApiBase()}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

function categoryColor(cat: string): string {
  return {
    low:      'bg-emerald-900 text-emerald-300 border-emerald-700',
    medium:   'bg-yellow-900 text-yellow-300 border-yellow-700',
    high:     'bg-orange-900 text-orange-300 border-orange-700',
    critical: 'bg-red-900 text-red-300 border-red-700',
  }[cat] ?? 'bg-gray-800 text-gray-300 border-gray-700';
}

function stateColor(state: string): string {
  const colors: Record<string, string> = {
    DRAFT:             'text-gray-400',
    PLANNING:          'text-blue-400',
    GENERATING:        'text-purple-400',
    AWAITING_APPROVAL: 'text-yellow-400',
    SCHEDULED:         'text-cyan-400',
    PUBLISHING:        'text-indigo-400',
    LIVE:              'text-emerald-400',
    MONITORING:        'text-teal-400',
    COMPLETED:         'text-green-400',
    ARCHIVED:          'text-gray-500',
    CANCELLED:         'text-gray-500',
    FAILED:            'text-red-400',
  };
  return colors[state] ?? 'text-gray-400';
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function RiskBadge({ score, category, forceEscalation }: { score: number; category: string; forceEscalation?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${categoryColor(category)}`}>
      {forceEscalation && <span title="Force escalation flag">⚡</span>}
      {score} · {category}
    </span>
  );
}

function ContributingFactorsList({ factors }: { factors: ContributingFactor[] }) {
  if (!factors || factors.length === 0) return <span className="text-gray-500 text-xs">No risk factors</span>;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {factors.map((f) => (
        <span key={f.factor} className="text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-300">
          {f.factor} <span className="text-amber-400">+{f.weight}</span>
        </span>
      ))}
    </div>
  );
}

function SLATimer({ dueAt, breached }: { dueAt: string; breached: boolean }) {
  const remaining = new Date(dueAt).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(remaining / 3600000));
  const mins  = Math.max(0, Math.floor((remaining % 3600000) / 60000));

  if (breached) return <span className="text-red-400 text-xs font-semibold">SLA BREACHED</span>;
  if (remaining <= 0) return <span className="text-orange-400 text-xs font-semibold">Overdue</span>;
  return (
    <span className={`text-xs ${remaining < 3600000 ? 'text-orange-400' : 'text-gray-400'}`}>
      {hours}h {mins}m remaining
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Phase45OpsCenter() {
  const [tab, setTab] = useState<'lifecycle' | 'approval' | 'escalation' | 'brief'>('lifecycle');

  // Data state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([]);
  const [escalationQueue, setEscalationQueue] = useState<EscalationItem[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefText, setBriefText] = useState('');
  const [briefCampaignId, setBriefCampaignId] = useState('');
  const [briefResult, setBriefResult] = useState<any>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [actioningItem, setActioningItem] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const { subscribe } = useWebSocketContext();

  // Fetch org context from local storage / user context (fallback)
  const orgId = (window as any).__ORG_ID__ ?? 'demo';

  // ── Data fetchers ─────────────────────────────────────────────────────────

  const fetchCampaigns = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/orgs/${orgId}/campaigns/lifecycle?limit=50`);
      setCampaigns(data.items ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const fetchApprovalQueue = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await apiFetch(`/orgs/${orgId}/approval-queue?limit=50`);
      setApprovalQueue(data.items ?? []);
    } catch (_) {}
  }, [orgId]);

  const fetchEscalationQueue = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await apiFetch(`/orgs/${orgId}/escalation-queue?limit=50`);
      setEscalationQueue(data.items ?? []);
    } catch (_) {}
  }, [orgId]);

  useEffect(() => {
    fetchCampaigns();
    fetchApprovalQueue();
    fetchEscalationQueue();
    const t = setInterval(() => {
      fetchApprovalQueue();
      fetchEscalationQueue();
    }, 30000);
    return () => clearInterval(t);
  }, [fetchCampaigns, fetchApprovalQueue, fetchEscalationQueue]);

  // WebSocket: refresh campaign list and approval queue when a publish job completes
  useEffect(() => {
    const unsub = subscribe('publish:complete', (_event: any) => {
      fetchCampaigns();
      fetchApprovalQueue();
      fetchEscalationQueue();
    });
    return () => unsub();
  }, [subscribe, fetchCampaigns, fetchApprovalQueue, fetchEscalationQueue]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleBriefSubmit = async () => {
    if (!briefText.trim() || !briefCampaignId.trim()) {
      setBriefError('Campaign ID and brief text are required');
      return;
    }
    setBriefLoading(true);
    setBriefError(null);
    setBriefResult(null);
    try {
      const result = await apiFetch(`/campaigns/${briefCampaignId}/brief`, {
        method: 'POST',
        body:   JSON.stringify({ brief_text: briefText, auto_advance: true }),
      });
      setBriefResult(result);
      fetchCampaigns();
    } catch (err: any) {
      setBriefError(err.message);
    } finally {
      setBriefLoading(false);
    }
  };

  const handleApprovalAction = async (itemId: string, action: string) => {
    if (!overrideReason && ['force_publish', 'force_block', 'reject'].includes(action)) {
      alert('Please provide a reason for this action.');
      return;
    }
    setActioningItem(itemId);
    try {
      await apiFetch(`/approval-queue/${itemId}/action`, {
        method: 'POST',
        body:   JSON.stringify({ action, reason: overrideReason }),
      });
      setOverrideReason('');
      fetchApprovalQueue();
      fetchEscalationQueue();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActioningItem(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Campaign Orchestration</h1>
            <p className="text-sm text-gray-400 mt-0.5">Phase 45 — Global Autonomous Campaign Orchestration</p>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-400">
              {campaigns.length} campaigns
            </span>
            <span className={`rounded px-2 py-1 border text-xs ${approvalQueue.length > 0 ? 'bg-yellow-900 border-yellow-700 text-yellow-300' : 'bg-gray-900 border-gray-700 text-gray-500'}`}>
              {approvalQueue.length} pending approvals
            </span>
            <span className={`rounded px-2 py-1 border text-xs ${escalationQueue.length > 0 ? 'bg-red-900 border-red-700 text-red-300' : 'bg-gray-900 border-gray-700 text-gray-500'}`}>
              {escalationQueue.length} escalations
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {([
            ['lifecycle',  'Lifecycle',       campaigns.length],
            ['approval',   'Approval Queue',  approvalQueue.length],
            ['escalation', 'Escalations',     escalationQueue.length],
            ['brief',      'Submit Brief',    null],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`px-4 py-1.5 text-sm rounded transition-colors ${
                tab === key
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {label}
              {count != null && count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === key ? 'bg-black text-amber-500' : 'bg-gray-700 text-gray-300'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">

        {/* ── Lifecycle Tab ─────────────────────────────────────────────── */}
        {tab === 'lifecycle' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Campaign Lifecycle Overview</h2>
              <button onClick={fetchCampaigns} className="text-xs text-gray-400 hover:text-white transition-colors">
                ↻ Refresh
              </button>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-300 text-sm mb-4">{error}</div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No campaigns yet. Submit a brief to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map((c) => (
                  <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-white">{c.name ?? c.id}</span>
                        <span className="ml-2 text-xs text-gray-500">{c.id}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-mono font-semibold ${stateColor(c.lifecycle_state)}`}>
                          {c.lifecycle_state}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                          {c.approval_mode}
                        </span>
                        <span className="text-xs text-gray-500">{relativeTime(c.current_state_entered_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Approval Queue Tab ────────────────────────────────────────── */}
        {tab === 'approval' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Approval Queue</h2>
              <button onClick={fetchApprovalQueue} className="text-xs text-gray-400 hover:text-white">
                ↻ Refresh
              </button>
            </div>

            {approvalQueue.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No pending approval items.</div>
            ) : (
              <div className="space-y-3">
                {approvalQueue.map((item) => (
                  <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <RiskBadge
                            score={item.risk_score}
                            category={item.risk_category}
                            forceEscalation={item.force_escalation_reasons?.length > 0}
                          />
                          <span className="text-xs text-gray-400">v{item.policy_version}</span>
                          <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 border border-gray-700">
                            {item.assigned_role}
                          </span>
                          {item.sla_breached && (
                            <span className="text-xs bg-red-900 border border-red-700 px-1.5 py-0.5 rounded text-red-300">
                              SLA BREACHED
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-300 font-medium">
                          Campaign: {item.campaign_name ?? item.campaign_id}
                        </p>

                        <ContributingFactorsList factors={item.contributing_factors} />

                        {item.force_escalation_reasons?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.force_escalation_reasons.map((r) => (
                              <span key={r} className="text-xs bg-red-900/50 border border-red-700 rounded px-1.5 py-0.5 text-red-300">
                                ⚡ {r}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-2">
                          <SLATimer dueAt={item.sla_due_at} breached={item.sla_breached} />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 min-w-[180px]">
                        <input
                          type="text"
                          placeholder="Reason (required for force actions)..."
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white placeholder-gray-500 w-full"
                        />
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            onClick={() => handleApprovalAction(item.id, 'approve')}
                            disabled={actioningItem === item.id}
                            className="text-xs bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 text-emerald-300 rounded px-2 py-1 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprovalAction(item.id, 'reject')}
                            disabled={actioningItem === item.id}
                            className="text-xs bg-red-900 hover:bg-red-800 border border-red-700 text-red-300 rounded px-2 py-1 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApprovalAction(item.id, 'approve_with_exception')}
                            disabled={actioningItem === item.id}
                            className="text-xs bg-yellow-900 hover:bg-yellow-800 border border-yellow-700 text-yellow-300 rounded px-2 py-1 transition-colors disabled:opacity-50 col-span-1"
                          >
                            + Exception
                          </button>
                          <button
                            onClick={() => handleApprovalAction(item.id, 'escalate')}
                            disabled={actioningItem === item.id}
                            className="text-xs bg-orange-900 hover:bg-orange-800 border border-orange-700 text-orange-300 rounded px-2 py-1 transition-colors disabled:opacity-50"
                          >
                            Escalate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Escalation Queue Tab ──────────────────────────────────────── */}
        {tab === 'escalation' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-red-400">Escalation Queue</h2>
              <button onClick={fetchEscalationQueue} className="text-xs text-gray-400 hover:text-white">
                ↻ Refresh
              </button>
            </div>

            {escalationQueue.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No open escalations.</div>
            ) : (
              <div className="space-y-3">
                {escalationQueue.map((item) => (
                  <div key={item.id} className="bg-red-950 border border-red-900 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-red-900 border border-red-700 text-red-300 rounded px-2 py-0.5 uppercase tracking-wide font-semibold">
                            {item.source.replace(/_/g, ' ')}
                          </span>
                          {item.risk_score != null && (
                            <RiskBadge score={item.risk_score} category="critical" />
                          )}
                        </div>

                        <p className="text-sm text-white font-medium">
                          Campaign: {item.campaign_name ?? item.campaign_id}
                        </p>

                        {item.force_escalation_reasons?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.force_escalation_reasons.map((r) => (
                              <span key={r} className="text-xs bg-red-900/50 border border-red-700 rounded px-1.5 py-0.5 text-red-300">
                                ⚡ {r}
                              </span>
                            ))}
                          </div>
                        )}

                        <ContributingFactorsList factors={item.contributing_factors} />
                        <p className="text-xs text-gray-400 mt-2">{relativeTime(item.created_at)}</p>
                      </div>
                      <div className="text-xs text-red-400 font-semibold">Requires senior_approver</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Brief Submission Tab ──────────────────────────────────────── */}
        {tab === 'brief' && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Submit Campaign Brief</h2>
            <p className="text-sm text-gray-400 mb-4">
              Enter a plain-text campaign brief. The system will parse it, generate a plan,
              create assets, and route through the risk engine automatically.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Campaign ID</label>
                <input
                  type="text"
                  value={briefCampaignId}
                  onChange={(e) => setBriefCampaignId(e.target.value)}
                  placeholder="e.g. camp-550e8400-e29b-41d4-a716-446655440000"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Campaign Brief</label>
                <textarea
                  rows={6}
                  value={briefText}
                  onChange={(e) => setBriefText(e.target.value)}
                  placeholder="Describe your campaign in plain English. Include goal, target audience, budget, duration, and platforms if known.&#10;&#10;Example: Run a 30-day Facebook and Instagram campaign targeting adults 25–45 interested in fitness. Budget $5,000. Goal: 500 conversions."
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {briefError && (
                <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-300 text-sm">
                  {briefError}
                </div>
              )}

              <button
                onClick={handleBriefSubmit}
                disabled={briefLoading}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm px-4 py-2 rounded transition-colors flex items-center gap-2"
              >
                {briefLoading && (
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                )}
                {briefLoading ? 'Processing...' : 'Submit Brief'}
              </button>

              {briefResult && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-emerald-400 text-sm font-semibold">✓ Brief Submitted</span>
                    <span className={`text-sm font-mono font-semibold ${stateColor(briefResult.lifecycle_state)}`}>
                      → {briefResult.lifecycle_state}
                    </span>
                  </div>

                  {briefResult.brief && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Parsed Brief</p>
                      <p className="text-sm text-white">{briefResult.brief.goal}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span>KPI: {briefResult.brief.primary_kpi}</span>
                        <span>Confidence: {Math.round((briefResult.brief.confidence ?? 0) * 100)}%</span>
                        {briefResult.brief.budget?.total && (
                          <span>Budget: ${briefResult.brief.budget.total.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {briefResult.plan && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Generated Plan</p>
                      <div className="flex gap-3 text-xs text-gray-400">
                        <span>Channels: {briefResult.plan.channels?.length ?? 0}</span>
                        <span>Assets: {briefResult.plan.asset_mix?.reduce((s: number, a: any) => s + (a.count ?? 1), 0) ?? 0}</span>
                        <span>Reach est: {briefResult.plan.estimated_reach?.toLocaleString() ?? '—'}</span>
                      </div>
                    </div>
                  )}

                  {briefResult.generation && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Asset Generation</p>
                      <div className="flex gap-3 text-xs">
                        <span className="text-emerald-400">✓ {briefResult.generation.generated?.length ?? 0} generated</span>
                        {briefResult.generation.failed?.length > 0 && (
                          <span className="text-red-400">✗ {briefResult.generation.failed.length} failed</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
