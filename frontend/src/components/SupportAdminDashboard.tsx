/**
 * SupportAdminDashboard — Phase 3B
 * Admin / Super Admin view of all support requests with filters and status update.
 */

import { useEffect, useState } from "react";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "autoflowng_token";

const CATEGORIES = ["bug","feature","billing","general","security","performance"];
const PRIORITIES = ["low","medium","high","critical"];
const STATUSES   = ["open","in_progress","resolved","closed"];

interface Req {
  id: number; subject: string; message: string; category: string; priority: string;
  status: string; created_at: string;
  user_email?: string; user_name?: string; org_name?: string;
  screenshot_url?: string|null;
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
  select: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 10px", color: "#E8EEFF", fontSize: 12, fontFamily: "'DM Mono',monospace", outline: "none" } as React.CSSProperties,
};

export default function SupportAdminDashboard() {
  const [items, setItems] = useState<Req[]>([]);
  const [statusFilter, setStatusFilter]     = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  async function load() {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    const r = await authFetch(`/support/admin/requests?${qs}`);
    if (r.ok) { const d = await r.json(); setItems(d.requests || []); }
  }
  useEffect(() => { load(); }, [statusFilter]);

  async function setStatus(id: number, status: string) {
    await authFetch(`/support/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  const filtered = items.filter(r =>
    (!categoryFilter || r.category === categoryFilter) &&
    (!priorityFilter || r.priority === priorityFilter)
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={S.select} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={S.select} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace" }}>
          {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 640, overflowY: "auto" }}>
        {filtered.length === 0 && <div style={{ color: "rgba(232,238,255,0.3)", fontSize: 13, textAlign: "center", padding: 24 }}>No tickets match these filters.</div>}
        {filtered.map(t => (
          <div key={t.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6, alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#E8EEFF" }}>{t.subject}</div>
              <select value={t.status} onChange={e => setStatus(t.id, e.target.value)} style={S.select}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 12, color: "rgba(232,238,255,0.6)", marginBottom: 8, whiteSpace: "pre-wrap" }}>{t.message}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 10, color: "rgba(232,238,255,0.45)", fontFamily: "'DM Mono',monospace" }}>
              <span>{t.category}</span>·<span>{t.priority}</span>
              {t.user_email && <>·<span>{t.user_email}</span></>}
              {t.org_name && <>·<span>{t.org_name}</span></>}
              ·<span>{new Date(t.created_at).toLocaleString()}</span>
            </div>
            {t.screenshot_url && (
              <div style={{ marginTop: 8 }}>
                <a href={t.screenshot_url} target="_blank" rel="noreferrer" style={{ color: "#38BDF8", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>View screenshot →</a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
