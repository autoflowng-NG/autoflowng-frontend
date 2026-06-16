/**
 * SupportRequestForm — Phase 3B
 * User-facing support / feedback submission form + ticket history.
 */

import { useEffect, useState } from "react";
import { LifeBuoy, Send } from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "autoflowng_token";

const CATEGORIES  = ["bug","feature","billing","general","security","performance"];
const PRIORITIES  = ["low","medium","high","critical"];

interface SupportRequest {
  id: number; subject: string; message: string; category: string; priority: string;
  status: string; created_at: string; screenshot_url?: string|null;
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

export default function SupportRequestForm() {
  const [form, setForm] = useState({ category: "general", priority: "medium", subject: "", message: "", screenshot_url: "" });
  const [history, setHistory] = useState<SupportRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    const r = await authFetch("/support/requests");
    if (r.ok) { const d = await r.json(); setHistory(d.requests || []); }
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!form.subject.trim() || !form.message.trim()) return;
    setSubmitting(true); setOk(null);
    try {
      const r = await authFetch("/support/requests", { method: "POST", body: JSON.stringify(form) });
      if (r.ok) {
        setOk("Submitted — we'll reach out shortly.");
        setForm({ category: "general", priority: "medium", subject: "", message: "", screenshot_url: "" });
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        setOk(`Error: ${d.error || "Failed to submit"}`);
      }
    } finally { setSubmitting(false); }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <LifeBuoy size={18} color="#38BDF8" />
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "1.05rem", margin: 0, color: "#E8EEFF" }}>Help & Feedback</h3>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={S.label as any}>Category</label>
              <select style={S.input as any} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label as any}>Priority</label>
              <select style={S.input as any} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={S.label as any}>Subject</label>
            <input style={S.input} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label style={S.label as any}>Message</label>
            <textarea style={{ ...S.input, minHeight: 130, resize: "vertical" }} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
          </div>
          <div>
            <label style={S.label as any}>Screenshot URL (optional)</label>
            <input style={S.input} placeholder="https://…" value={form.screenshot_url} onChange={e => setForm({ ...form, screenshot_url: e.target.value })} />
          </div>
          <div>
            <button onClick={submit} disabled={submitting} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#00C896", color: "#04060F", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", opacity: submitting ? 0.5 : 1 }}>
              <Send size={13} /> {submitting ? "Sending…" : "Submit"}
            </button>
            {ok && <div style={{ marginTop: 10, fontSize: 12, color: ok.startsWith("Error") ? "#FB7185" : "#00C896" }}>{ok}</div>}
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "1.05rem", marginBottom: 14, color: "#E8EEFF" }}>Your Tickets ({history.length})</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
          {history.length === 0 && <div style={{ color: "rgba(232,238,255,0.3)", fontSize: 13, textAlign: "center", padding: 24 }}>No tickets yet.</div>}
          {history.map(t => (
            <div key={t.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#E8EEFF" }}>{t.subject}</span>
                <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 100, color: t.status === 'resolved' || t.status === 'closed' ? "#00C896" : t.status === 'in_progress' ? "#38BDF8" : "#F59E0B", background: "rgba(255,255,255,0.04)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>
                  {t.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace" }}>
                {t.category} · {t.priority} · {new Date(t.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
