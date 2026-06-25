/**
 * Creative Agents — Enterprise Redesign
 *
 * All hooks, API calls, sub-components, and logic preserved exactly.
 * Visual layer upgraded to match enterprise design system.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageTransition } from '../components/PageTransition';
import { Reveal } from '../components/Reveal';
import { aiAPI, videoStyleAPI, animationAPI, quickVideoAPI, mediaCloudAPI } from '../lib/api';
import { Wand2, Image, Film, Sparkles, Layers, Edit3, RefreshCw, ExternalLink } from 'lucide-react';

/* ── Design tokens ──────────────────────────────────────────────────── */
const C = {
  bg:      '#060810',
  surface: '#0C0F1A',
  raised:  '#111520',
  border:  'rgba(255,255,255,0.06)',
  borderH: 'rgba(255,255,255,0.11)',
  text:    '#E2E8FF',
  muted:   'rgba(226,232,255,0.45)',
  faint:   'rgba(226,232,255,0.2)',
  green:   '#00C896',
  blue:    '#38BDF8',
  purple:  '#A78BFA',
  amber:   '#FBBF24',
  red:     '#FB7185',
};

/* ── Shared input styles ────────────────────────────────────────────── */
const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '10px 14px', color: C.text,
  fontFamily: "'DM Sans',sans-serif", fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};
const textarea_s: React.CSSProperties = { ...inp, resize: 'vertical', minHeight: 80 };
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };
const label_s: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: C.muted,
  fontFamily: "'DM Mono',monospace", letterSpacing: '0.07em',
  marginBottom: 6, textTransform: 'uppercase',
};
const submitBtn: React.CSSProperties = {
  width: '100%', background: C.green, color: '#04060F', border: 'none',
  borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700,
  fontFamily: "'DM Sans',sans-serif", cursor: 'pointer', marginTop: 8,
};
const disabledBtn: React.CSSProperties = {
  ...submitBtn, background: 'rgba(0,200,150,0.2)', color: 'rgba(4,6,15,0.5)', cursor: 'not-allowed',
};
const loadingBox: React.CSSProperties = {
  padding: '28px', textAlign: 'center', color: C.muted,
  fontFamily: "'DM Sans',sans-serif", fontSize: 14,
};
const errorBox: React.CSSProperties = {
  background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)',
  borderRadius: 10, padding: '12px 16px', color: C.red, fontSize: 13,
  fontFamily: "'DM Sans',sans-serif", marginTop: 16,
};
const successBox: React.CSSProperties = {
  background: 'rgba(0,200,150,0.08)', border: `1px solid rgba(0,200,150,0.25)`,
  borderRadius: 10, padding: '14px 18px', color: C.green, fontSize: 13,
  fontFamily: "'DM Sans',sans-serif", marginTop: 16,
};
const infoBox: React.CSSProperties = {
  background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.18)',
  borderRadius: 10, padding: '12px 16px', color: 'rgba(56,189,248,0.85)',
  fontSize: 12, fontFamily: "'DM Sans',sans-serif", marginBottom: 18, lineHeight: 1.6,
};
const fieldGroup: React.CSSProperties = { marginBottom: 18 };

/* ── Card wrapper ───────────────────────────────────────────────────── */
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '24px', ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Section label ──────────────────────────────────────────────────── */
function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, color: C.faint,
      fontFamily: "'DM Mono',monospace", letterSpacing: '0.08em',
      marginBottom: 14, textTransform: 'uppercase',
    }}>{children}</div>
  );
}

/* ── Local form-upload helper ───────────────────────────────────────── */
const formAPI = (path: string, body: FormData) =>
  fetch(`/api${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('autoflowng_token') || ''}` },
    body,
  }).then(r => r.json());

/* ── DragDropUpload ─────────────────────────────────────────────────── */
interface UploadedAsset { name: string; publicUrl: string; assetId: string; projectId: string; }

function DragDropUpload({ accept, label, onUploaded }: {
  accept: string; label: string; onUploaded: (a: UploadedAsset) => void;
}) {
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState('');
  const [uploaded,  setUploaded]  = useState<UploadedAsset | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true); setError(null); setProgress(`Uploading ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('name', file.name);
      fd.append('asset_type', file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'other');
      const data = await formAPI('/asset-library/upload', fd);
      if (data.error) throw new Error(data.error);
      const result: UploadedAsset = {
        name: file.name,
        publicUrl: data.public_url || data.presigned_url || data.url || '',
        assetId:   data.pipeline_asset_id ? String(data.pipeline_asset_id) : (data.id ? String(data.id) : ''),
        projectId: data.pipeline_project_id ? String(data.pipeline_project_id) : '',
      };
      setUploaded(result); onUploaded(result);
    } catch (err: any) { setError(err?.message || 'Upload failed'); }
    finally { setUploading(false); setProgress(''); }
  }, [onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div style={fieldGroup}>
      {label && <label style={label_s}>{label}</label>}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? C.green : uploaded ? 'rgba(0,200,150,0.4)' : C.border}`,
          borderRadius: 12, padding: '20px 16px', textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: dragging ? 'rgba(0,200,150,0.05)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.18s',
        }}
      >
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {uploading ? (
          <div style={{ fontSize: 12, color: C.blue, fontFamily: "'DM Mono',monospace" }}>{progress}</div>
        ) : uploaded ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>✓ {uploaded.name}</div>
            <div style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>Click or drop to replace</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 12, color: C.muted }}>Drop file here or <span style={{ color: C.blue, fontWeight: 700 }}>click to browse</span></div>
            <div style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{accept.replace('/*', ' files')} · Max 100 MB</div>
          </div>
        )}
      </div>
      {error && <div style={{ fontSize: 11, color: C.red, marginTop: 6, fontFamily: "'DM Mono',monospace" }}>⚠ {error}</div>}
    </div>
  );
}

