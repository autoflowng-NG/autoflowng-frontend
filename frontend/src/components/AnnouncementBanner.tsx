/**
 * AnnouncementBanner — Phase 3B
 *
 * Small dismissible banner that renders the highest-priority undismissed
 * active announcement at the top of the app shell. Never blocks usage.
 */

import { useEffect, useState } from "react";
import { X, AlertTriangle, Info, ShieldAlert, Wrench, Sparkles, BookOpen } from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "autoflowng_token";

interface Announcement {
  id: number; title: string; body: string;
  type: string; priority: string; action_url?: string | null;
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

const STYLE_BY_TYPE: Record<string, { bg: string; border: string; color: string; Icon: any }> = {
  outage:         { bg: "rgba(251,113,133,0.12)", border: "rgba(251,113,133,0.35)", color: "#FB7185", Icon: AlertTriangle },
  security:       { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)",  color: "#F59E0B", Icon: ShieldAlert },
  maintenance:    { bg: "rgba(56,189,248,0.10)",  border: "rgba(56,189,248,0.30)",  color: "#38BDF8", Icon: Wrench },
  release:        { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)", color: "#A78BFA", Icon: Sparkles },
  update:         { bg: "rgba(0,200,150,0.10)",   border: "rgba(0,200,150,0.30)",   color: "#00C896", Icon: BookOpen },
  informational:  { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", color: "#E8EEFF", Icon: Info },
};

export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    authFetch("/announcements/active")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.announcements) setItems(d.announcements); })
      .catch(() => {});
  }, []);

  async function dismiss(id: number) {
    setItems(prev => prev.filter(a => a.id !== id));
    authFetch(`/announcements/${id}/dismiss`, { method: "POST" }).catch(() => {});
  }

  if (!items.length) return null;
  const a = items[0]; // show top one
  const style = STYLE_BY_TYPE[a.type] || STYLE_BY_TYPE.informational;
  const Icon = style.Icon;

  return (
    <div style={{
      background: style.bg, borderBottom: `1px solid ${style.border}`,
      padding: "10px 18px", display: "flex", alignItems: "center", gap: 12,
      fontFamily: "'DM Sans',sans-serif",
    }}>
      <Icon size={16} color={style.color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: style.color, fontWeight: 700, fontSize: 13, marginRight: 8 }}>{a.title}</span>
        <span style={{ color: "rgba(232,238,255,0.75)", fontSize: 13 }}>{a.body}</span>
        {a.action_url && (
          <a href={a.action_url} style={{ marginLeft: 10, color: style.color, fontWeight: 700, fontSize: 12, textDecoration: "underline" }}>
            Learn more
          </a>
        )}
      </div>
      <button onClick={() => dismiss(a.id)} style={{
        background: "transparent", border: "none", color: "rgba(232,238,255,0.5)",
        cursor: "pointer", padding: 4,
      }} aria-label="Dismiss announcement">
        <X size={16} />
      </button>
    </div>
  );
}
