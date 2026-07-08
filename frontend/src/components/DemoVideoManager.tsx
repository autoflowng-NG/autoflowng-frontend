/**
 * DemoVideoManager — Super Admin
 *
 * Manages the multi-video landing-page demo gallery: register hosted video
 * URLs (and thumbnail/description/category/order), publish/unpublish, edit,
 * and delete entries. Backed by `demo_videos` (routes/adminDemoVideo.js).
 *
 * Tip in the UI: upload the underlying video file via Media Cloud first,
 * then paste its public URL here.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminAPI } from "../lib/api";
import { invalidate, queryKeys } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Trash2, Upload, Pencil, X } from "lucide-react";

interface Video {
  id: number; video_url: string; thumbnail_url?: string | null;
  title?: string | null; description?: string | null; category?: string | null;
  sort_order?: number; is_published: boolean; uploaded_at: string;
  uploaded_by_email?: string | null;
}

const CATEGORIES = ["getting_started", "affiliate_marketing", "workflows", "integrations", "advanced"];

const S = {
  input: { width: "100%", boxSizing: "border-box" as const, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 12px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" },
  label: { fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.6)", marginBottom: 6, display: "block", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em" },
};

const EMPTY_FORM = { video_url: "", thumbnail_url: "", title: "", description: "", category: "getting_started", sort_order: 0, publish: true };

export default function DemoVideoManager() {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminDemoVideos,
    queryFn: () => adminAPI.demoVideos.list(),
  });
  const videos: Video[] = ((data as any)?.videos || []).slice().sort((a: Video, b: Video) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const saveMut = useMutation({
    mutationFn: () =>
      editingId
        ? adminAPI.demoVideos.update(editingId, form)
        : adminAPI.demoVideos.upload(form),
    onSuccess: () => {
      toast({ title: editingId ? "Video updated" : "Video registered" });
      setForm(EMPTY_FORM);
      setEditingId(null);
      invalidate.adminDemoVideos();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const publishMut = useMutation({
    mutationFn: ({ id, publish }: { id: number; publish: boolean }) => adminAPI.demoVideos.publish(id, publish),
    onSuccess: () => invalidate.adminDemoVideos(),
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => adminAPI.demoVideos.remove(id),
    onSuccess: () => { toast({ title: "Video deleted" }); invalidate.adminDemoVideos(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const startEdit = (v: Video) => {
    setEditingId(v.id);
    setForm({
      video_url: v.video_url, thumbnail_url: v.thumbnail_url || "",
      title: v.title || "", description: v.description || "",
      category: v.category || "getting_started", sort_order: v.sort_order ?? 0,
      publish: v.is_published,
    });
  };

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_FORM); };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "rgba(232,238,255,0.7)", lineHeight: 1.5 }}>
        <strong style={{ color: "#38BDF8" }}>Tip:</strong> Upload the actual video file via Media Cloud first, then paste its public URL below.
        The landing page shows a gallery of every published video, ordered by sort order.
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h4 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "#E8EEFF", margin: 0 }}>
            {editingId ? `Editing Video #${editingId}` : "Register New Video"}
          </h4>
          {editingId && (
            <button onClick={cancelEdit} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 10px", color: "rgba(232,238,255,0.5)", fontSize: 11, cursor: "pointer" }}>
              <X size={11} /> Cancel
            </button>
          )}
        </div>
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
        <div>
          <label style={S.label as any}>Description (optional)</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <div>
            <label style={S.label as any}>Category</label>
            <select style={{ ...S.input, appearance: "auto" as any }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label as any}>Sort order</label>
            <input type="number" style={S.input} value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(232,238,255,0.7)" }}>
          <input type="checkbox" checked={form.publish} onChange={e => setForm({ ...form, publish: e.target.checked })} />
          Published (visible in the landing-page gallery)
        </label>
        <div>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.video_url}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#00C896", color: "#04060F", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", opacity: saveMut.isPending || !form.video_url ? 0.5 : 1 }}
          >
            <Upload size={14} /> {saveMut.isPending ? "Saving…" : editingId ? "Save Changes" : "Register Video"}
          </button>
        </div>
      </div>

      <div>
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "1.05rem", marginBottom: 14, color: "#E8EEFF" }}>
          All Videos ({videos.length})
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {isLoading && <div style={{ color: "rgba(232,238,255,0.3)", fontSize: 13, textAlign: "center", padding: 24 }}>Loading…</div>}
          {!isLoading && videos.length === 0 && <div style={{ color: "rgba(232,238,255,0.3)", fontSize: 13, textAlign: "center", padding: 24 }}>No videos uploaded yet.</div>}
          {videos.map(v => (
            <div key={v.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${v.is_published ? "rgba(0,200,150,0.35)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {v.is_published && <CheckCircle2 size={14} color="#00C896" />}
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#E8EEFF" }}>{v.title || `Video #${v.id}`}</span>
                  {v.is_published && <span style={{ fontSize: 9, fontWeight: 800, color: "#00C896", padding: "2px 8px", borderRadius: 100, background: "rgba(0,200,150,0.12)", fontFamily: "'DM Mono',monospace" }}>LIVE</span>}
                  {v.category && <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.5)", padding: "2px 8px", borderRadius: 100, background: "rgba(255,255,255,0.04)", fontFamily: "'DM Mono',monospace" }}>{v.category.replace(/_/g, " ")}</span>}
                </div>
                {v.description && <div style={{ fontSize: 11, color: "rgba(232,238,255,0.55)", marginTop: 4 }}>{v.description}</div>}
                <div style={{ fontSize: 11, color: "rgba(232,238,255,0.45)", marginTop: 4, wordBreak: "break-all" }}>{v.video_url}</div>
                <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
                  Order {v.sort_order ?? 0} · {new Date(v.uploaded_at).toLocaleString()} · {v.uploaded_by_email || "unknown"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => startEdit(v)} style={{ background: "rgba(255,255,255,0.04)", color: "rgba(232,238,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}><Pencil size={12} /></button>
                <button
                  onClick={() => publishMut.mutate({ id: v.id, publish: !v.is_published })}
                  style={{ background: v.is_published ? "rgba(251,191,36,0.1)" : "rgba(0,200,150,0.12)", color: v.is_published ? "#FBBF24" : "#00C896", border: `1px solid ${v.is_published ? "rgba(251,191,36,0.25)" : "rgba(0,200,150,0.25)"}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  {v.is_published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => removeMut.mutate(v.id)} style={{ background: "rgba(251,113,133,0.08)", color: "#FB7185", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
