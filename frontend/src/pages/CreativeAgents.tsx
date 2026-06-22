/**
 * AutoFlowNG — Creative Agents Studio (Phase 37 + Tasks 5 & 6)
 *
 * Tabs:
 *   1. Thumbnail      — existing
 *   2. SEO Metadata   — existing
 *   3. Video          — Task 5: generate video from text prompt (Phase 32)
 *   4. Style          — Task 5: Anime / Cartoon / Comics / Cinematic style conversion (Phase 31)
 *   5. Animation      — Task 5: Image-to-video animation (Phase 30)
 *   6. Image Edit     — Task 6: pixel-level image editing via Replicate (new image-editor.js)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageTransition } from '../components/PageTransition';
import { Reveal } from '../components/Reveal';
import { aiAPI, videoStyleAPI, animationAPI, quickVideoAPI, mediaCloudAPI } from '../lib/api';

// ── Local form-upload helper (same pattern as MediaCloudPage) ─────────────────
const formAPI = (path: string, body: FormData) =>
  fetch(`/api${path}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('autoflowng_token') || ''}` },
    body,
  }).then(r => r.json());

// ── DragDropUpload — reusable drag-and-drop / click-to-browse file uploader ───
// Uploads to the same asset-library endpoint used by MediaCloudPage.
// On success calls onUploaded({ publicUrl, assetId, projectId, name }).

interface UploadedAsset {
  name:       string;
  publicUrl:  string;
  assetId:    string;
  projectId:  string;
}

function DragDropUpload({
  accept,
  label,
  onUploaded,
}: {
  accept:     string;         // e.g. "image/*" or "video/*"
  label:      string;         // e.g. "Source Image"
  onUploaded: (a: UploadedAsset) => void;
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
      fd.append('file', file);
      fd.append('name', file.name);
      fd.append('asset_type', file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'other');
      const data = await formAPI('/asset-library/upload', fd);
      if (data.error) throw new Error(data.error);
      const result: UploadedAsset = {
        name:      file.name,
        publicUrl: data.public_url || data.url || '',
        assetId:   data.pipeline_asset_id ? String(data.pipeline_asset_id) : (data.id ? String(data.id) : ''),
        projectId: data.pipeline_project_id ? String(data.pipeline_project_id) : '',
      };
      setUploaded(result);
      onUploaded(result);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false); setProgress('');
    }
  }, [onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const borderColor = dragging ? '#00C896' : (uploaded ? '#00C89660' : 'rgba(255,255,255,0.1)');
  const bg          = dragging ? 'rgba(0,200,150,0.06)' : 'rgba(255,255,255,0.02)';

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(232,238,255,0.5)', fontFamily: "'DM Mono',monospace", letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
        {label}
      </label>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: 12,
          padding: '20px 16px',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: bg,
          transition: 'all 0.18s',
        }}
      >
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={onInputChange} />
        {uploading ? (
          <div style={{ fontSize: 12, color: '#38BDF8', fontFamily: "'DM Mono',monospace" }}>{progress}</div>
        ) : uploaded ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#00C896' }}>✓ {uploaded.name}</div>
            <div style={{ fontSize: 10, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
              Click or drop to replace
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 22, marginBottom: 6 }}>📁</div>
            <div style={{ fontSize: 12, color: 'rgba(232,238,255,0.55)' }}>
              Drop file here or <span style={{ color: '#38BDF8', fontWeight: 700 }}>click to browse</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(232,238,255,0.25)', fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
              {accept.replace('/*', ' files')} · Max 100 MB
            </div>
          </div>
        )}
      </div>
      {error && <div style={{ fontSize: 11, color: '#FB7185', marginTop: 6, fontFamily: "'DM Mono',monospace" }}>⚠ {error}</div>}
    </div>
  );
}


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

type ActiveTab = 'thumbnail' | 'seo' | 'video' | 'style' | 'animation' | 'edit' | 'generate';

// ── Styles ────────────────────────────────────────────────────────────────────

const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: '1 1 auto',
    padding: '9px 14px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s',
    background: active ? '#00C896' : 'transparent',
    color: active ? '#0d0f1a' : 'rgba(232,238,255,0.5)',
    whiteSpace: 'nowrap' as const,
});

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0d0f1a', padding: '40px 24px' },
  inner: { maxWidth: 900, margin: '0 auto' },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 700, color: '#E8EEFF', fontFamily: "'Syne', sans-serif", margin: 0 },
  subtitle: { fontSize: 14, color: 'rgba(232,238,255,0.45)', fontFamily: "'DM Sans', sans-serif", marginTop: 6 },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 28px', marginBottom: 24 },
  tabBar: { display: 'flex', gap: 4, marginBottom: 28, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' as const },
  tab: { flex: '1 1 auto', padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 } as React.CSSProperties,
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(232,238,255,0.4)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.07em', marginBottom: 6, textTransform: 'uppercase' as const },
  input: { width: '100%', background: 'rgba(232,238,255,0.05)', border: '1px solid rgba(232,238,255,0.1)', borderRadius: 10, color: '#E8EEFF', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 14px', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', background: 'rgba(232,238,255,0.05)', border: '1px solid rgba(232,238,255,0.1)', borderRadius: 10, color: '#E8EEFF', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 14px', outline: 'none', resize: 'vertical' as const, minHeight: 80, boxSizing: 'border-box' as const },
  select: { width: '100%', background: 'rgba(232,238,255,0.05)', border: '1px solid rgba(232,238,255,0.1)', borderRadius: 10, color: '#E8EEFF', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 14px', outline: 'none' },
  fieldGroup: { marginBottom: 18 },
  submitBtn: { width: '100%', background: '#00C896', color: '#0d0f1a', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', marginTop: 8 },
  disabledBtn: { width: '100%', background: 'rgba(0,200,150,0.3)', color: 'rgba(13,15,26,0.6)', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: 'not-allowed', marginTop: 8 },
  loadingBox: { padding: '24px', textAlign: 'center' as const, color: 'rgba(232,238,255,0.5)', fontFamily: "'DM Sans', sans-serif", fontSize: 14 },
  errorBox: { background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)', borderRadius: 10, padding: '12px 16px', color: '#FB7185', fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginTop: 16 },
  successBox: { background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 10, padding: '14px 18px', color: '#00C896', fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' as const },
  infoBox: { background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 10, padding: '12px 16px', color: 'rgba(56,189,248,0.8)', fontSize: 12, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 },
};

// ── Main Component ────────────────────────────────────────────────────────────

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

  const onJobComplete = () => { fetchJobs(); };

  const TABS: Array<{ id: ActiveTab; label: string; emoji: string }> = [
    { id: 'thumbnail', label: 'Thumbnail',   emoji: '🎨' },
    { id: 'seo',       label: 'SEO',         emoji: '📝' },
    { id: 'video',     label: 'Video',       emoji: '🎬' },
    { id: 'style',     label: 'Style',       emoji: '✨' },
    { id: 'animation', label: 'Animation',   emoji: '🌀' },
    { id: 'generate',  label: 'Generate',    emoji: '✏️' },
    { id: 'edit',      label: 'Image Edit',  emoji: '🖼️' },
  ];

  return (
    <PageTransition variant="slide">
    <div style={s.page}>
      <Reveal>
      <div style={s.inner}>
        <div style={s.header}>
          <h1 style={s.title}>🎨 AI Creative Agents</h1>
          <p style={s.subtitle}>Your AI creative team — thumbnail generation, SEO metadata, video creation, style conversion, animation, and image editing.</p>
        </div>

        <div style={s.card}>
          <div style={s.tabBar}>
            {TABS.map(t => (
              <button key={t.id} style={tabStyle(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'thumbnail'  && <ThumbnailTab headers={headers} onComplete={onJobComplete} />}
          {activeTab === 'seo'        && <SEOTab       headers={headers} onComplete={onJobComplete} />}
          {activeTab === 'video'      && <VideoTab     token={token} />}
          {activeTab === 'style'      && <StyleTab     token={token} />}
          {activeTab === 'animation'  && <AnimationTab token={token} />}
          {activeTab === 'edit'       && <ImageEditTab token={token} />}
          {activeTab === 'generate'   && <ImageGenerateTab token={token} />}
        </div>

        {/* Media Cloud Link */}
        <div style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'rgba(0,200,150,0.05)', borderColor: 'rgba(0,200,150,0.2)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#00C896', fontFamily: "'Syne', sans-serif" }}>View in Media Cloud</div>
            <div style={{ fontSize: 12, color: 'rgba(232,238,255,0.45)' }}>Manage and download all your generated assets in one place.</div>
          </div>
          <a href="/media-cloud" style={{ background: '#00C896', color: '#0d0f1a', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Open Library</a>
        </div>

        {/* Recent Jobs (thumbnail + SEO only) */}
        {(activeTab === 'thumbnail' || activeTab === 'seo') && (
          <div style={s.card}>
            <div style={s.sectionTitle}>Recent Jobs</div>
            <RecentJobs jobs={jobs.slice(0, 10)} onRefresh={fetchJobs} />
          </div>
        )}
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
    setLoading(true); setResult(null); setError(null);
    try {
      const res  = await fetch('/api/creative-agents/thumbnail', { method: 'POST', headers, body: JSON.stringify({ title, summary, style, palette }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data.output);
      onComplete();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={s.fieldGroup}>
        <label style={s.label}>Video Title</label>
        <input style={s.input} value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Enter your video title" required />
      </div>
      <div style={s.fieldGroup}>
        <label style={s.label}>Summary</label>
        <textarea style={{ ...s.textarea, minHeight: 80 }} value={summary} onChange={e => setSummary(e.target.value)} maxLength={300} placeholder="What is this video about?" required />
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
      {loading ? <div style={s.loadingBox}><div style={{ fontSize: 24, marginBottom: 8 }}>🎬</div>Director is framing the shot…</div>
               : <button type="submit" style={title && summary ? s.submitBtn : s.disabledBtn} disabled={!title || !summary}>Generate Thumbnail</button>}
      {error && <div style={s.errorBox}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <img src={result.image_url} alt="Generated thumbnail" style={{ width: '100%', borderRadius: 10, marginBottom: 10 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Mono',monospace" }}>{providerLabel(result.provider)}</span>
            <a href={result.image_url} download style={{ fontSize: 12, color: '#00C896', textDecoration: 'none', fontFamily: "'DM Sans',sans-serif" }}>⬇️ Download</a>
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
    setLoading(true); setResult(null); setError(null);
    try {
      const script = { scenes: [{ narration_text: scriptText }], source: 'manual' };
      const res    = await fetch('/api/creative-agents/seo', { method: 'POST', headers, body: JSON.stringify({ title, script, platform, language }) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data.output);
      onComplete();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={s.fieldGroup}>
        <label style={s.label}>Video Title</label>
        <input style={s.input} value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Enter your video title" required />
      </div>
      <div style={s.fieldGroup}>
        <label style={s.label}>Script Content</label>
        <textarea style={{ ...s.textarea, minHeight: 140 }} value={scriptText} onChange={e => setScriptText(e.target.value)} maxLength={5000} placeholder="Paste your video script or narration text here" required />
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
          <input style={s.input} value={language} onChange={e => setLanguage(e.target.value)} placeholder="ISO code e.g. en, fr, es" />
        </div>
      </div>
      {loading ? <div style={s.loadingBox}><div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>SEO Agent is crafting your metadata…</div>
               : <button type="submit" style={title && scriptText ? s.submitBtn : s.disabledBtn} disabled={!title || !scriptText}>Generate SEO Metadata</button>}
      {error && <div style={s.errorBox}>{error}</div>}
      {result && <SEOResultExpanded data={result} />}
    </form>
  );
}


// ── MediaAssetPicker — replaces manual Project ID / Asset ID inputs ───────────
// Loads assets from Media Cloud and lets the user pick one.
// Returns { projectId, assetId, assetName, publicUrl } via onSelect callback.
interface MediaAsset {
  id: string;
  name: string;
  status: string;
  public_url?: string;
  asset_type: string;
  custom_metadata?: Record<string, any>;
  created_at: string;
}

function MediaAssetPicker({
  assetType,
  label,
  selected,
  onSelect,
}: {
  assetType: 'video' | 'image';
  label: string;
  selected: { projectId: string; assetId: string; name: string } | null;
  onSelect: (v: { projectId: string; assetId: string; name: string; publicUrl?: string } | null) => void;
}) {
  const [assets, setAssets]   = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [error,   setError]   = useState<string | null>(null);

  const loadAssets = async () => {
    setLoading(true); setError(null);
    try {
      const data = await mediaCloudAPI.listAssets({ type: assetType, status: 'active', limit: 50 });
      const list: MediaAsset[] = data.assets ?? data.data ?? [];
      setAssets(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load assets');
    } finally { setLoading(false); }
  };

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open && assets.length === 0) loadAssets();
  };

  const filtered = search.trim()
    ? assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : assets;

  const handleSelect = (asset: MediaAsset) => {
    const meta = asset.custom_metadata || {};
    const projectId = meta.pipeline_project_id ? String(meta.pipeline_project_id) : '';
    const assetId   = meta.pipeline_asset_id   ? String(meta.pipeline_asset_id)   : '';
    if (projectId && assetId) {
      onSelect({ projectId, assetId, name: asset.name, publicUrl: asset.public_url });
    } else {
      // Asset not from Quick Generate pipeline — show helpful message
      onSelect({ projectId: '', assetId: '', name: asset.name, publicUrl: asset.public_url });
    }
    setOpen(false);
  };

  const hasPipelineIds = (a: MediaAsset) => {
    const m = a.custom_metadata || {};
    return !!m.pipeline_project_id && !!m.pipeline_asset_id;
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={s.label}>{label}</label>

      {selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 12px', background: 'rgba(0,200,150,0.07)', border: '1px solid rgba(0,200,150,0.22)', borderRadius: 9 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif" }}>{selected.name}</div>
            {selected.projectId
              ? <div style={{ fontSize: 10, color: 'rgba(0,200,150,0.7)', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>Project: {selected.projectId} · Asset: {selected.assetId}</div>
              : <div style={{ fontSize: 10, color: '#FB7185', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>No pipeline IDs — this asset may not be compatible. Try a Quick Generate asset.</div>
            }
          </div>
          <button type="button" onClick={() => onSelect(null)} style={{ fontSize: 11, color: 'rgba(232,238,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>✕ Clear</button>
        </div>
      )}

      <button
        type="button"
        onClick={handleOpen}
        style={{ ...s.input, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: selected ? '#E8EEFF' : 'rgba(232,238,255,0.4)' } as React.CSSProperties}
      >
        <span>{selected ? `Selected: ${selected.name}` : `Choose ${assetType} from Media Cloud…`}</span>
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 6, background: '#12141f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden', maxHeight: 280, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search assets…"
              style={{ ...s.input, padding: '6px 10px', fontSize: 12 }}
              autoFocus
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(232,238,255,0.3)', fontSize: 12 }}>Loading assets…</div>}
            {error   && <div style={{ padding: '12px 16px', color: '#FB7185', fontSize: 12 }}>{error}</div>}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(232,238,255,0.3)', fontSize: 12 }}>
                No {assetType} assets found in Media Cloud. Generate one using the Video tab first.
              </div>
            )}
            {filtered.map(asset => (
              <button
                key={asset.id}
                type="button"
                onClick={() => handleSelect(asset)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' } as React.CSSProperties}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {asset.public_url && assetType === 'image' && (
                  <img src={asset.public_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} onError={e => (e.currentTarget.style.display = 'none')} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: hasPipelineIds(asset) ? '#00C896' : 'rgba(232,238,255,0.3)' }}>
                      {hasPipelineIds(asset) ? '✓ Compatible' : 'No pipeline IDs'}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(232,238,255,0.25)', fontFamily: "'DM Mono',monospace" }}>
                      {new Date(asset.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={loadAssets} style={{ fontSize: 10, color: 'rgba(232,238,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>↻ Refresh</button>
            <span style={{ fontSize: 10, color: 'rgba(232,238,255,0.2)', marginLeft: 12, fontFamily: "'DM Sans',sans-serif" }}>
              Only Quick Generate assets show pipeline IDs. Others need manual IDs.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RecentQuickGeneratesPanel — shows past quick-generate jobs ─────────────────
// Mounts below the Video tab form. Loads from quickVideoAPI.library().
// Users can resume tracking an in-progress job by re-attaching the polling loop.

interface LibraryAsset {
  id: string;
  name: string;
  status: string;
  public_url?: string;
  custom_metadata?: {
    ai_video_job_id?: string;
    pipeline_project_id?: string;
    prompt?: string;
    provider?: string;
    aspect_ratio?: string;
    duration_sec?: number;
  };
  created_at: string;
  updated_at: string;
}

function RecentQuickGeneratesPanel({
  onResumeTracking,
}: {
  onResumeTracking: (aiVideoJobId: string, libraryAssetId: string) => void;
}) {
  const [assets,  setAssets]  = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await quickVideoAPI.library();
      setAssets(data.assets ?? []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load library');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const statusColor: Record<string, string> = {
    active:         '#00C896',
    pending_review: '#FBBF24',
    archived:       '#FB7185',
  };

  const statusLabel: Record<string, string> = {
    active:         'Complete',
    pending_review: 'Generating…',
    archived:       'Failed',
  };

  if (loading) return (
    <div style={{ marginTop: 28, padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', color: 'rgba(232,238,255,0.3)', fontSize: 12 }}>
      Loading recent generations…
    </div>
  );

  if (error) return null;

  if (assets.length === 0) return (
    <div style={{ marginTop: 28, padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(232,238,255,0.25)', fontFamily: "'DM Mono',monospace", letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' as const }}>Recent Quick Generates</div>
      <div style={{ fontSize: 12, color: 'rgba(232,238,255,0.25)', fontFamily: "'DM Sans',sans-serif" }}>No past quick-generate videos yet. Your first generation will appear here.</div>
    </div>
  );

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Mono',monospace", letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>Recent Quick Generates ({assets.length})</div>
        <button type="button" onClick={load} style={{ fontSize: 10, color: 'rgba(232,238,255,0.35)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>↻ Refresh</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {assets.map(asset => {
          const meta       = asset.custom_metadata || {};
          const jobId      = meta.ai_video_job_id || '';
          const isGenerating = asset.status === 'pending_review';
          const isDone       = asset.status === 'active';
          const isFailed     = asset.status === 'archived';

          return (
            <div
              key={asset.id}
              style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[asset.status] || '#94A3B8', flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{asset.name}</div>
                  {meta.prompt && <div style={{ fontSize: 11, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Sans',sans-serif", marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{meta.prompt}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: statusColor[asset.status] || '#94A3B8', fontFamily: "'DM Mono',monospace" }}>{statusLabel[asset.status] || asset.status}</span>
                    {meta.provider && <span style={{ fontSize: 10, color: 'rgba(232,238,255,0.25)', fontFamily: "'DM Mono',monospace" }}>{meta.provider}</span>}
                    {meta.aspect_ratio && <span style={{ fontSize: 10, color: 'rgba(232,238,255,0.2)', fontFamily: "'DM Mono',monospace" }}>{meta.aspect_ratio}</span>}
                    <span style={{ fontSize: 10, color: 'rgba(232,238,255,0.2)', fontFamily: "'DM Mono',monospace" }}>{new Date(asset.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Video preview if done */}
              {isDone && asset.public_url && (
                <div style={{ marginTop: 10 }}>
                  <video
                    src={asset.public_url}
                    controls
                    style={{ width: '100%', borderRadius: 8, maxHeight: 200, background: '#000' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' as const }}>
                    <a href="/media-cloud" style={{ fontSize: 11, color: '#00C896', textDecoration: 'none', fontFamily: "'DM Mono',monospace" }}>Open in Media Cloud →</a>
                    <a href={asset.public_url} download style={{ fontSize: 11, color: 'rgba(232,238,255,0.45)', textDecoration: 'none', fontFamily: "'DM Mono',monospace" }}>⬇️ Download</a>
                  </div>
                </div>
              )}

              {/* Resume tracking if still generating and we have jobId */}
              {isGenerating && jobId && (
                <button
                  type="button"
                  onClick={() => onResumeTracking(jobId, asset.id)}
                  style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}
                >
                  ↺ Resume Tracking
                </button>
              )}

              {/* Failed note */}
              {isFailed && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#FB7185', fontFamily: "'DM Sans',sans-serif" }}>
                  Generation failed. Check Media Cloud for details.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Task 5 + 7: Video Generation Tab — Quick Generate ─────────────────────────
//
// No manual project/asset IDs required.
// One click creates: media_projects + media_scenes + media_assets (pipeline) +
// media_library_assets (Media Cloud library row) — all in one backend transaction.
// The library row exists immediately (status: Generating) and is updated to Active
// when the pipeline worker completes — no disappearing one-time links.

interface QuickJobState {
  libraryAssetId: string;
  aiVideoJobId:   string;
  projectId:      string;
  provider:       string;
}

type PollStatus = 'queued' | 'pending' | 'processing' | 'polling' | 'complete' | 'failed';

function VideoTab({ token }: { token: string }) {
  const [prompt,       setPrompt]      = useState('');
  const [provider,     setProvider]    = useState('minimax');
  const [aspectRatio,  setAspectRatio] = useState('16:9');
  const [durationSec,  setDurationSec] = useState(5);
  const [loading,      setLoading]     = useState(false);
  const [job,          setJob]         = useState<QuickJobState | null>(null);
  const [pollStatus,   setPollStatus]  = useState<PollStatus | null>(null);
  const [pollProgress, setPollProgress]= useState(0);
  const [outputUrl,    setOutputUrl]   = useState<string | null>(null);
  const [error,        setError]       = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPolling(), []);

  const startPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const data = await quickVideoAPI.sync(jobId);
        setPollStatus(data.status as PollStatus);
        setPollProgress(data.progress || 0);
        if (data.output_url) setOutputUrl(data.output_url);
        if (data.status === 'complete' || data.status === 'failed') stopPolling();
      } catch { /* network hiccup — keep polling */ }
    }, 15_000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true); setError(null); setJob(null);
    setPollStatus(null); setPollProgress(0); setOutputUrl(null);
    stopPolling();
    try {
      const data = await quickVideoAPI.generate({
        prompt:       prompt.trim(),
        provider,
        aspect_ratio: aspectRatio,
        duration_sec: durationSec,
      });
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setJob({ libraryAssetId: data.libraryAssetId, aiVideoJobId: data.aiVideoJobId, projectId: data.projectId, provider: data.provider });
      setPollStatus('queued');
      startPolling(data.aiVideoJobId);
    } catch (err: any) { setError(err?.message || 'Video generation failed'); }
    finally { setLoading(false); }
  };

  const isReady     = !loading && !!prompt.trim();
  const isGenerating = !!job && pollStatus !== 'complete' && pollStatus !== 'failed';
  const isDone       = pollStatus === 'complete';
  const isFailed     = pollStatus === 'failed';

  const STAGE_LABEL: Record<string, string> = {
    queued:     'Queued — waiting for worker…',
    pending:    'Pending — preparing generation…',
    processing: 'Processing — generating your video…',
    polling:    'Polling AI provider for results…',
    complete:   'Complete ✓',
    failed:     'Failed',
  };

  return (
    <>
    <form onSubmit={handleSubmit}>
      {/* Guarantee banner */}
      <div style={{ ...s.infoBox, background: 'rgba(0,200,150,0.06)', borderColor: 'rgba(0,200,150,0.25)', color: 'rgba(0,200,150,0.9)', marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>🎬 Quick Generate — no IDs needed</div>
        <div style={{ fontSize: 12, color: 'rgba(232,238,255,0.55)', lineHeight: 1.6 }}>
          Describe your video and click Generate. AutoFlowNG automatically creates all the
          required pipeline records <em>and</em> a permanent entry in your{' '}
          <a href="/media-cloud" style={{ color: '#00C896' }}>Media Cloud Library</a> — it appears
          immediately (status: <em>Generating</em>) and updates to <em>Active</em> with the real
          video URL once rendering is complete. Assets are never one-time links and never disappear.
        </div>
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Video Prompt</label>
        <textarea
          style={{ ...s.textarea, minHeight: 110 }}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the video vividly — e.g. 'A cinematic sunrise over Lagos harbour, golden light reflecting on the water, aerial drone shot, 4K quality, slow motion'"
          disabled={isGenerating}
          required
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={s.label}>Provider</label>
          <select style={s.select} value={provider} onChange={e => setProvider(e.target.value)} disabled={isGenerating}>
            <option value="minimax">MiniMax</option>
            <option value="runway">Runway</option>
            <option value="kling">Kling</option>
            <option value="luma">Luma</option>
          </select>
        </div>
        <div>
          <label style={s.label}>Aspect Ratio</label>
          <select style={s.select} value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} disabled={isGenerating}>
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Portrait)</option>
            <option value="1:1">1:1 (Square)</option>
          </select>
        </div>
        <div>
          <label style={s.label}>Duration</label>
          <select style={s.select} value={durationSec} onChange={e => setDurationSec(parseInt(e.target.value))} disabled={isGenerating}>
            {[3, 5, 8, 10].map(d => <option key={d} value={d}>{d} seconds</option>)}
          </select>
        </div>
      </div>

      {loading && <div style={s.loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>Creating your Media Cloud asset and queuing generation…</div>}

      {!loading && !isGenerating && (
        <button type="submit" style={isReady ? s.submitBtn : s.disabledBtn} disabled={!isReady}>
          ⚡ Quick Generate
        </button>
      )}

      {error && <div style={s.errorBox}>{error}</div>}

      {/* ── In-progress card ── */}
      {job && !isDone && !isFailed && (
        <div style={{ marginTop: 18, padding: '18px 20px', background: 'rgba(0,200,150,0.05)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#00C896', fontFamily: "'Syne',sans-serif" }}>
              🎬 Generating with {job.provider}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Mono',monospace" }}>
              {STAGE_LABEL[pollStatus || 'queued']}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', background: '#00C896', borderRadius: 4, width: `${Math.max(pollProgress, 5)}%`, transition: 'width 0.5s ease' }} />
          </div>

          {/* Library visibility confirmation */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif", marginBottom: 2 }}>
                Already visible in Media Cloud Library
              </div>
              <div style={{ fontSize: 11, color: 'rgba(232,238,255,0.45)', fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }}>
                Your asset was saved to the library the moment you clicked Generate (status: <em>Generating</em>).
                It will automatically update to <em>Active</em> with the video URL when rendering finishes.
                It will not disappear.
              </div>
              <a href="/media-cloud" style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#00C896', textDecoration: 'none', fontFamily: "'DM Mono',monospace" }}>
                Open Media Cloud Library →
              </a>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(232,238,255,0.25)', fontFamily: "'DM Mono',monospace" }}>
            Library Asset ID: {job.libraryAssetId} · Pipeline Job: {job.aiVideoJobId}
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(232,238,255,0.2)', fontFamily: "'DM Mono',monospace" }}>
            Checking for updates every 15 seconds…
          </div>
        </div>
      )}

      {/* ── Success card ── */}
      {isDone && (
        <div style={{ marginTop: 18, padding: '18px 20px', background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#00C896', fontFamily: "'Syne',sans-serif", marginBottom: 10 }}>
            ✓ Video ready!
          </div>
          {outputUrl && (
            <video
              src={outputUrl}
              controls
              style={{ width: '100%', borderRadius: 10, marginBottom: 12, maxHeight: 320, background: '#000' }}
            />
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/media-cloud" style={{ ...s.submitBtn as any, textDecoration: 'none', display: 'inline-block', textAlign: 'center', width: 'auto', padding: '10px 20px' }}>
              View in Media Cloud Library
            </a>
            {outputUrl && (
              <a href={outputUrl} download style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(0,200,150,0.3)', color: '#00C896', fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: "'DM Sans',sans-serif" }}>
                ⬇️ Download
              </a>
            )}
            <button type="button" onClick={() => { setJob(null); setPollStatus(null); setOutputUrl(null); setError(null); }} style={{ ...s.disabledBtn as any, width: 'auto', padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(232,238,255,0.5)', cursor: 'pointer' }}>
              Generate another
            </button>
          </div>
        </div>
      )}

      {/* ── Failed card ── */}
      {isFailed && (
        <div style={{ ...s.errorBox, marginTop: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Generation failed</div>
          <div style={{ fontSize: 12, marginBottom: 10 }}>The video generation job encountered an error. The library entry has been marked as archived. You can try again with a different prompt or provider.</div>
          <button type="button" onClick={() => { setJob(null); setPollStatus(null); setError(null); }} style={{ fontSize: 12, color: '#FB7185', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontFamily: "'DM Mono',monospace" }}>
            ↩ Try again
          </button>
        </div>
      )}
    </form>

    {/* ── Recent Quick Generates panel ── */}
    <RecentQuickGeneratesPanel
      onResumeTracking={(jobId, libraryAssetId) => {
        // Re-attach polling loop for an in-progress job the user navigated away from
        setJob(prev => prev ?? { libraryAssetId, aiVideoJobId: jobId, projectId: '', provider: '' });
        setPollStatus('queued');
        startPolling(jobId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    />
    </>
  );
}

// ── Task 5: Style Conversion Tab (Anime / Cartoon / Comics / Cinematic) ────────

function StyleTab({ token }: { token: string }) {
  const [selectedAsset, setSelectedAsset] = useState<{ projectId: string; assetId: string; name: string; publicUrl?: string } | null>(null);
  const [styleTarget, setStyleTarget] = useState('anime');
  const handleVideoUpload = useCallback((asset: UploadedAsset) => {
    // After upload, auto-select the asset for the pipeline
    if (asset.projectId && asset.assetId) {
      setSelectedAsset({ projectId: asset.projectId, assetId: asset.assetId, name: asset.name, publicUrl: asset.publicUrl });
    }
    // Even without pipeline IDs, user can still browse via MediaAssetPicker
  }, []);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<any>(null);
  const [error,       setError]       = useState<string | null>(null);
  const projectId = selectedAsset?.projectId || '';
  const assetId   = selectedAsset?.assetId   || '';

  const STYLES = [
    { value: 'anime',     label: '🌸 Anime'               },
    { value: 'cartoon',   label: '🎭 Cartoon'             },
    { value: 'comic',     label: '💥 Comics / Comic Book' },
    { value: 'cinematic', label: '🎬 Cinematic Illustration'},
    { value: 'storybook', label: '📖 Storybook'           },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId.trim() || !assetId.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await videoStyleAPI.apply(projectId.trim(), assetId.trim(), {
        style_target: styleTarget,
        provider:     'replicate',
      });
      setResult(data);
    } catch (err: any) { setError(err?.message || 'Style conversion failed'); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={s.infoBox}>
        ✨ <strong>Style Conversion</strong> transforms an existing <em>video</em> asset into Anime, Cartoon, Comics, or Cinematic style using AI. The source asset must be a completed video in your <a href="/media-cloud" style={{ color: '#38BDF8' }}>Media Cloud</a>.
      </div>

      <DragDropUpload
        accept="video/*"
        label="Upload Video File"
        onUploaded={handleVideoUpload}
      />

      <MediaAssetPicker
        assetType="video"
        label="Or Choose from Media Cloud"
        selected={selectedAsset}
        onSelect={setSelectedAsset}
      />

      <div style={s.fieldGroup}>
        <label style={s.label}>Target Style</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {STYLES.map(st => (
            <button
              type="button"
              key={st.value}
              onClick={() => setStyleTarget(st.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: styleTarget === st.value ? '1px solid #00C896' : '1px solid rgba(255,255,255,0.1)',
                background: styleTarget === st.value ? 'rgba(0,200,150,0.1)' : 'rgba(255,255,255,0.03)',
                color: styleTarget === st.value ? '#00C896' : 'rgba(232,238,255,0.55)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left' as const,
                transition: 'all 0.15s',
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div style={s.loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>Queuing style conversion…</div>
        : <button type="submit" style={projectId && assetId ? s.submitBtn : s.disabledBtn} disabled={!projectId || !assetId}>Apply Style</button>
      }

      {error && <div style={s.errorBox}>{error}</div>}
      {result?.success && (
        <div style={s.successBox}>
          ✓ Style conversion queued! The styled video will appear in your <a href="/media-cloud" style={{ color: '#00C896' }}>Media Cloud</a> library once complete.
        </div>
      )}
    </form>
  );
}

// ── Task 5: Image Animation Tab ───────────────────────────────────────────────

function AnimationTab({ token }: { token: string }) {
  const [selectedAsset, setSelectedAsset] = useState<{ projectId: string; assetId: string; name: string; publicUrl?: string } | null>(null);
  const [style,     setStyle]     = useState('ken_burns');
  const handleImageUpload = useCallback((asset: UploadedAsset) => {
    if (asset.projectId && asset.assetId) {
      setSelectedAsset({ projectId: asset.projectId, assetId: asset.assetId, name: asset.name, publicUrl: asset.publicUrl });
    }
  }, []);
  const [provider,  setProvider]  = useState('local');
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<any>(null);
  const [error,     setError]     = useState<string | null>(null);
  const projectId = selectedAsset?.projectId || '';
  const assetId   = selectedAsset?.assetId   || '';

  const ANIMATION_STYLES = [
    { value: 'ken_burns',     label: '📷 Ken Burns (pan & zoom)' },
    { value: 'zoom_in',       label: '🔍 Zoom In'               },
    { value: 'zoom_out',      label: '🔎 Zoom Out'              },
    { value: 'pan_left',      label: '⬅️ Pan Left'              },
    { value: 'pan_right',     label: '➡️ Pan Right'             },
    { value: 'parallax',      label: '🌊 Parallax'              },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId.trim() || !assetId.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await animationAPI.animate(projectId.trim(), assetId.trim(), { style, provider });
      setResult(data);
    } catch (err: any) { setError(err?.message || 'Animation failed'); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={s.infoBox}>
        🌀 <strong>Image Animation</strong> turns a static image asset into a short animated video clip. The source must be a completed <em>image</em> asset in your <a href="/media-cloud" style={{ color: '#38BDF8' }}>Media Cloud</a>.
      </div>

      <DragDropUpload
        accept="image/*"
        label="Upload Image File"
        onUploaded={handleImageUpload}
      />

      <MediaAssetPicker
        assetType="image"
        label="Or Choose from Media Cloud"
        selected={selectedAsset}
        onSelect={setSelectedAsset}
      />

      <div style={s.fieldGroup}>
        <label style={s.label}>Animation Style</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
          {ANIMATION_STYLES.map(st => (
            <button
              type="button"
              key={st.value}
              onClick={() => setStyle(st.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: style === st.value ? '1px solid #00C896' : '1px solid rgba(255,255,255,0.1)',
                background: style === st.value ? 'rgba(0,200,150,0.1)' : 'rgba(255,255,255,0.03)',
                color: style === st.value ? '#00C896' : 'rgba(232,238,255,0.55)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left' as const,
                transition: 'all 0.15s',
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Provider</label>
        <select style={s.select} value={provider} onChange={e => setProvider(e.target.value)}>
          <option value="local">Local (FFmpeg)</option>
          <option value="replicate">Replicate AI</option>
        </select>
      </div>

      {loading
        ? <div style={s.loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>🌀</div>Queuing animation job…</div>
        : <button type="submit" style={projectId && assetId ? s.submitBtn : s.disabledBtn} disabled={!projectId || !assetId}>Animate Image</button>
      }

      {error && <div style={s.errorBox}>{error}</div>}
      {result?.success && (
        <div style={s.successBox}>
          ✓ Animation job queued! The animated clip will appear in your <a href="/media-cloud" style={{ color: '#00C896' }}>Media Cloud</a> once ready.
        </div>
      )}
    </form>
  );
}

// ── Task 6: Image Edit Tab ────────────────────────────────────────────────────

function ImageEditTab({ token }: { token: string }) {
  const [imageUrl,      setImageUrl]      = useState('');
  const [inputMode,     setInputMode]     = useState<'upload' | 'url'>('upload');
  const [prompt,        setPrompt]        = useState('');
  const handleImageUpload = useCallback((asset: UploadedAsset) => {
    if (asset.publicUrl) setImageUrl(asset.publicUrl);
  }, []);
  const [negativePrompt,setNegativePrompt]= useState('');
  const [strength,      setStrength]      = useState(0.75);
  const [loading,       setLoading]       = useState(false);
  const [result,        setResult]        = useState<{ outputUrl: string; provider: string; model: string } | null>(null);
  const [error,         setError]         = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim() || !prompt.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await aiAPI.imageEdit({ imageUrl: imageUrl.trim(), prompt, negativePrompt, strength });
      if (data.outputUrl) {
        setResult({ outputUrl: data.outputUrl, provider: data.provider || 'replicate', model: data.model || 'stable-diffusion' });
      } else {
        throw new Error(data.error || 'No output returned');
      }
    } catch (err: any) { setError(err?.message || 'Image editing failed'); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={s.infoBox}>
        🖼️ <strong>Image Edit</strong> uses Replicate's AI models to apply guided edits to any image. Paste a public image URL and describe what you want to change. Requires <code style={{ fontFamily: "'DM Mono',monospace" }}>REPLICATE_API_TOKEN</code> to be configured.
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Source Image</label>
        {/* Toggle between drag-drop upload and URL paste */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['upload', 'url'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setInputMode(mode)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: inputMode === mode ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                color: inputMode === mode ? '#38BDF8' : 'rgba(232,238,255,0.4)',
                fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace",
                transition: 'all 0.15s',
              }}
            >
              {mode === 'upload' ? '📁 Upload File' : '🔗 Paste URL'}
            </button>
          ))}
        </div>

        {inputMode === 'upload' ? (
          <DragDropUpload
            accept="image/*"
            label=""
            onUploaded={handleImageUpload}
          />
        ) : (
          <input
            style={s.input}
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://example.com/your-image.jpg  (must be publicly accessible)"
          />
        )}

        {imageUrl.trim() && (
          <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 200 }}>
            <img src={imageUrl} alt="Preview" style={{ width: '100%', objectFit: 'cover', maxHeight: 200, display: 'block' }} onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
          </div>
        )}
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Edit Instruction</label>
        <textarea
          style={{ ...s.textarea, minHeight: 80 }}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          maxLength={400}
          placeholder="Describe the edit — e.g. 'Make the sky look like a sunset', 'Change the background to a forest', 'Make it look like a watercolour painting'"
          required
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Negative Prompt (optional)</label>
        <input
          style={s.input}
          value={negativePrompt}
          onChange={e => setNegativePrompt(e.target.value)}
          placeholder="Things to avoid — e.g. 'blurry, low quality, text, watermark'"
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Edit Strength: {Math.round(strength * 100)}%</label>
        <input
          type="range"
          min={0.2}
          max={1.0}
          step={0.05}
          value={strength}
          onChange={e => setStrength(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#00C896' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(232,238,255,0.3)', fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
          <span>Subtle (20%)</span>
          <span>Balanced (75%)</span>
          <span>Maximum (100%)</span>
        </div>
      </div>

      {loading
        ? <div style={s.loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>AI is editing your image… this may take up to 2 minutes.</div>
        : <button type="submit" style={imageUrl && prompt ? s.submitBtn : s.disabledBtn} disabled={!imageUrl || !prompt}>Edit Image</button>
      }

      {error && <div style={s.errorBox}>{error}</div>}

      {result && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ ...s.label, marginBottom: 8 }}>Original</div>
              <img src={imageUrl} alt="Original" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 240 }} />
            </div>
            <div>
              <div style={{ ...s.label, marginBottom: 8 }}>Edited</div>
              <img src={result.outputUrl} alt="Edited" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 240 }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Mono',monospace" }}>via {result.provider} · {result.model}</span>
            <a href={result.outputUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#00C896', textDecoration: 'none', fontFamily: "'DM Sans',sans-serif" }}>⬇️ Download</a>
          </div>
        </div>
      )}
    </form>
  );
}

// ── Task: Image Generate Tab (text-to-image, no source image required) ───────

function ImageGenerateTab({ token }: { token: string }) {
  const [prompt,         setPrompt]         = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio,    setAspectRatio]    = useState<'square' | 'portrait' | 'landscape' | 'widescreen'>('square');
  const [loading,        setLoading]        = useState(false);
  const [result,         setResult]         = useState<{ outputUrl: string; provider: string; model: string } | null>(null);
  const [error,          setError]          = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await aiAPI.imageGenerate({ prompt: prompt.trim(), negativePrompt, aspectRatio });
      if (data.outputUrl) {
        setResult({ outputUrl: data.outputUrl, provider: data.provider || 'replicate', model: data.model || 'stable-diffusion' });
      } else {
        throw new Error(data.error || 'No output returned');
      }
    } catch (err: any) { setError(err?.message || 'Image generation failed'); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={s.infoBox}>
        ✏️ <strong>Generate</strong> creates a brand-new image purely from a text description — no source image needed. Just describe what you want to see.
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Prompt</label>
        <textarea
          style={{ ...s.textarea, minHeight: 80 }}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          maxLength={500}
          placeholder="Describe the image you want — e.g. 'A cozy coffee shop interior at sunset, warm lighting, photorealistic'"
          required
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Negative Prompt (optional)</label>
        <input
          style={s.input}
          value={negativePrompt}
          onChange={e => setNegativePrompt(e.target.value)}
          placeholder="Things to avoid — e.g. 'blurry, low quality, text, watermark'"
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Aspect Ratio</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {([
            { id: 'square',     label: 'Square (1:1)' },
            { id: 'portrait',   label: 'Portrait (3:4)' },
            { id: 'landscape',  label: 'Landscape (4:3)' },
            { id: 'widescreen', label: 'Widescreen (16:9)' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAspectRatio(opt.id)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: aspectRatio === opt.id ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.04)',
                color: aspectRatio === opt.id ? '#00C896' : 'rgba(232,238,255,0.4)',
                fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace",
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div style={s.loadingBox}><div style={{ fontSize: 28, marginBottom: 8 }}>✏️</div>AI is generating your image… this may take up to 2 minutes.</div>
        : <button type="submit" style={prompt.trim() ? s.submitBtn : s.disabledBtn} disabled={!prompt.trim()}>Generate Image</button>
      }

      {error && <div style={s.errorBox}>{error}</div>}

      {result && (
        <div style={{ marginTop: 20 }}>
          <img src={result.outputUrl} alt="Generated" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 360, marginBottom: 12 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Mono',monospace" }}>via {result.provider} · {result.model}</span>
            <a href={result.outputUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#00C896', textDecoration: 'none', fontFamily: "'DM Sans',sans-serif" }}>⬇️ Download</a>
          </div>
        </div>
      )}
    </form>
  );
}

function SEOResultExpanded({ data }: { data: any }) {
  const platforms = ['youtube', 'tiktok', 'instagram'].filter(p => data?.[p]);
  if (platforms.length === 0) return <div style={{ ...s.errorBox, marginTop: 16 }}>No metadata returned.</div>;
  return (
    <div style={{ marginTop: 20 }}>
      {platforms.map(platform => <PlatformSection key={platform} platform={platform} data={data[platform]} />)}
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
    navigator.clipboard.writeText(parts.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif" }}>{platformEmoji} {platformLabel}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); copyAll(); }} style={{ fontSize: 10, fontWeight: 700, color: copied ? '#00C896' : 'rgba(232,238,255,0.5)', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>
            {copied ? '✓ Copied' : 'Copy all'}
          </button>
          <span style={{ color: 'rgba(232,238,255,0.3)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {data.title       && <div style={{ marginBottom: 10 }}><div style={s.label}>Title</div><div style={{ fontSize: 13, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif" }}>{data.title}</div></div>}
          {data.description && <div style={{ marginBottom: 10 }}><div style={s.label}>Description</div><div style={{ fontSize: 12, color: 'rgba(232,238,255,0.6)', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>{data.description}</div></div>}
          {data.caption     && <div style={{ marginBottom: 10 }}><div style={s.label}>Caption</div><div style={{ fontSize: 13, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif" }}>{data.caption}</div></div>}
          {data.tags?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={s.label}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {data.tags.slice(0, 15).map((tag: string) => <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,200,150,0.1)', color: '#00C896', fontFamily: "'DM Mono',monospace" }}>{tag}</span>)}
              </div>
            </div>
          )}
          {data.hashtags?.length > 0 && (
            <div>
              <div style={s.label}>Hashtags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {data.hashtags.map((h: string) => <span key={h} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', fontFamily: "'DM Mono',monospace" }}>{h}</span>)}
              </div>
            </div>
          )}
          {data.chapters?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={s.label}>Chapters</div>
              {data.chapters.map((ch: any, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'rgba(232,238,255,0.6)', fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>{ch.timestamp} — {ch.label}</div>
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
    return <div style={{ color: 'rgba(232,238,255,0.3)', fontSize: 13, fontFamily: "'DM Sans',sans-serif", textAlign: 'center', padding: '24px 0' }}>No jobs yet. Generate your first thumbnail or SEO metadata above.</div>;
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={onRefresh} style={{ fontSize: 11, color: 'rgba(232,238,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>↻ Refresh</button>
      </div>
      {jobs.map(job => <JobRow key={job.id} job={job} />)}
    </div>
  );
}

function JobRow({ job }: { job: AgentJob }) {
  const [showSEO, setShowSEO] = useState(false);
  const statusDot: Record<string, string> = {
    completed: '#00C896', failed: '#FB7185', running: '#FBBF24', pending: '#94A3B8',
  };
  const dot = statusDot[job.status] || '#94A3B8';
  const isThumbnail = job.agent_type === 'thumbnail';
  const isSEO = job.agent_type === 'seo';
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#E8EEFF', fontFamily: "'DM Sans',sans-serif", flex: 1 }}>
          {isThumbnail ? '🎨 Thumbnail' : '📝 SEO'} · {job.input_data?.title || 'Untitled'}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(232,238,255,0.3)', fontFamily: "'DM Mono',monospace" }}>{job.status}</span>
      </div>
      {job.status === 'completed' && isThumbnail && job.output_data?.image_url && (
        <div style={{ marginTop: 8 }}>
          <img src={job.output_data.image_url} alt="" style={{ width: '100%', borderRadius: 6, maxHeight: 140, objectFit: 'cover' }} />
        </div>
      )}
      {job.status === 'completed' && isSEO && job.output_data && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowSEO(!showSEO)} style={{ fontSize: 11, color: '#00C896', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace", padding: 0 }}>
            {showSEO ? '▲ Hide' : '▼ Show metadata'}
          </button>
          {showSEO && <SEOResultExpanded data={job.output_data} />}
        </div>
      )}
      {job.error_message && <div style={{ marginTop: 6, fontSize: 11, color: '#FB7185', fontFamily: "'DM Mono',monospace" }}>{job.error_message}</div>}
    </div>
  );
}
