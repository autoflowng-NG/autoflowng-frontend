/**
 * AnnouncementManager — Phase 3B (Admin / Super Admin)
 * Create, edit, activate, archive platform announcements.
 */

import { useEffect, useState } from "react";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "autoflowng_token";

const TYPES      = ["informational","update","release","maintenance","outage","security"];
const PRIORITIES = ["low","normal","high","urgent"];
const STATUSES   = ["draft","scheduled","active","archived"];

interface Ann {
  id: number; title: string; body: string;
  type: string; priority: string; status: string;
  scheduled_for?: string|null; expires_at?: string|null;
  send_email?: boolean; action_url?: string|null;
  created_at: string; dismissals?: number;
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
  btn:   (color = "#00C896") => ({ background: color, color: "#04060F", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }),
  btnGhost: { background: "rgba(255,255,255,0.04)", color: "#E8EEFF", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" },
};

export default function AnnouncementManager() {
  const [items, setItems] = useState<Ann[]>([]);
  const [form, setForm] = useState<any>({
    title: "", body: "", type: "informational", priority: "normal",
    scheduled_for: "", expires_at: "", send_email: false, action_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    const r = await authFetch("/announcements/admin");
    if (r.ok) { const d = await r.json(); setItems(d.announcements || []); }
  }
  useEffect(() => { load(); }, []);

  async function save(activate_now = false) {
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.body.trim())  { setError("Body is required."); return; }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: any = { ...form, activate_now };
      ["scheduled_for","expires_at","action_url"].forEach(k => { if (!payload[k]) payload[k] = null; });
      const path = editingId ? `/announcements/admin/${editingId}` : "/announcements/admin";
      const method = editingId ? "PATCH" : "POST";
      const r = await authFetch(path, { method, body: JSON.stringify(payload) });
      if (r.ok) {
        setForm({ title:"", body:"", type:"informational", priority:"normal", scheduled_for:"", expires_at:"", send_email:false, action_url:"" });
        setEditingId(null);
        setSuccess(activate_now ? "Announcement created and activated!" : "Announcement saved as draft.");
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d?.error || `Server error (${r.status})`);
      }
    } catch (e: any) {
      setError(e?.message || "Network error — check your connection.");
    } finally { setSaving(false); }
  }

  async function patchStatus(id: number, status: string) {
    await authFetch(`/announcements/admin/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  function editItem(a: Ann) {
    setEditingId(a.id);
    setForm({
      title: a.title, body: a.body, type: a.type, priority: a.priority,
      scheduled_for: a.scheduled_for?.slice(0,16) || "",
      expires_at:    a.expires_at?.slice(0,16) || "",
      send_email:    !!a.send_email,
      action_url:    a.action_url || "",
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* Form */}
      <div>
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "1.05rem", marginBottom: 14, color: "#E8EEFF" }}>
          {editingId ? `Edit #${editingId}` : "New Announcement"}
        </h3>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={S.label as any}>Title</label>
            <input style={S.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label style={S.label as any}>Body</label>
            <textarea style={{ ...S.input, minHeight: 90, resize: "vertical" }} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={S.label as any}>Type</label>
              <select style={S.input as any} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label as any}>Priority</label>
              <select style={S.input as any} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={S.label as any}>Schedule for</label>
              <input type="datetime-local" style={S.input} value={form.scheduled_for} onChange={e => setForm({ ...form, scheduled_for: e.target.value })} />
            </div>
            <div>
              <label style={S.label as any}>Expires at</label>
              <input type="datetime-local" style={S.input} value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={S.label as any}>Action URL (optional)</label>
            <input style={S.input} value={form.action_url} onChange={e => setForm({ ...form, action_url: e.target.value })} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(232,238,255,0.7)" }}>
            <input type="checkbox" checked={form.send_email} onChange={e => setForm({ ...form, send_email: e.target.checked })} />
            Also email opted-in users
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={saving} onClick={() => save(false)} style={S.btn("#38BDF8")}>
              {editingId ? "Save Changes" : "Save Draft"}
            </button>
            <button disabled={saving} onClick={() => save(true)} style={S.btn("#00C896")}>
              {editingId ? "Save & Activate" : "Create & Activate"}
            </button>
            {editingId && (
              <button onClick={() => { setEditingId(null); setForm({ title:"", body:"", type:"informational", priority:"normal", scheduled_for:"", expires_at:"", send_email:false, action_url:"" }); }} style={S.btnGhost as any}>
                Cancel
              </button>
            )}
          </div>
          {error   && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.25)", color: "#FB7185", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>{error}</div>}
          {success && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", color: "#00C896", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>{success}</div>}
        </div>
      </div>

      {/* List */}
      <div>
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "1.05rem", marginBottom: 14, color: "#E8EEFF" }}>
          All Announcements ({items.length})
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 560, overflowY: "auto" }}>
          {items.length === 0 && <div style={{ color: "rgba(232,238,255,0.3)", fontSize: 13, textAlign: "center", padding: 24 }}>No announcements yet.</div>}
          {items.map(a => (
            <div key={a.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#E8EEFF" }}>{a.title}</div>
                <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 100, fontFamily: "'DM Mono',monospace", textTransform: "uppercase",
                  color: a.status === 'active' ? "#00C896" : a.status === 'scheduled' ? "#38BDF8" : a.status === 'archived' ? "rgba(232,238,255,0.4)" : "#F59E0B",
                  background: "rgba(255,255,255,0.04)" }}>
                  {a.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(232,238,255,0.55)", marginBottom: 8 }}>{a.body.slice(0, 160)}{a.body.length > 160 ? "…" : ""}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10, color: "rgba(232,238,255,0.4)", marginBottom: 8, fontFamily: "'DM Mono',monospace" }}>
                <span>{a.type}</span>·<span>{a.priority}</span>{a.dismissals != null && <>·<span>{a.dismissals} dismissed</span></>}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => editItem(a)} style={S.btnGhost as any}>Edit</button>
                {a.status !== 'active'   && <button onClick={() => patchStatus(a.id, 'active')}   style={S.btnGhost as any}>Activate</button>}
                {a.status !== 'archived' && <button onClick={() => patchStatus(a.id, 'archived')} style={S.btnGhost as any}>Archive</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
