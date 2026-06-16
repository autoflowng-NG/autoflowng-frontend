/**
 * DemoVideoManager — Phase 3B (Super Admin)
 *
 * Lets a Super Admin register a hosted video URL (and thumbnail) for the
 * landing-page demo, publish/unpublish, and delete past versions.
 *
 * Tip in the UI: upload the underlying video file via Media Cloud first,
 * then paste its public URL here. This reuses the existing storage pipeline
 * rather than duplicating multipart upload logic.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Trash2, Upload } from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "autoflowng_token";

interface Video {
  id: number; video_url: string; thumbnail_url?: string|null;
  title?: string|null; is_published: boolean; uploaded_at: string;
  uploaded_by_email?: string|null;
}

function authFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${BASE_URL}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

const S = {
  input: { width: "100%", boxSizing: "border-box" as const, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 12px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" },
  label: { fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.6)", marginBottom: 6, display: "block", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em" },
};

export default function DemoVideoManager() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [form, setForm] = useState({ video_url: "", thumbnail_url: "", title: "", publish: true });
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await authFetch("/admin/demo-video/all");
    if (r.ok) { const d = await r.json(); setVideos(d.videos || []); }
  }
  useEffect(() => { load(); }, []);

  async function upload() {
    if (!form.video_url) return;
    setSaving(true);
    try {
      const r = await authFetch("/admin/demo-video/upload", { method: "POST", body: JSON.stringify(form) });
      if (r.ok) { setForm({ video_url: "", thumbnail_url: "", title: "", publish: true }); load(); }
    } finally { setSaving(false); }
  }

  async function publish(id: number) {
    await authFetch(`/admin/demo-video/${id}/publish`, { method: "PATCH" });
    load();
  }
  async function remove(id: number) {
    if (!confirm("Delete this video record?")) return;
    await authFetch(`/admin/demo-video/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "rgba(232,238,255,0.7)", lineHeight: 1.5 }}>
        <strong style={{ color: "#38BDF8" }}>Tip:</strong> Upload the actual video file via Media Cloud first, then paste its public URL below.
        While no video is published, the landing-page "Watch Demo" button will continue to show "Demo video coming soon".
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={S.label as any}>Video URL</label>
          <input style={S.input} placeholder="https://…/demo.mp4 (or YouTube/Vimeo embed URL)" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <div>
            <label style={S.label as any}>Thumbnail URL (optional)</label>
            <input style={S.input} value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} />
          </div>
          <div>
            <label style={S.label as any}>Title (optional)</label>
            <input style={S.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(232,238,255,0.7)" }}>
          <input type="checkbox" checked={form.publish} onChange={e => setForm({ ...form, publish: e.target.checked })} />
          Publish immediately (replaces the currently-live demo)
        </label>
        <div>
          <button onClick={upload} disabled={saving || !form.video_url} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#00C896", color: "#04060F", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", opacity: saving || !form.video_url ? 0.5 : 1 }}>
            <Upload size={14} /> {saving ? "Saving…" : "Register Video"}
          </button>
        </div>
      </div>

      <div>
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "1.05rem", marginBottom: 14, color: "#E8EEFF" }}>
          All Videos ({videos.length})
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {videos.length === 0 && <div style={{ color: "rgba(232,238,255,0.3)", fontSize: 13, textAlign: "center", padding: 24 }}>No videos uploaded yet.</div>}
          {videos.map(v => (
            <div key={v.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${v.is_published ? "rgba(0,200,150,0.35)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {v.is_published && <CheckCircle2 size={14} color="#00C896" />}
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#E8EEFF" }}>{v.title || `Video #${v.id}`}</span>
                  {v.is_published && <span style={{ fontSize: 9, fontWeight: 800, color: "#00C896", padding: "2px 8px", borderRadius: 100, background: "rgba(0,200,150,0.12)", fontFamily: "'DM Mono',monospace" }}>LIVE</span>}
                </div>
                <div style={{ fontSize: 11, color: "rgba(232,238,255,0.45)", marginTop: 4, wordBreak: "break-all" }}>{v.video_url}</div>
                <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
                  {new Date(v.uploaded_at).toLocaleString()} · {v.uploaded_by_email || "unknown"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!v.is_published && <button onClick={() => publish(v.id)} style={{ background: "rgba(0,200,150,0.12)", color: "#00C896", border: "1px solid rgba(0,200,150,0.25)", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Publish</button>}
                <button onClick={() => remove(v.id)} style={{ background: "rgba(251,113,133,0.08)", color: "#FB7185", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
