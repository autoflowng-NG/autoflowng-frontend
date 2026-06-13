/**
 * AutoFlowNG — MFA Enforcement Banner (Phase 10D)
 *
 * Displays a non-dismissible banner for admin/super_admin users
 * who have not yet configured MFA.
 *
 * Usage:
 *   <MFAEnforcementBanner role={user.role} />
 *
 * The banner:
 *   - Only shows for admin / super_admin roles
 *   - Checks /api/mfa/status to see if MFA is already set up
 *   - Links to /mfa/setup for setup flow
 *   - Tracks dismissed state in sessionStorage (soft-dismiss only)
 */

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  role: string | null | undefined;
  className?: string;
}

interface MFAStatus {
  enabled: boolean;
  hasBackupCodes: boolean;
}

export default function MFAEnforcementBanner({ role, className = '' }: Props) {
  const [mfaStatus, setMfaStatus]   = useState<MFAStatus | null>(null);
  const [dismissed, setDismissed]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const navigate = useNavigate();

  const isAdmin = role === 'admin' || role === 'super_admin';

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }

    const wasDismissed = sessionStorage.getItem('mfa-banner-dismissed') === '1';
    if (wasDismissed) { setDismissed(true); setLoading(false); return; }

    fetch('/api/mfa/status', {
      headers: { Authorization: `Bearer ${localStorage.getItem('autoflowng_token')}` },
    })
      .then(r => r.json())
      .then(d => {
        setMfaStatus({ enabled: d.enabled, hasBackupCodes: d.hasBackupCodes });
      })
      .catch(() => setMfaStatus(null))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  // Don't show if: not admin, still loading, MFA already enabled, or dismissed
  if (!isAdmin || loading || !mfaStatus || mfaStatus.enabled || dismissed) return null;

  return (
    <div className={`relative rounded-xl border border-red-500/40 bg-red-950/20 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
            <Shield size={16} className="text-red-400" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-400" />
            <h4 className="text-sm font-semibold text-red-300">MFA Setup Required</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 font-medium">
              CRITICAL
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed mb-3">
            As an administrator, you must configure Multi-Factor Authentication before performing
            sensitive operations (wallet freeze, reward config, campaign creation, withdrawals).
            Without MFA, these actions will be blocked.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/mfa/setup')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 transition-colors text-xs font-semibold text-white"
            >
              <Shield size={13} />
              Set Up MFA Now
              <ExternalLink size={11} />
            </button>
            <span className="text-xs text-zinc-600">
              Takes ~2 minutes. Required for all admin accounts.
            </span>
          </div>
        </div>

        {/* Soft-dismiss (session only — will come back on next load) */}
        <button
          onClick={() => {
            sessionStorage.setItem('mfa-banner-dismissed', '1');
            setDismissed(true);
          }}
          className="flex-shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors"
          title="Dismiss until next session"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
