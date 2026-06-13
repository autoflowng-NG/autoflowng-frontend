/**
 * AutoFlowNG — User Appeals Page (Phase 10B)
 *
 * Shown when a user's account is suspended.
 * Displays: suspension reason, date, appeal form, status of existing appeals.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, FileText, Clock, CheckCircle, XCircle, AlertCircle, Send } from 'lucide-react';

interface AccountInfo {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  staff_notes: string | null;
  created_at: string;
}

interface Appeal {
  id: number;
  status: 'pending' | 'approved' | 'denied' | 'warning_issued';
  explanation: string;
  resolution_reason: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
}

const STATUS_CONFIG = {
  pending:        { label: 'Under Review',    color: 'text-amber-400',  bg: 'bg-amber-400/10',  icon: Clock },
  approved:       { label: 'Approved',        color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle },
  denied:         { label: 'Denied',          color: 'text-red-400',    bg: 'bg-red-400/10',    icon: XCircle },
  warning_issued: { label: 'Warning Issued',  color: 'text-orange-400', bg: 'bg-orange-400/10', icon: AlertCircle },
};

export default function Appeals() {
  const [account, setAccount]   = useState<AccountInfo | null>(null);
  const [appeals, setAppeals]   = useState<Appeal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [evidence, setEvidence] = useState('');
  const [error, setError]       = useState('');
  const [submitted, setSubmitted] = useState(false);

  const token = localStorage.getItem('autoflowng_token') || sessionStorage.getItem('autoflowng_token');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/appeals/my', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setAccount(data.account);
        setAppeals(data.appeals || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const hasPending = appeals.some(a => a.status === 'pending');

  async function submitAppeal(e: React.FormEvent) {
    e.preventDefault();
    if (explanation.trim().length < 20) {
      setError('Please provide a more detailed explanation (at least 20 characters).');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const evidenceItems = evidence.trim()
        ? evidence.split('\n').map(l => l.trim()).filter(Boolean)
        : [];
      const res = await fetch('/api/appeals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ explanation: explanation.trim(), evidence: evidenceItems }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Submission failed.'); return; }
      setSubmitted(true);
      setAppeals(prev => [data.appeal, ...prev]);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Sign in required</h2>
          <p className="text-zinc-400 text-sm">Please sign in to access the appeals system.</p>
          <a href="/login" className="mt-4 inline-block px-6 py-2 bg-amber-500 text-black rounded-lg font-medium text-sm">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Account Suspended</h1>
          {account && (
            <p className="text-zinc-400 text-sm">
              {account.email} · Suspended {new Date(account.created_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Suspension info */}
        {account?.staff_notes && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-1">
            <p className="text-xs text-red-400 font-medium uppercase tracking-wider">Reason on file</p>
            <p className="text-zinc-300 text-sm">{account.staff_notes}</p>
          </div>
        )}

        {/* Existing appeals */}
        {appeals.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" /> Your Appeals
              </h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {appeals.map(appeal => {
                const cfg = STATUS_CONFIG[appeal.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <div key={appeal.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <span className="text-xs text-zinc-500">
                        Submitted {new Date(appeal.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-zinc-300 text-sm line-clamp-3">{appeal.explanation}</p>
                    {appeal.resolution_reason && (
                      <div className="bg-zinc-800 rounded-lg p-3 space-y-1">
                        <p className="text-xs text-zinc-400 font-medium">Admin Response</p>
                        <p className="text-zinc-200 text-sm">{appeal.resolution_reason}</p>
                        {appeal.resolved_by_name && (
                          <p className="text-xs text-zinc-500">— {appeal.resolved_by_name}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit appeal form */}
        {!hasPending && !submitted && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Submit an Appeal</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Explain your situation. Our team will review and respond within 2–5 business days.
              </p>
            </div>
            <form onSubmit={submitAppeal} className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Your explanation <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  placeholder="Explain why you believe your account should be reinstated. Be specific about the circumstances..."
                  rows={6}
                  maxLength={5000}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-xs text-zinc-500 text-right">{explanation.length}/5000</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Supporting evidence <span className="text-zinc-500">(optional — one item per line)</span>
                </label>
                <textarea
                  value={evidence}
                  onChange={e => setEvidence(e.target.value)}
                  placeholder="e.g. Screenshot URLs, transaction IDs, dates of contact..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || explanation.trim().length < 20}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg text-sm transition-colors"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? 'Submitting...' : 'Submit Appeal'}
              </button>
            </form>
          </div>
        )}

        {submitted && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-white font-semibold">Appeal submitted successfully</p>
            <p className="text-zinc-400 text-sm">Our team will review your appeal and respond within 2–5 business days.</p>
          </div>
        )}

        {hasPending && !submitted && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
            <p className="text-amber-300 text-sm">You have a pending appeal under review. You will be notified of the decision.</p>
          </div>
        )}

        <p className="text-center text-xs text-zinc-600">
          AutoFlowNG · Account Appeals System · All decisions are logged for accountability
        </p>
      </div>
    </div>
  );
}