/* ── Types ──────────────────────────────────────────────────────────── */
interface AgentJob {
  id: number; agent_type: 'thumbnail' | 'seo';
  status: 'pending' | 'running' | 'completed' | 'failed';
  input_data: Record<string, any>; output_data: Record<string, any> | null;
  error_message: string | null; duration_ms: number | null;
  source_job_id: number | null; created_at: string;
}
type ActiveTab = 'thumbnail' | 'seo' | 'video' | 'style' | 'animation' | 'edit' | 'generate';

/* ── Tabs config ────────────────────────────────────────────────────── */
const TABS: Array<{ id: ActiveTab; label: string; icon: any; color: string }> = [
  { id: 'thumbnail', label: 'Thumbnail',  icon: Image,   color: C.purple },
  { id: 'seo',       label: 'SEO',        icon: Edit3,   color: C.blue   },
  { id: 'video',     label: 'Video',      icon: Film,    color: C.green  },
  { id: 'style',     label: 'Style',      icon: Sparkles,color: C.amber  },
  { id: 'animation', label: 'Animation',  icon: Layers,  color: C.red    },
  { id: 'generate',  label: 'Generate',   icon: Wand2,   color: C.purple },
  { id: 'edit',      label: 'Image Edit', icon: Edit3,   color: C.blue   },
];

