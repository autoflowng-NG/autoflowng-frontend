/**
 * TestimonialsModerationPanel — Phase 3B (Admin)
 * Approve / reject pending testimonials.
 */

import { useEffect, useState } from "react";
import { Check, X, Star } from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "autoflowng_token";

interface T {
  id: number; author_name: string; author_title?: string|null; company?: string|null;
  quote: string; rating?: number|null; status: string; created_at: string; user_email?: string|null;
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

export default function TestimonialsModerationPanel() {
  const [pending, setPending] = useState<T[]>([]);
  const [allItems, setAllItems] = useState<T[]>([]);
  const [tab, setTab] = useState<"pending"|"all">("pending");

  async function load() {
    const [p, a] = await Promise.all([
      authFetch("/testimonials/admin/pending").then(r => r.ok ? r.json() : { testimonials: [] }),
      authFetch("/testimonials/admin/all").then(r => r.ok ? r.json() : { testimonials: [] }),
    ]);
    setPending(p.testimonials || []);
    setAllItems(a.testimonials || []);
  }
  useEffect(() => { load(); }, []);

  async function decide(id: number, action: "approve"|"reject") {
    await authFetch(`/testimonials/admin/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
    load();
  }

  const items = tab === "pending" ? pending : allItems;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["pending","all"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? "rgba(251,113,133,0.1)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${tab === t ? "rgba(251,113,133,0.25)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 10, padding: "6px 12px",
            color: tab === t ? "#FB7185" : "rgba(232,238,255,0.5)",
            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", textTransform: "uppercase",
          }}>
            {t} {t === "pending" ? `(${pending.length})` : `(${allItems.length})`}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 640, overflowY: "auto" }}>
        {items.length === 0 && <div style={{ color: "rgba(232,238,255,0.3)", fontSize: 13, textAlign: "center", padding: 24 }}>No testimonials.</div>}
        {items.map(t => (
          <div key={t.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#E8EEFF" }}>
                {t.author_name}
                {t.author_title && <span style={{ color: "rgba(232,238,255,0.5)", fontWeight: 500 }}> · {t.author_title}</span>}
                {t.company && <span style={{ color: "rgba(232,238,255,0.5)", fontWeight: 500 }}> · {t.company}</span>}
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 100, fontFamily: "'DM Mono',monospace", textTransform: "uppercase",
                color: t.status === 'approved' ? "#00C896" : t.status === 'rejected' ? "#FB7185" : "#F59E0B",
                background: "rgba(255,255,255,0.04)" }}>
                {t.status}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(232,238,255,0.75)", lineHeight: 1.5, margin: "6px 0 8px" }}>"{t.quote}"</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 11, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace" }}>
              {t.rating && (
                <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {Array.from({ length: t.rating }, (_, i) => <Star key={i} size={11} fill="#FBBF24" color="#FBBF24" />)}
                </span>
              )}
              <span>{new Date(t.created_at).toLocaleDateString()}</span>
              {t.user_email && <span>· {t.user_email}</span>}
              {t.status === 'pending' && (
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={() => decide(t.id, "approve")} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,200,150,0.12)", color: "#00C896", border: "1px solid rgba(0,200,150,0.25)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    <Check size={12} /> Approve
                  </button>
                  <button onClick={() => decide(t.id, "reject")} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(251,113,133,0.08)", color: "#FB7185", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
