/**
 * AutoFlowNG — Creative Agents Studio (Phase 37)
 *
 * A single page with two tabs: Thumbnail and SEO.
 * Shows the job history list at the bottom.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageTransition } from '../components/PageTransition';
import { Reveal } from '../components/Reveal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentJob {
  id: number;
  agent_type: 'thumbnail' | 'seo';
  status: 'pending' | 'running' | 'completed' | 'failed';
  input_data: Record<string, any>;
  output_data: Record<string, any> | null;
  error_message: string | null;
  duration_ms: number | null;
  source_job_id: number | null;
  created_at: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0d0f1a',
    padding: '40px 24px',
  },
  inner: {
    maxWidth: 760,
    margin: '0 auto',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#E8EEFF',
    fontFamily: "'Syne', sans-serif",
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(232,238,255,0.45)',
    fontFamily: "'DM Sans', sans-serif",
    marginTop: 6,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '28px 28px',
    marginBottom: 24,
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    marginBottom: 28,
    background: 'rgba(255,255,255,0.03)',
    padding: 4,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '9px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s',
    background: active ? '#00C896' : 'transparent',
    color: active ? '#0d0f1a' : 'rgba(232,238,255,0.5)',
  }),
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(232,238,255,0.4)',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: '0.07em',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
  },
  input: {
    width: '100%',
    background: 'rgba(232,238,255,0.05)',
    border: '1px solid rgba(232,238,255,0.1)',
    borderRadius: 10,
    color: '#E8EEFF',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    padding: '10px 14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    background: 'rgba(232,238,255,0.05)',
    border: '1px solid rgba(232,238,255,0.1)',
    borderRadius: 10,
    color: '#E8EEFF',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    padding: '10px 14px',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 80,
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    background: 'rgba(232,238,255,0.05)',
    border: '1px solid rgba(232,238,255,0.1)',
    borderRadius: 10,
    color: '#E8EEFF',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    padding: '10px 14px',
    outline: 'none',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  submitBtn: {
    width: '100%',
    background: '#00C896',
    color: '#0d0f1a',
    border: 'none',
    borderRadius: 10,
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif",
    cursor: 'pointer',
    marginTop: 8,
  },
  disabledBtn: {
    width: '100%',
    background: 'rgba(0,200,150,0.3)',
    color: 'rgba(13,15,26,0.6)',
    border: 'none',
    borderRadius: 10,
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif",
    cursor: 'not-allowed',
    marginTop: 8,
  },
  loadingBox: {
    padding: '24px',
    textAlign: 'center' as const,
    color: 'rgba(232,238,255,0.5)',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
  },
  errorBox: {
    background: 'rgba(251,113,133,0.08)',
    border: '1px solid rgba(251,113,133,0.2)',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#FB7185',
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(232,238,255,0.35)',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: '0.08em',
    marginBottom: 16,
    textTransform: 'uppercase' as const,
  },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function CreativeAgents() {
  const { token } = useAuth() as { token: string };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [activeTab, setActiveTab] = useState<'thumbnail' | 'seo'>('thumbnail');
  const [jobs, setJobs] = useState<AgentJob[]>([]);

  const fetchJobs = async () => {
    try {
      const res  = await fetch('/api/creative-agents/jobs', { headers });
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Auto-refresh if any jobs are still running
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;
    const timer = setInterval(fetchJobs, 30_000);
    return () => clearInterval(timer);
  }, [jobs]);

  const onJobComplete = () => {
    fetchJobs();
  };

  return (
    <PageTransition variant="slide">
    <div style={s.page}>
      <Reveal>
      <div style={s.inner}>
        <div style={s.header}>
          <h1 style={s.title}>🎨 AI Creative Agents</h1>
          <p style={s.subtitle}>Your AI creative team — thumbnail generation and SEO metadata, automatically.</p>
        </div>

        <div style={s.card}>
          <div style={s.tabBar}>
            <button style={s.tab(activeTab === 'thumbnail')} onClick={() => setActiveTab('thumbnail')}>
              🎨 Thumbnail
            </button>
            <button style={s.tab(activeTab === 'seo')} onClick={() => setActiveTab('seo')}>
              📝 SEO Metadata
            </button>
          </div>

          {activeTab === 'thumbnail'
            ? <ThumbnailTab headers={headers} onComplete={onJobComplete} />
            : <SEOTab       headers={headers} onComplete={onJobComplete} />
          }
        </div>

        {/* Recent Jobs */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Recent Jobs</div>
          <RecentJobs jobs={jobs.slice(0, 10)} onRefresh={fetchJobs} />
        </div>
      </div>
      </Reveal>
    </div>
    </PageTransition>
  );
}

// ── Thumbnail Tab ─────────────────────────────────────────────────────────────