/* ── Main Component ─────────────────────────────────────────────────── */
export default function CreativeAgents() {
  const { token: getToken } = useAuth();
  const token = getToken() ?? '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [activeTab, setActiveTab] = useState<ActiveTab>('thumbnail');
  const [jobs, setJobs] = useState<AgentJob[]>([]);

  const fetchJobs = async () => {
    try {
      const res  = await fetch('/api/creative-agents/jobs', { headers });
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchJobs(); }, []);
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;
    const timer = setInterval(fetchJobs, 30_000);
    return () => clearInterval(timer);
  }, [jobs]);

  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const runningJobs   = jobs.filter(j => j.status === 'running' || j.status === 'pending').length;

  const activeTabCfg = TABS.find(t => t.id === activeTab)!;

  return (
    <PageTransition variant="slide">
      <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px' }}>
        <Reveal>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>

            {/* ── Page header ── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.purple, fontFamily: "'DM Mono',monospace", letterSpacing: '0.1em', marginBottom: 8 }}>AI & CONTENT</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h1 style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)', fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: '-0.04em', color: C.text, margin: 0 }}>
                    Creative Agents
                  </h1>
                  <p style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
                    AI creative team — thumbnail generation, SEO metadata, video, style conversion, animation & image editing.
                  </p>
                </div>
                <a
                  href="/media-cloud"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)',
                    borderRadius: 10, padding: '9px 16px', color: C.green, fontSize: 12,
                    fontWeight: 700, textDecoration: 'none', fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <ExternalLink size={13} /> Media Cloud
                </a>
              </div>
            </div>

            {/* ── Stat pills ── */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Jobs',  value: jobs.length,   color: C.purple },
                { label: 'Completed',   value: completedJobs, color: C.green  },
                { label: 'In Progress', value: runningJobs,   color: C.amber  },
              ].map(p => (
                <div key={p.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: `${p.color}08`, border: `1px solid ${p.color}20`,
                  borderRadius: 10, padding: '10px 18px',
                }}>
                  <span style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Syne',sans-serif", color: p.color }}>{p.value}</span>
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Sans',sans-serif" }}>{p.label}</span>
                </div>
              ))}
            </div>

            {/* ── Tab bar ── */}
            <div style={{
              display: 'flex', gap: 2, marginBottom: 24,
              background: C.surface, padding: 4, borderRadius: 12,
              border: `1px solid ${C.border}`, flexWrap: 'wrap',
            }}>
              {TABS.map(t => {
                const active = activeTab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      fontFamily: "'DM Sans',sans-serif",
                      background: active ? `${t.color}18` : 'transparent',
                      color: active ? t.color : C.muted,
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon size={13} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* ── Active tab card ── */}
            <Card style={{ position: 'relative', overflow: 'hidden' }}>
              {/* top accent */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                background: `linear-gradient(90deg, transparent, ${activeTabCfg.color}60, transparent)`,
              }} />
              <div style={{ marginBottom: 20 }}>
                <SLabel>{activeTabCfg.label} Studio</SLabel>
              </div>

              {activeTab === 'thumbnail'  && <ThumbnailTab  headers={headers} onComplete={fetchJobs} />}
              {activeTab === 'seo'        && <SEOTab        headers={headers} onComplete={fetchJobs} />}
              {activeTab === 'video'      && <VideoTab      token={token} />}
              {activeTab === 'style'      && <StyleTab      token={token} />}
              {activeTab === 'animation'  && <AnimationTab  token={token} />}
              {activeTab === 'edit'       && <ImageEditTab  token={token} />}
              {activeTab === 'generate'   && <ImageGenerateTab token={token} />}
            </Card>

            {/* ── Recent Jobs (thumbnail + SEO only) ── */}
            {(activeTab === 'thumbnail' || activeTab === 'seo') && (
              <Card style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <SLabel>Recent Jobs</SLabel>
                  <button onClick={fetchJobs} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                    <RefreshCw size={11} /> Refresh
                  </button>
                </div>
                <RecentJobs jobs={jobs.slice(0, 10)} onRefresh={fetchJobs} />
              </Card>
            )}

          </div>
        </Reveal>
      </div>

      <style>{`
        @keyframes af-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </PageTransition>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Sub-panels — all logic preserved exactly, visual layer upgraded
   ───────────────────────────────────────────────────────────────────── */

function ThumbnailTab({ headers, onComplete }: { headers: Record<string, string>; onComplete: () => void }) {
  const [title,   setTitle]   = useState('');
  const [summary, setSummary] = useState('');
  const [style,   setStyle]   = useState('professional');
  const [palette, setPalette] = useState('dark');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ image_url: string; provider: string } | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const providerLabel = (p: string) =>
    p === 'pollinations' ? 'via Pollinations.ai' : p === 'fal' ? 'via fal.ai' : p === 'dalle3' ? 'via DALL-E 3' : 'via Placeholder';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setResult(null); setError(null);
    try {
      const res  = await fetch('/api/creative-agents/thumbnail', { method: 'POST', headers, body: JSON.stringify({ title, summary, style, palette }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data.output); onComplete();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={fieldGroup}><label style={label_s}>Video Title</label><input style={inp} value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Enter your video title" required /></div>
      <div style={fieldGroup}><label style={label_s}>Summary</label><textarea style={textarea_s} value={summary} onChange={e => setSummary(e.target.value)} maxLength={300} placeholder="What is this video about?" required /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div><label style={label_s}>Style</label>
          <select style={sel} value={style} onChange={e => setStyle(e.target.value)}>
            <option value="professional">Professional</option><option value="educational">Educational</option>
            <option value="entertaining">Entertaining</option><option value="casual">Casual</option>
          </select>
        </div>
        <div><label style={label_s}>Colour Palette</label>
          <select style={sel} value={palette} onChange={e => setPalette(e.target.value)}>
            <option value="dark">Dark</option><option value="light">Light</option><option value="vibrant">Vibrant</option>
          </select>
        </div>
      </div>
      {loading ? <div style={loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>Director is framing the shot…</div>
               : <button type="submit" style={title && summary ? submitBtn : disabledBtn} disabled={!title || !summary}>Generate Thumbnail</button>}
      {error && <div style={errorBox}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <img src={result.image_url} alt="Generated thumbnail" style={{ width: '100%', borderRadius: 10, marginBottom: 10 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace" }}>{providerLabel(result.provider)}</span>
            <a href={result.image_url} download style={{ fontSize: 12, color: C.green, textDecoration: 'none' }}>⬇️ Download</a>
          </div>
        </div>
      )}
    </form>
  );
}

function SEOTab({ headers, onComplete }: { headers: Record<string, string>; onComplete: () => void }) {
  const [title, setTitle] = useState(''); const [scriptText, setScriptText] = useState('');
  const [platform, setPlatform] = useState('all'); const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false); const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setResult(null); setError(null);
    try {
      const script = { scenes: [{ narration_text: scriptText }], source: 'manual' };
      const res    = await fetch('/api/creative-agents/seo', { method: 'POST', headers, body: JSON.stringify({ title, script, platform, language }) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data.output); onComplete();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={fieldGroup}><label style={label_s}>Video Title</label><input style={inp} value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Enter your video title" required /></div>
      <div style={fieldGroup}><label style={label_s}>Script Content</label><textarea style={{ ...textarea_s, minHeight: 140 }} value={scriptText} onChange={e => setScriptText(e.target.value)} maxLength={5000} placeholder="Paste your video script or narration text here" required /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div><label style={label_s}>Platform</label>
          <select style={sel} value={platform} onChange={e => setPlatform(e.target.value)}>
            <option value="all">All Platforms</option><option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option><option value="instagram">Instagram</option>
          </select>
        </div>
        <div><label style={label_s}>Language</label><input style={inp} value={language} onChange={e => setLanguage(e.target.value)} placeholder="ISO code e.g. en, fr, es" /></div>
      </div>
      {loading ? <div style={loadingBox}><div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>SEO Agent is crafting your metadata…</div>
               : <button type="submit" style={title && scriptText ? submitBtn : disabledBtn} disabled={!title || !scriptText}>Generate SEO Metadata</button>}
      {error && <div style={errorBox}>{error}</div>}
      {result && <SEOResultExpanded data={result} />}
    </form>
  );
}

/* ── MediaAssetPicker ───────────────────────────────────────────────── */
interface MediaAsset { id: string; name: string; status: string; public_url?: string; asset_type: string; custom_metadata?: Record<string, any>; created_at: string; }

function MediaAssetPicker({ assetType, label, selected, onSelect }: {
  assetType: 'video' | 'image'; label: string;
  selected: { projectId: string; assetId: string; name: string } | null;
  onSelect: (v: { projectId: string; assetId: string; name: string; publicUrl?: string } | null) => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false); const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(''); const [error, setError] = useState<string | null>(null);

  const loadAssets = async () => {
    setLoading(true); setError(null);
    try { const data = await mediaCloudAPI.listAssets({ type: assetType, status: 'active', limit: 50 }); setAssets(data.assets ?? data.data ?? []); }
    catch (err: any) { setError(err?.message || 'Failed to load assets'); } finally { setLoading(false); }
  };

  const handleOpen = () => { setOpen(o => !o); if (!open && assets.length === 0) loadAssets(); };
  const filtered = search.trim() ? assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase())) : assets;
  const hasPipelineIds = (a: MediaAsset) => { const m = a.custom_metadata || {}; return !!m.pipeline_project_id && !!m.pipeline_asset_id; };

  const handleSelect = (asset: MediaAsset) => {
    const meta = asset.custom_metadata || {};
    const projectId = meta.pipeline_project_id ? String(meta.pipeline_project_id) : '';
    const assetId   = meta.pipeline_asset_id   ? String(meta.pipeline_asset_id)   : '';
    onSelect({ projectId, assetId, name: asset.name, publicUrl: asset.public_url }); setOpen(false);
  };

  return (
    <div style={fieldGroup}>
      <label style={label_s}>{label}</label>
      {selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 12px', background: 'rgba(0,200,150,0.07)', border: '1px solid rgba(0,200,150,0.22)', borderRadius: 9 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{selected.name}</div>
            {selected.projectId
              ? <div style={{ fontSize: 10, color: 'rgba(0,200,150,0.7)', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>Project: {selected.projectId} · Asset: {selected.assetId}</div>
              : <div style={{ fontSize: 10, color: C.red, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>No pipeline IDs — this asset may not be compatible.</div>}
          </div>
          <button type="button" onClick={() => onSelect(null)} style={{ fontSize: 11, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}>✕ Clear</button>
        </div>
      )}
      <button type="button" onClick={handleOpen} style={{ ...inp, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: selected ? C.text : C.muted } as React.CSSProperties}>
        <span>{selected ? `Selected: ${selected.name}` : `Choose ${assetType} from Media Cloud…`}</span>
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 6, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', maxHeight: 280, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" style={{ ...inp, padding: '6px 10px', fontSize: 12 }} autoFocus />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div style={{ padding: 16, textAlign: 'center', color: C.muted, fontSize: 12 }}>Loading assets…</div>}
            {error   && <div style={{ padding: '12px 16px', color: C.red, fontSize: 12 }}>{error}</div>}
            {!loading && filtered.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: C.muted, fontSize: 12 }}>No {assetType} assets found.</div>}
            {filtered.map(asset => (
              <button key={asset.id} type="button" onClick={() => handleSelect(asset)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' } as React.CSSProperties}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {asset.public_url && assetType === 'image' && <img src={asset.public_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} onError={e => (e.currentTarget.style.display = 'none')} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: hasPipelineIds(asset) ? C.green : C.faint }}>{hasPipelineIds(asset) ? '✓ Compatible' : 'No pipeline IDs'}</span>
                    <span style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace" }}>{new Date(asset.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}` }}>
            <button type="button" onClick={loadAssets} style={{ fontSize: 10, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>↻ Refresh</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── RecentQuickGeneratesPanel ──────────────────────────────────────── */
interface LibraryAsset { id: string; name: string; status: string; public_url?: string; custom_metadata?: { ai_video_job_id?: string; pipeline_project_id?: string; prompt?: string; provider?: string; aspect_ratio?: string; duration_sec?: number; }; created_at: string; updated_at: string; }

function RecentQuickGeneratesPanel({ onResumeTracking }: { onResumeTracking: (aiVideoJobId: string, libraryAssetId: string) => void }) {
  const [assets, setAssets] = useState<LibraryAsset[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);

  const load = async () => { setLoading(true); setError(null); try { const data = await quickVideoAPI.library(); setAssets(data.assets ?? []); } catch (err: any) { setError(err?.message || 'Failed to load library'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const statusColor: Record<string, string> = { active: C.green, pending_review: C.amber, archived: C.red };
  const statusLabel: Record<string, string> = { active: 'Complete', pending_review: 'Generating…', archived: 'Failed' };

  if (loading) return <div style={{ marginTop: 24, padding: 16, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, textAlign: 'center', color: C.muted, fontSize: 12 }}>Loading recent generations…</div>;
  if (error || assets.length === 0) return (
    <div style={{ marginTop: 24, padding: '14px 18px', background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
      <SLabel>Recent Quick Generates</SLabel>
      <div style={{ fontSize: 12, color: C.faint }}>No past quick-generate videos yet.</div>
    </div>
  );

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SLabel>Recent Quick Generates ({assets.length})</SLabel>
        <button type="button" onClick={load} style={{ fontSize: 10, color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>↻ Refresh</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {assets.map(asset => {
          const meta = asset.custom_metadata || {}; const jobId = meta.ai_video_job_id || '';
          const isGenerating = asset.status === 'pending_review'; const isDone = asset.status === 'active'; const isFailed = asset.status === 'archived';
          return (
            <div key={asset.id} style={{ padding: '12px 14px', background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor[asset.status] || C.muted, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                  {meta.prompt && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.prompt}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: statusColor[asset.status] || C.muted, fontFamily: "'DM Mono',monospace" }}>{statusLabel[asset.status] || asset.status}</span>
                    {meta.provider && <span style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace" }}>{meta.provider}</span>}
                    {meta.aspect_ratio && <span style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace" }}>{meta.aspect_ratio}</span>}
                  </div>
                </div>
              </div>
              {isDone && asset.public_url && (
                <div style={{ marginTop: 10 }}>
                  <video src={asset.public_url} controls style={{ width: '100%', borderRadius: 8, maxHeight: 200, background: '#000' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <a href="/media-cloud" style={{ fontSize: 11, color: C.green, textDecoration: 'none', fontFamily: "'DM Mono',monospace" }}>Open in Media Cloud →</a>
                    <a href={asset.public_url} download style={{ fontSize: 11, color: C.muted, textDecoration: 'none', fontFamily: "'DM Mono',monospace" }}>⬇️ Download</a>
                  </div>
                </div>
              )}
              {isGenerating && jobId && (
                <button type="button" onClick={() => onResumeTracking(jobId, asset.id)} style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: C.amber, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>↺ Resume Tracking</button>
              )}
              {isFailed && <div style={{ marginTop: 8, fontSize: 11, color: C.red }}>Generation failed. Check Media Cloud for details.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── VideoTab ───────────────────────────────────────────────────────── */
interface QuickJobState { libraryAssetId: string; aiVideoJobId: string; projectId: string; provider: string; }
type PollStatus = 'queued' | 'pending' | 'processing' | 'polling' | 'complete' | 'failed';

function VideoTab({ token }: { token: string }) {
  const [prompt, setPrompt] = useState(''); const [provider, setProvider] = useState('minimax');
  const [aspectRatio, setAspectRatio] = useState('16:9'); const [durationSec, setDurationSec] = useState(5);
  const [loading, setLoading] = useState(false); const [job, setJob] = useState<QuickJobState | null>(null);
  const [pollStatus, setPollStatus] = useState<PollStatus | null>(null); const [pollProgress, setPollProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPolling(), []);

  const startPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const data = await quickVideoAPI.sync(jobId);
        setPollStatus(data.status as PollStatus); setPollProgress(data.progress || 0);
        if (data.output_url) setOutputUrl(data.output_url);
        if (data.status === 'complete' || data.status === 'failed') stopPolling();
      } catch { /* keep polling */ }
    }, 15_000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!prompt.trim()) return;
    setLoading(true); setError(null); setJob(null); setPollStatus(null); setPollProgress(0); setOutputUrl(null); stopPolling();
    try {
      const data = await quickVideoAPI.generate({ prompt: prompt.trim(), provider, aspect_ratio: aspectRatio, duration_sec: durationSec });
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setJob({ libraryAssetId: data.libraryAssetId, aiVideoJobId: data.aiVideoJobId, projectId: data.projectId, provider: data.provider });
      setPollStatus('queued'); startPolling(data.aiVideoJobId);
    } catch (err: any) { setError(err?.message || 'Video generation failed'); } finally { setLoading(false); }
  };

  const isReady = !loading && !!prompt.trim();
  const isGenerating = !!job && pollStatus !== 'complete' && pollStatus !== 'failed';
  const isDone = pollStatus === 'complete'; const isFailed = pollStatus === 'failed';
  const STAGE_LABEL: Record<string, string> = { queued: 'Queued…', pending: 'Pending…', processing: 'Processing…', polling: 'Polling AI provider…', complete: 'Complete ✓', failed: 'Failed' };

  return (
    <>
    <div style={{ ...infoBox, background: 'rgba(0,200,150,0.06)', borderColor: 'rgba(0,200,150,0.25)', color: 'rgba(0,200,150,0.9)' }}>
      <strong>🎬 Quick Generate</strong> — Describe your video. AutoFlowNG creates all pipeline records + a permanent <a href="/media-cloud" style={{ color: C.green }}>Media Cloud</a> entry instantly.
    </div>
    <form onSubmit={handleSubmit}>
      <div style={fieldGroup}><label style={label_s}>Video Prompt</label><textarea style={{ ...textarea_s, minHeight: 110 }} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the video vividly…" disabled={isGenerating} required /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div><label style={label_s}>Provider</label><select style={sel} value={provider} onChange={e => setProvider(e.target.value)} disabled={isGenerating}><option value="minimax">MiniMax</option><option value="runway">Runway</option><option value="kling">Kling</option><option value="luma">Luma</option></select></div>
        <div><label style={label_s}>Aspect Ratio</label><select style={sel} value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} disabled={isGenerating}><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option></select></div>
        <div><label style={label_s}>Duration</label><select style={sel} value={durationSec} onChange={e => setDurationSec(parseInt(e.target.value))} disabled={isGenerating}>{[3,5,8,10].map(d => <option key={d} value={d}>{d}s</option>)}</select></div>
      </div>
      {loading && <div style={loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>Creating your Media Cloud asset and queuing generation…</div>}
      {!loading && !isGenerating && <button type="submit" style={isReady ? submitBtn : disabledBtn} disabled={!isReady}>⚡ Quick Generate</button>}
      {error && <div style={errorBox}>{error}</div>}
      {job && !isDone && !isFailed && (
        <div style={{ marginTop: 18, padding: '18px 20px', background: 'rgba(0,200,150,0.05)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: "'Syne',sans-serif" }}>🎬 Generating with {job.provider}</span>
            <span style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace" }}>{STAGE_LABEL[pollStatus || 'queued']}</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', background: C.green, borderRadius: 4, width: `${Math.max(pollProgress, 5)}%`, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace" }}>Library Asset ID: {job.libraryAssetId} · Checking every 15s…</div>
        </div>
      )}
      {isDone && (
        <div style={{ marginTop: 18, padding: '18px 20px', background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.green, fontFamily: "'Syne',sans-serif", marginBottom: 10 }}>✓ Video ready!</div>
          {outputUrl && <video src={outputUrl} controls style={{ width: '100%', borderRadius: 10, marginBottom: 12, maxHeight: 320, background: '#000' }} />}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/media-cloud" style={{ ...submitBtn as any, textDecoration: 'none', display: 'inline-block', textAlign: 'center', width: 'auto', padding: '10px 20px' }}>View in Media Cloud</a>
            {outputUrl && <a href={outputUrl} download style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid rgba(0,200,150,0.3)`, color: C.green, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>⬇️ Download</a>}
            <button type="button" onClick={() => { setJob(null); setPollStatus(null); setOutputUrl(null); }} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 13, cursor: 'pointer' }}>Generate another</button>
          </div>
        </div>
      )}
      {isFailed && <div style={{ ...errorBox, marginTop: 18 }}><div style={{ fontWeight: 700, marginBottom: 4 }}>Generation failed</div><button type="button" onClick={() => { setJob(null); setPollStatus(null); setError(null); }} style={{ fontSize: 12, color: C.red, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>↩ Try again</button></div>}
    </form>
    <RecentQuickGeneratesPanel onResumeTracking={(jobId, libraryAssetId) => { setJob(prev => prev ?? { libraryAssetId, aiVideoJobId: jobId, projectId: '', provider: '' }); setPollStatus('queued'); startPolling(jobId); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
    </>
  );
}

/* ── StyleTab ───────────────────────────────────────────────────────── */
function StyleTab({ token }: { token: string }) {
  const [selectedAsset, setSelectedAsset] = useState<{ projectId: string; assetId: string; name: string; publicUrl?: string } | null>(null);
  const [styleTarget, setStyleTarget] = useState('anime');
  const handleVideoUpload = useCallback((asset: UploadedAsset) => { if (asset.projectId && asset.assetId) setSelectedAsset({ projectId: asset.projectId, assetId: asset.assetId, name: asset.name, publicUrl: asset.publicUrl }); }, []);
  const [loading, setLoading] = useState(false); const [result, setResult] = useState<any>(null); const [error, setError] = useState<string | null>(null);
  const projectId = selectedAsset?.projectId || ''; const assetId = selectedAsset?.assetId || '';

  const STYLES = [{ value: 'anime', label: '🌸 Anime' }, { value: 'cartoon', label: '🎭 Cartoon' }, { value: 'comic', label: '💥 Comics' }, { value: 'cinematic', label: '🎬 Cinematic' }, { value: 'storybook', label: '📖 Storybook' }];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!projectId.trim() || !assetId.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try { const data = await videoStyleAPI.apply(projectId.trim(), assetId.trim(), { style_target: styleTarget, provider: 'fal' }); setResult(data); }
    catch (err: any) { setError(err?.message || 'Style conversion failed'); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={infoBox}>✨ <strong>Style Conversion</strong> transforms an existing video into Anime, Cartoon, Comics, or Cinematic style.</div>
      <DragDropUpload accept="video/*" label="Upload Video File" onUploaded={handleVideoUpload} />
      <MediaAssetPicker assetType="video" label="Or Choose from Media Cloud" selected={selectedAsset} onSelect={setSelectedAsset} />
      <div style={fieldGroup}>
        <label style={label_s}>Target Style</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
          {STYLES.map(st => (
            <button key={st.value} type="button" onClick={() => setStyleTarget(st.value)} style={{ padding: '10px 14px', borderRadius: 10, border: styleTarget === st.value ? `1px solid ${C.green}` : `1px solid ${C.border}`, background: styleTarget === st.value ? 'rgba(0,200,150,0.1)' : 'rgba(255,255,255,0.03)', color: styleTarget === st.value ? C.green : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>{st.label}</button>
          ))}
        </div>
      </div>
      {loading ? <div style={loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>Queuing style conversion…</div> : <button type="submit" style={projectId && assetId ? submitBtn : disabledBtn} disabled={!projectId || !assetId}>Apply Style</button>}
      {error && <div style={errorBox}>{error}</div>}
      {result?.success && <div style={successBox}>✓ Style conversion queued! The styled video will appear in your <a href="/media-cloud" style={{ color: C.green }}>Media Cloud</a> once complete.</div>}
    </form>
  );
}

/* ── AnimationTab ───────────────────────────────────────────────────── */
function AnimationTab({ token }: { token: string }) {
  const [selectedAsset, setSelectedAsset] = useState<{ projectId: string; assetId: string; name: string; publicUrl?: string } | null>(null);
  const [style, setStyle] = useState('ken_burns');
  const handleImageUpload = useCallback((asset: UploadedAsset) => { if (asset.projectId && asset.assetId) setSelectedAsset({ projectId: asset.projectId, assetId: asset.assetId, name: asset.name, publicUrl: asset.publicUrl }); }, []);
  const [provider, setProvider] = useState('local'); const [loading, setLoading] = useState(false); const [result, setResult] = useState<any>(null); const [error, setError] = useState<string | null>(null);
  const projectId = selectedAsset?.projectId || ''; const assetId = selectedAsset?.assetId || '';

  const ANIM_STYLES = [{ value: 'ken_burns', label: '📷 Ken Burns' }, { value: 'zoom_in', label: '🔍 Zoom In' }, { value: 'zoom_out', label: '🔎 Zoom Out' }, { value: 'pan_left', label: '⬅️ Pan Left' }, { value: 'pan_right', label: '➡️ Pan Right' }, { value: 'parallax', label: '🌊 Parallax' }];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!projectId.trim() || !assetId.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try { const data = await animationAPI.animate(projectId.trim(), assetId.trim(), { style, provider }); setResult(data); }
    catch (err: any) { setError(err?.message || 'Animation failed'); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={infoBox}>🌀 <strong>Image Animation</strong> turns a static image into an animated video clip.</div>
      <DragDropUpload accept="image/*" label="Upload Image File" onUploaded={handleImageUpload} />
      <MediaAssetPicker assetType="image" label="Or Choose from Media Cloud" selected={selectedAsset} onSelect={setSelectedAsset} />
      <div style={fieldGroup}>
        <label style={label_s}>Animation Style</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 8 }}>
          {ANIM_STYLES.map(st => (
            <button key={st.value} type="button" onClick={() => setStyle(st.value)} style={{ padding: '10px 14px', borderRadius: 10, border: style === st.value ? `1px solid ${C.green}` : `1px solid ${C.border}`, background: style === st.value ? 'rgba(0,200,150,0.1)' : 'rgba(255,255,255,0.03)', color: style === st.value ? C.green : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>{st.label}</button>
          ))}
        </div>
      </div>
      <div style={fieldGroup}><label style={label_s}>Provider</label><select style={sel} value={provider} onChange={e => setProvider(e.target.value)}><option value="local">Local (FFmpeg)</option><option value="runway">Runway Gen-3</option><option value="stability">Stability AI</option><option value="fal">fal.ai (Kling)</option></select></div>
      {loading ? <div style={loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>🌀</div>Queuing animation job…</div> : <button type="submit" style={projectId && assetId ? submitBtn : disabledBtn} disabled={!projectId || !assetId}>Animate Image</button>}
      {error && <div style={errorBox}>{error}</div>}
      {result?.success && <div style={successBox}>✓ Animation job queued! The clip will appear in your <a href="/media-cloud" style={{ color: C.green }}>Media Cloud</a> once ready.</div>}
    </form>
  );
}

/* ── ImageEditTab ───────────────────────────────────────────────────── */
function ImageEditTab({ token }: { token: string }) {
  const [imageUrl, setImageUrl] = useState(''); const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [prompt, setPrompt] = useState(''); const [negativePrompt, setNegativePrompt] = useState('');
  const [strength, setStrength] = useState(0.75); const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ outputUrl: string; provider: string; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleImageUpload = useCallback((asset: UploadedAsset) => { if (asset.publicUrl) setImageUrl(asset.publicUrl); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!imageUrl.trim() || !prompt.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await aiAPI.imageEdit({ imageUrl: imageUrl.trim(), prompt, negativePrompt, strength });
      if (data.outputUrl) setResult({ outputUrl: data.outputUrl, provider: data.provider || 'pollinations', model: data.model || 'flux' });
      else throw new Error(data.error || 'No output returned');
    } catch (err: any) { setError(err?.message || 'Image editing failed'); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={infoBox}>🖼️ <strong>Image Edit</strong> uses Pollinations.ai's Kontext model for guided instruction-following edits.</div>
      <div style={fieldGroup}>
        <label style={label_s}>Source Image</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['upload', 'url'] as const).map(mode => (
            <button key={mode} type="button" onClick={() => setInputMode(mode)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: inputMode === mode ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)', color: inputMode === mode ? C.blue : C.muted, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", transition: 'all 0.15s' }}>
              {mode === 'upload' ? '📁 Upload File' : '🔗 Paste URL'}
            </button>
          ))}
        </div>
        {inputMode === 'upload' ? <DragDropUpload accept="image/*" label="" onUploaded={handleImageUpload} /> : <input style={inp} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/your-image.jpg" />}
        {imageUrl.trim() && <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, maxHeight: 200 }}><img src={imageUrl} alt="Preview" style={{ width: '100%', objectFit: 'cover', maxHeight: 200, display: 'block' }} onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }} /></div>}
      </div>
      <div style={fieldGroup}><label style={label_s}>Edit Instruction</label><textarea style={{ ...textarea_s, minHeight: 80 }} value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={400} placeholder="Describe the edit…" required /></div>
      <div style={fieldGroup}><label style={label_s}>Negative Prompt (optional)</label><input style={inp} value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="Things to avoid…" /></div>
      <div style={fieldGroup}>
        <label style={label_s}>Edit Strength: {Math.round(strength * 100)}%</label>
        <input type="range" min={0.2} max={1.0} step={0.05} value={strength} onChange={e => setStrength(parseFloat(e.target.value))} style={{ width: '100%', accentColor: C.green }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace", marginTop: 4 }}><span>Subtle (20%)</span><span>Balanced (75%)</span><span>Maximum (100%)</span></div>
      </div>
      {loading ? <div style={loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>AI is editing your image… up to 2 minutes.</div> : <button type="submit" style={imageUrl && prompt ? submitBtn : disabledBtn} disabled={!imageUrl || !prompt}>Edit Image</button>}
      {error && <div style={errorBox}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><div style={{ ...label_s, marginBottom: 8 }}>Original</div><img src={imageUrl} alt="Original" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 240 }} /></div>
            <div><div style={{ ...label_s, marginBottom: 8 }}>Edited</div><img src={result.outputUrl} alt="Edited" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 240 }} /></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace" }}>via {result.provider} · {result.model}</span>
            <a href={result.outputUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.green, textDecoration: 'none' }}>⬇️ Download</a>
          </div>
        </div>
      )}
    </form>
  );
}

/* ── ImageGenerateTab ───────────────────────────────────────────────── */
function ImageGenerateTab({ token }: { token: string }) {
  const [prompt, setPrompt] = useState(''); const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'square' | 'portrait' | 'landscape' | 'widescreen'>('square');
  const [loading, setLoading] = useState(false); const [result, setResult] = useState<{ outputUrl: string; provider: string; model: string } | null>(null); const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!prompt.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await aiAPI.imageGenerate({ prompt: prompt.trim(), negativePrompt, aspectRatio });
      if (data.outputUrl) setResult({ outputUrl: data.outputUrl, provider: data.provider || 'pollinations', model: data.model || 'flux' });
      else throw new Error(data.error || 'No output returned');
    } catch (err: any) { setError(err?.message || 'Image generation failed'); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={infoBox}>✏️ <strong>Generate</strong> creates a brand-new image from a text description — no source image needed.</div>
      <div style={fieldGroup}><label style={label_s}>Prompt</label><textarea style={{ ...textarea_s, minHeight: 80 }} value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={500} placeholder="Describe the image you want…" required /></div>
      <div style={fieldGroup}><label style={label_s}>Negative Prompt (optional)</label><input style={inp} value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="Things to avoid…" /></div>
      <div style={fieldGroup}>
        <label style={label_s}>Aspect Ratio</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([{ id: 'square', label: 'Square (1:1)' }, { id: 'portrait', label: 'Portrait (3:4)' }, { id: 'landscape', label: 'Landscape (4:3)' }, { id: 'widescreen', label: 'Widescreen (16:9)' }] as const).map(opt => (
            <button key={opt.id} type="button" onClick={() => setAspectRatio(opt.id)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: aspectRatio === opt.id ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.04)', color: aspectRatio === opt.id ? C.green : C.muted, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", transition: 'all 0.15s' }}>{opt.label}</button>
          ))}
        </div>
      </div>
      {loading ? <div style={loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>✏️</div>AI is generating your image… up to 2 minutes.</div> : <button type="submit" style={prompt.trim() ? submitBtn : disabledBtn} disabled={!prompt.trim()}>Generate Image</button>}
      {error && <div style={errorBox}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <img src={result.outputUrl} alt="Generated" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 360, marginBottom: 12 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace" }}>via {result.provider} · {result.model}</span>
            <a href={result.outputUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.green, textDecoration: 'none' }}>⬇️ Download</a>
          </div>
        </div>
      )}
    </form>
  );
}

/* ── SEOResultExpanded ──────────────────────────────────────────────── */
function SEOResultExpanded({ data }: { data: any }) {
  const platforms = ['youtube', 'tiktok', 'instagram'].filter(p => data?.[p]);
  if (platforms.length === 0) return <div style={{ ...errorBox, marginTop: 16 }}>No metadata returned.</div>;
  return <div style={{ marginTop: 20 }}>{platforms.map(p => <PlatformSection key={p} platform={p} data={data[p]} />)}</div>;
}

function PlatformSection({ platform, data }: { platform: string; data: any }) {
  const [copied, setCopied] = useState(false); const [expanded, setExpanded] = useState(true);
  const platformEmoji = platform === 'youtube' ? '▶️' : platform === 'tiktok' ? '🎵' : '📸';
  const copyAll = () => {
    const parts: string[] = [];
    if (data.title) parts.push(`Title: ${data.title}`);
    if (data.description) parts.push(`\nDescription:\n${data.description}`);
    if (data.tags?.length) parts.push(`\nTags: ${data.tags.join(', ')}`);
    if (data.hashtags?.length) parts.push(`\nHashtags: ${data.hashtags.join(' ')}`);
    navigator.clipboard.writeText(parts.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{platformEmoji} {platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); copyAll(); }} style={{ fontSize: 10, fontWeight: 700, color: copied ? C.green : C.muted, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>{copied ? '✓ Copied' : 'Copy all'}</button>
          <span style={{ color: C.muted, fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {data.title && <div style={{ marginBottom: 10 }}><div style={label_s}>Title</div><div style={{ fontSize: 13, color: C.text }}>{data.title}</div></div>}
          {data.description && <div style={{ marginBottom: 10 }}><div style={label_s}>Description</div><div style={{ fontSize: 12, color: C.muted, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>{data.description}</div></div>}
          {data.tags?.length > 0 && <div style={{ marginBottom: 10 }}><div style={label_s}>Tags</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{data.tags.slice(0, 15).map((tag: string) => <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,200,150,0.1)', color: C.green, fontFamily: "'DM Mono',monospace" }}>{tag}</span>)}</div></div>}
          {data.hashtags?.length > 0 && <div><div style={label_s}>Hashtags</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{data.hashtags.map((h: string) => <span key={h} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: C.purple, fontFamily: "'DM Mono',monospace" }}>{h}</span>)}</div></div>}
        </div>
      )}
    </div>
  );
}

/* ── RecentJobs ─────────────────────────────────────────────────────── */
function RecentJobs({ jobs, onRefresh }: { jobs: AgentJob[]; onRefresh: () => void }) {
  if (jobs.length === 0) return <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No jobs yet. Generate your first thumbnail or SEO metadata above.</div>;
  return <div>{jobs.map(job => <JobRow key={job.id} job={job} />)}</div>;
}

function JobRow({ job }: { job: AgentJob }) {
  const [showSEO, setShowSEO] = useState(false);
  const statusColors: Record<string, string> = { completed: C.green, failed: C.red, running: C.amber, pending: C.muted };
  const dot = statusColors[job.status] || C.muted;
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 8, background: C.raised }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>
          {job.agent_type === 'thumbnail' ? '🎨 Thumbnail' : '📝 SEO'} · {job.input_data?.title || 'Untitled'}
        </span>
        <span style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace" }}>{job.status}</span>
      </div>
      {job.status === 'completed' && job.agent_type === 'thumbnail' && job.output_data?.image_url && (
        <img src={job.output_data.image_url} alt="" style={{ width: '100%', borderRadius: 6, maxHeight: 140, objectFit: 'cover', marginTop: 8 }} />
      )}
      {job.status === 'completed' && job.agent_type === 'seo' && job.output_data && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowSEO(!showSEO)} style={{ fontSize: 11, color: C.green, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace", padding: 0 }}>
            {showSEO ? '▲ Hide' : '▼ Show metadata'}
          </button>
          {showSEO && <SEOResultExpanded data={job.output_data} />}
        </div>
      )}
      {job.error_message && <div style={{ marginTop: 6, fontSize: 11, color: C.red, fontFamily: "'DM Mono',monospace" }}>{job.error_message}</div>}
    </div>
  );
}
