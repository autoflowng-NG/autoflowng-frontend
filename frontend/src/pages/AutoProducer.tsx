/**
 * AutoFlowNG — Auto Producer Page
 * Phase 36: Autonomous Content Production
 *
 * Three states:
 *   State 1 — Prompt entry (with options panel + quota display)
 *   State 2 — Live progress tracker (7 steps via WebSocket)
 *   State 3 — Completed video player + download
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuotaInfo {
  plan: string;
  usage: {
    autonomous_job_count: { used: number; limit: number | null };
    video_count:          { used: number; limit: number | null };
  };
}

interface PipelineConfig {
  plan:             string;
  watermark:        boolean;
  max_scenes:       number;
  image_providers:  string[];
  voice_provider:   string;
  music_provider:   string;
}

interface StepStatus {
  step_number: number;
  step_name:   string;
  status:      'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  duration_ms?: number;
  error?:       string;
}

interface JobRow {
  id:             number;
  status:         string;
  current_step:   number;
  total_steps:    number;
  step_progress:  Record<string, { status: string; duration_ms?: number }>;
  charge_status:  string;
  error_message?: string;
  error_step?:    number;
  duration_seconds?: number;
  output_media_id?: number;
  steps?:         StepStatus[];
  orchestration_meta?: {
    director_rounds:    number;
    scenes_regenerated: number;
    final_approval:     boolean;
  };
}

const STEP_LABELS = [
    { icon: '🔍', label: 'Researching topic',     agent: 'Director Agent' },
    { icon: '✍️', label: 'Writing script',         agent: 'Producer Agent' },
    { icon: '🎬', label: 'Building storyboard',    agent: 'Director Agent' },
    { icon: '🖼️', label: 'Generating scenes',      agent: 'Director Agent' },
    { icon: '🎙️', label: 'Recording narration',    agent: 'Narrator Agent' },
    { icon: '🎵', label: 'Composing music',        agent: 'Producer Agent' },
    { icon: '🎞️', label: 'Assembling video',       agent: 'Editor Agent' },
  ];

const MUSIC_MOODS = ['upbeat', 'calm', 'dramatic', 'inspirational', 'corporate', 'playful'];
const STYLES      = ['professional', 'educational', 'entertaining', 'casual'];

const API = (path: string) => `/api/phase36${path}`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutoProducer() {
  const { token: getToken } = useAuth();
  const token = getToken() ?? '';
  const headers   = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [state, setState] = useState<'prompt' | 'progress' | 'completed'>('prompt');

  // State 1
  const [prompt,      setPrompt]      = useState('');
  const [musicMood,   setMusicMood]   = useState('upbeat');
  const [style,       setStyle]       = useState('professional');
  const [showOptions, setShowOptions] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [quota,       setQuota]       = useState<QuotaInfo | null>(null);
  const [config,      setConfig]      = useState<PipelineConfig | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // State 2
  const [jobId,   setJobId]   = useState<number | null>(null);
  const [job,     setJob]     = useState<JobRow | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // State 3
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Director agent status (Phase 38)
  const [directorStatus, setDirectorStatus] = useState<{
    reviewing: boolean;
    round: number;
    scenesRegenerated: number;
  } | null>(null);

  // ── Load quota + config on mount ──────────────────────────────────────
  useEffect(() => {
    fetch(API('/quota'),  { headers }).then(r => r.json()).then(setQuota).catch(() => {});
    fetch(API('/config'), { headers }).then(r => r.json()).then(setConfig).catch(() => {});
  }, []);

  // ── Poll job status ───────────────────────────────────────────────────
  const startPolling = useCallback((id: number) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(API(`/jobs/${id}`), { headers });
        if (!res.ok) return;
        const data: JobRow = await res.json();
        setJob(data);

        // Check for director events in step_progress (Phase 38)
        // We surface directorStatus by reading the step_progress broadcast field
        // (set by the ws autonomous:step_update events which are also polled via REST)
        if (data.step_progress?.director_status) {
          const ds = data.step_progress.director_status as any;
          if (ds.status === 'director_reviewing') {
            setDirectorStatus({ reviewing: true, round: ds.round ?? 1, scenesRegenerated: 0 });
          } else if (ds.status === 'director_approved') {
            setDirectorStatus({
              reviewing: false,
              round: ds.director_rounds ?? 0,
              scenesRegenerated: ds.scenes_regenerated ?? 0,
            });
          }
        }

        if (data.status === 'completed') {
          clearInterval(pollRef.current!);
          const dlRes = await fetch(API(`/jobs/${id}/download`), { headers });
          if (dlRes.ok) {
            const { download_url } = await dlRes.json();
            setDownloadUrl(download_url);
          }
          setState('completed');
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!);
        }
      } catch {}
    }, 2500);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Submit prompt ──────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!prompt.trim()) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(API('/jobs'), {
        method:  'POST',
        headers,
        body:    JSON.stringify({ prompt: prompt.trim(), options: { music_mood: musicMood, style } }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to create job');
        setSubmitting(false);
        return;
      }

      setJobId(data.id);
      setJob({ ...data, current_step: 0, total_steps: 7, step_progress: {}, steps: [], charge_status: 'pending_charge' });
      setState('progress');
      startPolling(data.id);
    } catch (err: any) {
      setError(err.message ?? 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Retry failed job ──────────────────────────────────────────────────
  async function handleRetry() {
    if (!jobId) return;
    const res = await fetch(API(`/jobs/${jobId}/retry`), { method: 'POST', headers });
    if (res.ok) {
      setState('progress');
      startPolling(jobId);
    }
  }

  // ── Reset to prompt state ─────────────────────────────────────────────
  function handleReset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPrompt('');
    setJobId(null);
    setJob(null);
    setDownloadUrl(null);
    setError(null);
    setState('prompt');
    // Refresh quota
    fetch(API('/quota'), { headers }).then(r => r.json()).then(setQuota).catch(() => {});
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const isTrial      = config?.plan === 'trial';
  const isExpired    = quota?.plan === 'expired';
  const quotaUsed    = quota?.usage.autonomous_job_count.used ?? 0;
  const quotaLimit   = quota?.usage.autonomous_job_count.limit ?? null;
  const quotaFull    = quotaLimit !== null && quotaUsed >= quotaLimit;
  const canSubmit    = !submitting && !quotaFull && !isExpired && prompt.trim().length > 0;

  const getStepStatus = (stepIdx: number): 'pending' | 'running' | 'completed' | 'failed' => {
    if (!job) return 'pending';
    const stepNum = stepIdx + 1;
    const fromSteps = job.steps?.find(s => s.step_number === stepNum);
    if (fromSteps) return fromSteps.status as any;
    const fromProgress = job.step_progress?.[stepNum];
    if (fromProgress) return fromProgress.status as any;
    if (job.current_step === stepNum) return 'running';
    if (job.current_step > stepNum)   return 'completed';
    return 'pending';
  };

  // ══════════════════════════════════════════════════════════════════════
  // State 1: Prompt Entry
  // ══════════════════════════════════════════════════════════════════════
  if (state === 'prompt') {
    return (
      <div style={styles.page}>
        <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
        <div style={styles.card}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={styles.title}>Auto Producer</h1>
            <p style={styles.subtitle}>
              Type a prompt. Get a complete video — research, script, visuals, narration, and music — delivered automatically.
            </p>
          </div>

          {/* Trial / expired banners */}
          {isTrial && (
            <div style={styles.trialBanner}>
              🎬 <strong>Trial:</strong> 1 free autonomous video.{' '}
              <a href="/dashboard/billing" style={{ color: '#00C896' }}>Subscribe to unlock unlimited production →</a>
            </div>
          )}
          {isExpired && (
            <div style={{ ...styles.trialBanner, background: 'rgba(239,68,68,0.15)', borderColor: '#ef4444' }}>
              ⛔ Your subscription has expired.{' '}
              <a href="/dashboard/billing" style={{ color: '#ef4444' }}>Renew to continue →</a>
            </div>
          )}
          {quotaFull && !isExpired && (
            <div style={{ ...styles.trialBanner, background: 'rgba(234,179,8,0.15)', borderColor: '#eab308' }}>
              ⚠️ Monthly autonomous job quota reached ({quotaUsed}/{quotaLimit}).{' '}
              <a href="/dashboard/billing" style={{ color: '#eab308' }}>Upgrade for more →</a>
            </div>
          )}

          {/* Quota display */}
          {quota && quotaLimit !== null && !isExpired && (
            <div style={styles.quotaRow}>
              <span style={styles.quotaText}>
                {quotaUsed} of {quotaLimit} autonomous {quotaLimit === 1 ? 'video' : 'videos'} used this cycle
              </span>
              <div style={styles.quotaBar}>
                <div style={{ ...styles.quotaFill, width: `${Math.min(100, (quotaUsed / quotaLimit) * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Prompt area */}
          <textarea
            style={{ ...styles.textarea, opacity: (isExpired || quotaFull) ? 0.5 : 1 }}
            placeholder="What video do you want to create? e.g. 'Top 5 AI tools for Nigerian businesses explained in 3 minutes'"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={isExpired || quotaFull}
            rows={5}
          />

          {/* Options panel */}
          <button style={styles.optionsToggle} onClick={() => setShowOptions(v => !v)}>
            {showOptions ? '▲' : '▼'} Options (voice, music, style)
          </button>

          {showOptions && (
            <div style={styles.optionsPanel}>
              <label style={styles.label}>Music mood</label>
              <div style={styles.chipRow}>
                {MUSIC_MOODS.map(m => (
                  <button key={m} onClick={() => setMusicMood(m)}
                    style={{ ...styles.chip, ...(musicMood === m ? styles.chipActive : {}) }}>
                    {m}
                  </button>
                ))}
              </div>

              <label style={styles.label}>Style</label>
              <div style={styles.chipRow}>
                {STYLES.map(s => (
                  <button key={s} onClick={() => setStyle(s)}
                    style={{ ...styles.chip, ...(style === s ? styles.chipActive : {}) }}>
                    {s}
                  </button>
                ))}
              </div>

              {config && (
                <p style={{ fontSize: 12, color: 'rgba(232,238,255,0.4)', marginTop: 8 }}>
                  Image: {config.image_providers.join(', ')} · Voice: {config.voice_provider} · Music: {config.music_provider}
                  {config.watermark && ' · Watermark: ON (upgrade to Pro to remove)'}
                </p>
              )}
            </div>
          )}

          {error && <div style={styles.errorBox}>{error}</div>}

          <button style={{ ...styles.submitBtn, opacity: canSubmit ? 1 : 0.4 }}
            onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Creating job…' : '🎬 Generate Video'}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // State 2: Live Progress
  // ══════════════════════════════════════════════════════════════════════
  if (state === 'progress') {
    const isFailed  = job?.status === 'failed';
    const isPaused  = job?.status === 'paused_payment_required';
    const canRetry  = isFailed;

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Producing your video…</h1>
          <p style={{ color: 'rgba(232,238,255,0.5)', marginBottom: 32 }}>
            Job #{jobId} · {isFailed ? '❌ Failed' : isPaused ? '⏸ Paused' : '⏳ In progress'}
          </p>

          {isPaused && (
            <div style={{ ...styles.trialBanner, marginBottom: 24 }}>
              ⏸ Job paused — subscription payment required.{' '}
              <a href="/dashboard/billing" style={{ color: '#00C896' }}>Resume subscription →</a>
            </div>
          )}

          {/* Step tracker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {STEP_LABELS.map((step, idx) => {
              const status = getStepStatus(idx);
              return (
                <div key={idx} style={{ ...styles.stepRow, opacity: status === 'pending' ? 0.45 : 1 }}>
                  <div style={{ ...styles.stepDot, background: stepDotColor(status) }}>
                    {status === 'running'   && <span style={styles.spinner} />}
                    {status === 'completed' && '✓'}
                    {status === 'failed'    && '✕'}
                    {status === 'pending'   && String(idx + 1)}
                  </div>
                  <div>
                    <span style={{ fontSize: 18, marginRight: 8 }}>{step.icon}</span>
                    <span style={{ color: '#e8eeff', fontWeight: status === 'running' ? 600 : 400 }}>{step.label}</span>
                    {status === 'running' && (
                      <div style={{
                        fontSize: 9, fontWeight: 700, color: '#00C896',
                        fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em',
                        marginTop: 2, animation: 'pulse 1.5s ease-in-out infinite',
                      }}>
                        ⚡ {step.agent}
                      </div>
                    )}
                    {idx === 3 && status === 'running' && directorStatus?.reviewing && (
                      <div style={{
                        fontSize: 9, color: 'rgba(232,238,255,0.5)',
                        fontFamily: "'DM Mono', monospace", marginTop: 3,
                      }}>
                        🎬 Director reviewing — round {directorStatus.round}
                      </div>
                    )}
                    {idx === 3 && status === 'running' && directorStatus && !directorStatus.reviewing && directorStatus.scenesRegenerated > 0 && (
                      <div style={{
                        fontSize: 9, color: '#00C896',
                        fontFamily: "'DM Mono', monospace", marginTop: 3,
                      }}>
                        ✓ Director approved ({directorStatus.scenesRegenerated} scene{directorStatus.scenesRegenerated !== 1 ? 's' : ''} improved)
                      </div>
                    )}
                    {idx === 3 && status === 'running' && directorStatus && !directorStatus.reviewing && directorStatus.scenesRegenerated === 0 && (
                      <div style={{
                        fontSize: 9, color: '#00C896',
                        fontFamily: "'DM Mono', monospace", marginTop: 3,
                      }}>
                        ✓ Director approved — all scenes passed
                      </div>
                    )}
                  </div>
                  {status === 'running' && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#00C896' }}>Running…</span>
                  )}
                  {status === 'completed' && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(232,238,255,0.35)' }}>Done</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Error message */}
          {isFailed && job?.error_message && (
            <div style={{ ...styles.errorBox, marginTop: 24 }}>
              Error at step {job.error_step ?? '?'}: {job.error_message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            {canRetry && (
              <button style={styles.submitBtn} onClick={handleRetry}>
                🔄 Retry from step {job?.error_step ?? 1}
              </button>
            )}
            <button style={{ ...styles.submitBtn, background: 'rgba(232,238,255,0.08)' }} onClick={handleReset}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // State 3: Completed
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <h1 style={styles.title}>Video ready!</h1>
          <p style={{ color: 'rgba(232,238,255,0.5)' }}>
            Your video was produced in {job?.duration_seconds ?? '?'} seconds.
          </p>
        </div>

        {/* Video player */}
        {downloadUrl && (
          <video
            src={downloadUrl}
            controls
            autoPlay
            style={{ width: '100%', borderRadius: 12, marginBottom: 24, background: '#000' }}
          />
        )}

        {/* Watermark notice */}
        {config?.watermark && (
          <div style={{ ...styles.trialBanner, marginBottom: 24 }}>
            💧 This video has the AutoFlowNG watermark.{' '}
            <a href="/dashboard/billing" style={{ color: '#00C896' }}>Upgrade to Pro to remove it →</a>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {downloadUrl && (
            <a href={downloadUrl} download style={{ ...styles.submitBtn, textDecoration: 'none', textAlign: 'center' }}>
              ⬇️ Download MP4
            </a>
          )}
          <button style={{ ...styles.submitBtn, background: 'rgba(232,238,255,0.08)' }} onClick={handleReset}>
            🎬 Create another video
          </button>
        </div>

        {/* Phase 38 — Director orchestration summary */}
        {job?.orchestration_meta && job.orchestration_meta.director_rounds > 0 && (
          <div style={{
            fontSize: 11, color: 'rgba(232,238,255,0.4)',
            fontFamily: "'DM Mono', monospace",
            marginBottom: 16, marginTop: 8,
          }}>
            🎬 Director ran {job.orchestration_meta.director_rounds} review round{job.orchestration_meta.director_rounds !== 1 ? 's' : ''} · {job.orchestration_meta.scenes_regenerated ?? 0} scene{(job.orchestration_meta.scenes_regenerated ?? 0) !== 1 ? 's' : ''} improved
          </div>
        )}

        {/* AI Creative Agents Output */}
        {job && <CreativeAgentsOutput sourceJobId={job.id} authHeaders={headers} />}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function stepDotColor(status: string) {
  if (status === 'completed') return '#00C896';
  if (status === 'running')   return '#3b82f6';
  if (status === 'failed')    return '#ef4444';
  return 'rgba(232,238,255,0.15)';
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0d0f1a',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 16px',
  },
  card: {
    width: '100%',
    maxWidth: 680,
    background: 'rgba(232,238,255,0.04)',
    border: '1px solid rgba(232,238,255,0.1)',
    borderRadius: 20,
    padding: '40px 40px',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#e8eeff',
    margin: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  subtitle: {
    marginTop: 8,
    color: 'rgba(232,238,255,0.5)',
    fontSize: 15,
    lineHeight: 1.6,
  },
  trialBanner: {
    background: 'rgba(0,200,150,0.08)',
    border: '1px solid rgba(0,200,150,0.25)',
    borderRadius: 10,
    padding: '12px 16px',
    color: 'rgba(232,238,255,0.8)',
    fontSize: 13,
    marginBottom: 20,
  },
  quotaRow: {
    marginBottom: 20,
  },
  quotaText: {
    fontSize: 12,
    color: 'rgba(232,238,255,0.45)',
    display: 'block',
    marginBottom: 6,
  },
  quotaBar: {
    height: 4,
    background: 'rgba(232,238,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  quotaFill: {
    height: '100%',
    background: '#00C896',
    borderRadius: 2,
    transition: 'width 0.4s ease',
  },
  textarea: {
    width: '100%',
    background: 'rgba(232,238,255,0.05)',
    border: '1px solid rgba(232,238,255,0.12)',
    borderRadius: 12,
    color: '#e8eeff',
    fontSize: 15,
    padding: '14px 16px',
    fontFamily: "'DM Sans', sans-serif",
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  optionsToggle: {
    marginTop: 12,
    background: 'none',
    border: 'none',
    color: 'rgba(232,238,255,0.4)',
    cursor: 'pointer',
    fontSize: 13,
    padding: 0,
  },
  optionsPanel: {
    marginTop: 16,
    background: 'rgba(232,238,255,0.03)',
    borderRadius: 10,
    padding: '16px',
    border: '1px solid rgba(232,238,255,0.08)',
  },
  label: {
    fontSize: 12,
    color: 'rgba(232,238,255,0.45)',
    display: 'block',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  chip: {
    padding: '5px 12px',
    borderRadius: 20,
    border: '1px solid rgba(232,238,255,0.15)',
    background: 'rgba(232,238,255,0.04)',
    color: 'rgba(232,238,255,0.6)',
    fontSize: 12,
    cursor: 'pointer',
  },
  chipActive: {
    background: 'rgba(0,200,150,0.15)',
    borderColor: '#00C896',
    color: '#00C896',
  },
  errorBox: {
    marginTop: 16,
    padding: '12px 16px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    color: '#fca5a5',
    fontSize: 13,
  },
  submitBtn: {
    marginTop: 20,
    width: '100%',
    padding: '14px',
    background: '#00C896',
    border: 'none',
    borderRadius: 10,
    color: '#0d0f1a',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 16px',
    borderRadius: 10,
    background: 'rgba(232,238,255,0.03)',
    border: '1px solid rgba(232,238,255,0.07)',
    transition: 'opacity 0.3s ease',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#e8eeff',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    position: 'relative' as const,
  },
  spinner: {
    display: 'block',
    width: 16,
    height: 16,
    border: '2px solid rgba(232,238,255,0.3)',
    borderTop: '2px solid #e8eeff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

// ── CreativeAgentsOutput ───────────────────────────────────────────────────────

function CreativeAgentsOutput({ sourceJobId, authHeaders }: { sourceJobId: number; authHeaders: Record<string, string> }) {
  const [agentJobs, setAgentJobs] = useState<any[]>([]);

  useEffect(() => {
    if (!sourceJobId) return;
    let cancelled = false;
    let attempts = 0;
    const MAX = 10;

    async function poll() {
      if (cancelled || attempts >= MAX) return;
      attempts++;
      try {
        const res  = await fetch('/api/creative-agents/jobs', { credentials: 'include', headers: authHeaders });
        const data = await res.json();
        const related = (data.jobs ?? []).filter((j: any) => j.source_job_id === sourceJobId);
        setAgentJobs(related);
        const stillRunning = related.some((j: any) => ['pending', 'running'].includes(j.status));
        if (stillRunning && !cancelled) setTimeout(poll, 3000);
      } catch { /* silent */ }
    }
    poll();
    return () => { cancelled = true; };
  }, [sourceJobId]);

  const thumb = agentJobs.find(j => j.agent_type === 'thumbnail');
  const seo   = agentJobs.find(j => j.agent_type === 'seo');

  if (!thumb && !seo) return null;

  return (
    <div style={{ marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(232,238,255,0.35)',
                    fontFamily: "'DM Mono',monospace", letterSpacing: '0.08em', marginBottom: 16 }}>
        AI CREATIVE AGENTS
      </div>

      {/* Thumbnail */}
      {thumb && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E8EEFF', marginBottom: 8 }}>
            🎨 Thumbnail
          </div>
          {thumb.status === 'pending' || thumb.status === 'running' ? (
            <div style={{ color: 'rgba(232,238,255,0.4)', fontSize: 12 }}>Generating thumbnail…</div>
          ) : thumb.status === 'completed' ? (
            <div>
              <img
                src={`/thumbnails/thumbnail-${thumb.id}.webp`}
                alt="Generated thumbnail"
                style={{ width: '100%', maxWidth: 480, borderRadius: 8, marginBottom: 8 }}
              />
              <a
                href={`/thumbnails/thumbnail-${thumb.id}.webp`}
                download
                style={{ fontSize: 12, color: '#00C896', textDecoration: 'none' }}
              >
                ⬇️ Download thumbnail
              </a>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#FB7185' }}>Thumbnail generation failed</div>
          )}
        </div>
      )}

      {/* SEO */}
      {seo && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E8EEFF', marginBottom: 8 }}>
            📝 SEO Metadata
          </div>
          {seo.status === 'pending' || seo.status === 'running' ? (
            <div style={{ color: 'rgba(232,238,255,0.4)', fontSize: 12 }}>Generating SEO metadata…</div>
          ) : seo.status === 'completed' ? (
            <SEOResultDisplay data={seo.output_data} />
          ) : (
            <div style={{ fontSize: 12, color: '#FB7185' }}>SEO generation failed</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SEOResultDisplay ──────────────────────────────────────────────────────────

function SEOResultDisplay({ data }: { data: any }) {
  const [copied, setCopied] = useState(false);
  const yt = data?.youtube;
  if (!yt) return <div style={{ fontSize: 12, color: 'rgba(232,238,255,0.4)' }}>No YouTube metadata</div>;

  const copyAll = () => {
    const text = [
      `Title: ${yt.title}`,
      `\nDescription:\n${yt.description}`,
      `\nTags: ${(yt.tags ?? []).join(', ')}`,
      `\nHashtags: ${(yt.hashtags ?? []).join(' ')}`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#E8EEFF', marginBottom: 6 }}>{yt.title}</div>
      <div style={{ fontSize: 11, color: 'rgba(232,238,255,0.5)', marginBottom: 10,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden' }}>
        {yt.description}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {(yt.tags ?? []).slice(0, 8).map((tag: string) => (
          <span key={tag} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
                                   background: 'rgba(0,200,150,0.1)', color: '#00C896',
                                   fontFamily: "'DM Mono',monospace" }}>
            {tag}
          </span>
        ))}
      </div>
      <button onClick={copyAll}
        style={{ fontSize: 10, fontWeight: 700, color: copied ? '#00C896' : 'rgba(232,238,255,0.5)',
                 background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                 borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                 fontFamily: "'DM Mono',monospace" }}>
        {copied ? '✓ Copied' : 'Copy all'}
      </button>
    </div>
  );
}