function ThumbnailTab({ headers, onComplete }: { headers: Record<string, string>; onComplete: () => void }) {
  const [title,   setTitle]   = useState('');
  const [summary, setSummary] = useState('');
  const [style,   setStyle]   = useState('professional');
  const [palette, setPalette] = useState('dark');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ image_url: string; provider: string } | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const providerLabel = (p: string) =>
    p === 'replicate' ? 'via Replicate' : p === 'dalle3' ? 'via DALL-E 3' : 'via Placeholder';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res  = await fetch('/api/creative-agents/thumbnail', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, summary, style, palette }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data.output);
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={s.fieldGroup}>
        <label style={s.label}>Video Title</label>
        <input
          style={s.input}
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={100}
          placeholder="Enter your video title"
          required
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Summary</label>
        <textarea
          style={{ ...s.textarea, minHeight: 80 }}
          value={summary}
          onChange={e => setSummary(e.target.value)}
          maxLength={300}
          placeholder="What is this video about?"
          required
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div>
          <label style={s.label}>Style</label>
          <select style={s.select} value={style} onChange={e => setStyle(e.target.value)}>
            <option value="professional">Professional</option>
            <option value="educational">Educational</option>
            <option value="entertaining">Entertaining</option>
            <option value="casual">Casual</option>
          </select>
        </div>
        <div>
          <label style={s.label}>Colour Palette</label>
          <select style={s.select} value={palette} onChange={e => setPalette(e.target.value)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="vibrant">Vibrant</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={s.loadingBox}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🎬</div>
          Director is framing the shot…
        </div>
      ) : (
        <button type="submit" style={title && summary ? s.submitBtn : s.disabledBtn} disabled={!title || !summary}>
          Generate Thumbnail
        </button>
      )}

      {error && <div style={s.errorBox}>{error}</div>}

      {result && (
        <div style={{ marginTop: 20 }}>
          <img
            src={result.image_url}
            alt="Generated thumbnail"
            style={{ width: '100%', borderRadius: 10, marginBottom: 10 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Mono',monospace" }}>
              {providerLabel(result.provider)}
            </span>
            <a
              href={result.image_url}
              download
              style={{ fontSize: 12, color: '#00C896', textDecoration: 'none', fontFamily: "'DM Sans',sans-serif" }}
            >
              ⬇️ Download
            </a>
          </div>
        </div>
      )}
    </form>
  );
}

// ── SEO Tab ───────────────────────────────────────────────────────────────────

function SEOTab({ headers, onComplete }: { headers: Record<string, string>; onComplete: () => void }) {
  const [title,      setTitle]      = useState('');
  const [scriptText, setScriptText] = useState('');
  const [platform,   setPlatform]   = useState('all');
  const [language,   setLanguage]   = useState('en');
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<any>(null);
  const [error,      setError]      = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const script = { scenes: [{ narration_text: scriptText }], source: 'manual' };
      const res    = await fetch('/api/creative-agents/seo', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, script, platform, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data.output);
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={s.fieldGroup}>
        <label style={s.label}>Video Title</label>
        <input
          style={s.input}
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={100}
          placeholder="Enter your video title"
          required
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Script Content</label>
        <textarea
          style={{ ...s.textarea, minHeight: 140 }}
          value={scriptText}
          onChange={e => setScriptText(e.target.value)}
          maxLength={5000}
          placeholder="Paste your video script or narration text here"
          required
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div>
          <label style={s.label}>Platform</label>
          <select style={s.select} value={platform} onChange={e => setPlatform(e.target.value)}>
            <option value="all">All Platforms</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>
        <div>
          <label style={s.label}>Language</label>
          <input
            style={s.input}
            value={language}
            onChange={e => setLanguage(e.target.value)}
            placeholder="ISO code e.g. en, fr, es"
          />
        </div>
      </div>

      {loading ? (
        <div style={s.loadingBox}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>
          SEO Agent is crafting your metadata…
        </div>
      ) : (
        <button type="submit" style={title && scriptText ? s.submitBtn : s.disabledBtn} disabled={!title || !scriptText}>
          Generate SEO Metadata
        </button>
      )}

      {error && <div style={s.errorBox}>{error}</div>}

      {result && <SEOResultExpanded data={result} />}
    </form>
  );
}

// ── SEO Result Display ────────────────────────────────────────────────────────

function SEOResultExpanded({ data }: { data: any }) {
  const platforms = ['youtube', 'tiktok', 'instagram'].filter(p => data?.[p]);

  if (platforms.length === 0) {
    return <div style={{ ...s.errorBox, marginTop: 16 }}>No metadata returned.</div>;
  }

  return (
    <div style={{ marginTop: 20 }}>
      {platforms.map(platform => (
        <PlatformSection key={platform} platform={platform} data={data[platform]} />
      ))}
    </div>
  );
}

