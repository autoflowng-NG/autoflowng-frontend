/**
 * AutoFlowNG — MFA Setup Component (Phase 10B)
 *
 * Guides admin/super_admin through TOTP setup:
 * Step 1: Generate secret + show QR URI
 * Step 2: Verify a code
 * Step 3: Show backup codes
 */

import { useState } from 'react';
import { Shield, Key, Copy, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface MFASetupProps {
  onComplete?: () => void;
  onCancel?:   () => void;
}

type Step = 'initiate' | 'verify' | 'backup' | 'done';

export default function MFASetup({ onComplete, onCancel }: MFASetupProps) {
  const [step, setStep]             = useState<Step>('initiate');
  const [secret, setSecret]         = useState('');
  const [otpauthUri, setOtpUri]     = useState('');
  const [code, setCode]             = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [copied, setCopied]         = useState<string | null>(null);

  const token = localStorage.getItem('autoflowng_token') || sessionStorage.getItem('autoflowng_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function initiate() {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/mfa/setup/initiate', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSecret(data.secret);
      setOtpUri(data.otpauthUri);
      setStep('verify');
    } catch {
      setError('Failed to initiate MFA setup.');
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!code || code.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/mfa/setup/confirm', {
        method: 'POST', headers,
        body:   JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setBackupCodes(data.backupCodes || []);
      setStep('backup');
    } catch {
      setError('Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  function finish() {
    setStep('done');
    onComplete?.();
  }

  // ── Step: Initiate ───────────────────────────────────────────────────────
  if (step === 'initiate') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Enable Two-Factor Authentication</h2>
            <p className="text-zinc-500 text-xs">Protect your admin account with TOTP</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-zinc-400">
          <p>MFA adds a second layer of security. You will need an authenticator app such as:</p>
          <ul className="space-y-1 pl-4 list-disc text-zinc-400">
            <li>Google Authenticator</li>
            <li>Authy</li>
            <li>1Password</li>
            <li>Microsoft Authenticator</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs">{error}</div>
        )}

        <div className="flex gap-3">
          {onCancel && (
            <button onClick={onCancel} className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors">
              Cancel
            </button>
          )}
          <button
            onClick={initiate}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Shield className="w-4 h-4" />}
            Get Started
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Verify ─────────────────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Scan or enter your secret</h2>
            <p className="text-zinc-500 text-xs">Step 1 of 2</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Open your authenticator app and add a new account. If your app supports OTP Auth URIs, use the button below. Otherwise, enter the secret key manually.
          </p>

          {/* OTP Auth URI */}
          <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">OTP Auth URI</p>
            <p className="text-zinc-300 text-xs break-all font-mono">{otpauthUri}</p>
            <button
              onClick={() => copyText(otpauthUri, 'uri')}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              {copied === 'uri' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'uri' ? 'Copied!' : 'Copy URI'}
            </button>
          </div>

          {/* Manual secret */}
          <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Manual Secret Key</p>
            <p className="text-white font-mono text-sm tracking-widest">{secret}</p>
            <button
              onClick={() => copyText(secret, 'secret')}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              {copied === 'secret' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'secret' ? 'Copied!' : 'Copy secret'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-300">
            Enter the 6-digit code from your app
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs">{error}</div>
        )}

        <button
          onClick={confirm}
          disabled={loading || code.length !== 6}
          className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : null}
          Verify & Enable MFA
        </button>
      </div>
    );
  }

  // ── Step: Backup codes ───────────────────────────────────────────────────
  if (step === 'backup') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">MFA Enabled — Save your backup codes</h2>
            <p className="text-zinc-500 text-xs">Step 2 of 2</p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            Save these backup codes in a secure location. Each can be used once if you lose access to your authenticator app. They will not be shown again.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {backupCodes.map((code, i) => (
            <div key={i} className="bg-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-white text-center tracking-widest">
              {code}
            </div>
          ))}
        </div>

        <button
          onClick={() => copyText(backupCodes.join('\n'), 'backup')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
        >
          {copied === 'backup' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          {copied === 'backup' ? 'Copied!' : 'Copy all backup codes'}
        </button>

        <button
          onClick={finish}
          className="w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors"
        >
          I have saved my backup codes — Done
        </button>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-auto text-center space-y-4">
      <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
      <p className="text-white font-semibold">MFA is now active on your account.</p>
      <p className="text-zinc-400 text-sm">You will need your authenticator app when approving sensitive operations.</p>
    </div>
  );
}