function PlatformSection({ platform, data }: { platform: string; data: any }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const platformEmoji = platform === 'youtube' ? '▶️' : platform === 'tiktok' ? '🎵' : '📸';
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);

  const copyAll = () => {
    const parts: string[] = [];
    if (data.title)       parts.push(`Title: ${data.title}`);
    if (data.description) parts.push(`\nDescription:\n${data.description}`);
    if (data.caption)     parts.push(`Caption: ${data.caption}`);
    if (data.tags?.length) parts.push(`\nTags: ${data.tags.join(', ')}`);
    if (data.hashtags?.length) parts.push(`\nHashtags: ${data.hashtags.join(' ')}`);
    navigator.clipboard.writeText(parts.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif" }}>
          {platformEmoji} {platformLabel}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); copyAll(); }}
            style={{ fontSize: 10, fontWeight: 700, color: copied ? '#00C896' : 'rgba(232,238,255,0.5)', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}
          >
            {copied ? '✓ Copied' : 'Copy all'}
          </button>
          <span style={{ color: 'rgba(232,238,255,0.3)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {data.title && (
            <div style={{ marginBottom: 10 }}>
              <div style={s.label}>Title</div>
              <div style={{ fontSize: 13, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif" }}>{data.title}</div>
            </div>
          )}
          {data.description && (
            <div style={{ marginBottom: 10 }}>
              <div style={s.label}>Description</div>
              <div style={{ fontSize: 12, color: 'rgba(232,238,255,0.6)', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>{data.description}</div>
            </div>
          )}
          {data.caption && (
            <div style={{ marginBottom: 10 }}>
              <div style={s.label}>Caption</div>
              <div style={{ fontSize: 13, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif" }}>{data.caption}</div>
            </div>
          )}
          {data.tags?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={s.label}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {data.tags.slice(0, 15).map((tag: string) => (
                  <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,200,150,0.1)', color: '#00C896', fontFamily: "'DM Mono',monospace" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.hashtags?.length > 0 && (
            <div>
              <div style={s.label}>Hashtags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {data.hashtags.map((h: string) => (
                  <span key={h} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', fontFamily: "'DM Mono',monospace" }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.chapters?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={s.label}>Chapters</div>
              {data.chapters.map((ch: any, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'rgba(232,238,255,0.6)', fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>
                  {ch.timestamp} — {ch.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recent Jobs ───────────────────────────────────────────────────────────────

function RecentJobs({ jobs, onRefresh }: { jobs: AgentJob[]; onRefresh: () => void }) {
  if (jobs.length === 0) {
    return (
      <div style={{ color: 'rgba(232,238,255,0.3)', fontSize: 13, fontFamily: "'DM Sans',sans-serif", textAlign: 'center', padding: '24px 0' }}>
        No jobs yet. Generate your first thumbnail or SEO metadata above.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={onRefresh}
          style={{ fontSize: 11, color: 'rgba(232,238,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}
        >
          ↻ Refresh
        </button>
      </div>
      {jobs.map(job => <JobRow key={job.id} job={job} />)}
    </div>
  );
}

function JobRow({ job }: { job: AgentJob }) {
  const [showSEO, setShowSEO] = useState(false);

  const statusDot = {
    completed: '#00C896',
    running:   '#3b82f6',
    pending:   'rgba(232,238,255,0.25)',
    failed:    '#FB7185',
  }[job.status] ?? '#888';

  const agentLabel = job.agent_type === 'thumbnail' ? '🎨 Thumbnail' : '📝 SEO';

  const relativeTime = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const m  = Math.floor(ms / 60_000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusDot, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif", minWidth: 100 }}>{agentLabel}</span>
      <span style={{ fontSize: 11, color: 'rgba(232,238,255,0.3)', fontFamily: "'DM Mono',monospace" }}>{relativeTime(job.created_at)}</span>

      {/* Thumbnail preview */}
      {job.agent_type === 'thumbnail' && job.status === 'completed' && (
        <img
          src={`/thumbnails/thumbnail-${job.id}.webp`}
          alt="thumb"
          style={{ width: 40, height: 23, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
        />
      )}

      {/* SEO view button */}
      {job.agent_type === 'seo' && job.status === 'completed' && (
        <button
          onClick={() => setShowSEO(!showSEO)}
          style={{ fontSize: 10, fontWeight: 700, color: '#00C896', background: 'transparent', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}
        >
          {showSEO ? 'Hide' : 'View'}
        </button>
      )}

      {job.status === 'failed' && (
        <span style={{ fontSize: 10, color: '#FB7185', fontFamily: "'DM Sans',sans-serif" }}>Failed</span>
      )}
    </div>
  );
}
