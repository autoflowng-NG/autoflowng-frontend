/**
 * NotificationCentre — Phase 9B
 *
 * Persistent in-app notification inbox.
 * - Real-time delivery via WebSocketContext
 * - Read / archive / delete
 * - Category filter
 * - Unread badge count
 * - Accessible from AppShell header bell icon
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, X, Check, Archive, Trash2,
  CheckCheck, Brain, AlertTriangle, Zap,
  Shield, CreditCard, Activity, ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useWebSocketContext } from "../contexts/WebSocketContext";

const API_BASE = (import.meta.env?.VITE_API_URL || "https://autoflowng-backend-production-dfa9.up.railway.app")
  .replace(/\/$/, "");

async function apiFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...((opts.headers as any) ?? {}) },
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `${res.status}`); }
  return res.json();
}

interface Notification {
  id:         number;
  category:   string;
  priority:   string;
  title:      string;
  body:       string | null;
  action_url: string | null;
  source:     string;
  read_at:    string | null;
  created_at: string;
}

const CATEGORY_ICON: Record<string, any> = {
  workflow:     Zap,
  alert:        AlertTriangle,
  ai:           Brain,
  support:      Activity,
  subscription: CreditCard,
  platform:     Activity,
  security:     Shield,
};

const CATEGORY_COLOR: Record<string, string> = {
  workflow:     "#00C896",
  alert:        "#FB7185",
  ai:           "#A78BFA",
  support:      "#38BDF8",
  subscription: "#FBBF24",
  platform:     "#94A3B8",
  security:     "#FB7185",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#FB7185",
  high:   "#FBBF24",
  normal: "#94A3B8",
  low:    "#64748B",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000)   return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

/* ── Notification row ────────────────────────────────────────────────── */
function NotifRow({
  notif, onRead, onArchive, onDelete,
}: {
  notif: Notification;
  onRead:    (id: number) => void;
  onArchive: (id: number) => void;
  onDelete:  (id: number) => void;
}) {
  const Icon  = CATEGORY_ICON[notif.category]  ?? Activity;
  const color = CATEGORY_COLOR[notif.category] ?? "#94A3B8";
  const isUnread = !notif.read_at;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 14px",
        background: isUnread ? `${color}08` : "rgba(255,255,255,0.015)",
        borderLeft: `2px solid ${isUnread ? color : "transparent"}`,
        transition: "background 0.2s",
        position: "relative",
      }}
      onMouseEnter={e => { if (!isUnread) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isUnread ? `${color}08` : "rgba(255,255,255,0.015)"; }}
    >
      {/* Icon */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: `${color}12`, border: `1px solid ${color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={13} color={color} />
      </div>

      {/* Content */}
      <div
        style={{ flex: 1, minWidth: 0, cursor: notif.action_url ? "pointer" : "default" }}
        onClick={() => {
          if (!isUnread) return;
          onRead(notif.id);
          if (notif.action_url) window.location.href = notif.action_url;
        }}
      >
        <div style={{
          fontSize: 12, fontWeight: isUnread ? 700 : 600,
          color: isUnread ? "#E8EEFF" : "rgba(232,238,255,0.65)",
          fontFamily: "'DM Sans',sans-serif",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {notif.title}
        </div>
        {notif.body && (
          <div style={{
            fontSize: 11, color: "rgba(232,238,255,0.4)",
            fontFamily: "'DM Sans',sans-serif", marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {notif.body}
          </div>
        )}
        <div style={{
          display: "flex", gap: 8, marginTop: 4, alignItems: "center",
        }}>
          <span style={{
            fontSize: 9, color: PRIORITY_COLOR[notif.priority] ?? "#94A3B8",
            fontFamily: "'DM Mono',monospace", textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            {notif.priority}
          </span>
          <span style={{ fontSize: 9, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Mono',monospace" }}>
            {timeAgo(notif.created_at)}
          </span>
          {notif.action_url && (
            <ChevronRight size={9} color="rgba(232,238,255,0.2)" />
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {isUnread && (
          <button onClick={() => onRead(notif.id)} title="Mark read" style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(232,238,255,0.25)", padding: 3, borderRadius: 5,
            transition: "color 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "#00C896")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(232,238,255,0.25)")}
          >
            <Check size={11} />
          </button>
        )}
        <button onClick={() => onArchive(notif.id)} title="Archive" style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(232,238,255,0.2)", padding: 3, borderRadius: 5,
          transition: "color 0.15s",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "#A78BFA")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(232,238,255,0.2)")}
        >
          <Archive size={11} />
        </button>
        <button onClick={() => onDelete(notif.id)} title="Delete" style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(232,238,255,0.15)", padding: 3, borderRadius: 5,
          transition: "color 0.15s",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "#FB7185")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(232,238,255,0.15)")}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </motion.div>
  );
}

/* ── Unread badge (exported for AppShell) ────────────────────────────── */
export function NotificationBadge() {
  const { token, isAuthenticated } = useAuth();
  const { subscribe } = useWebSocketContext();
  const [count, setCount] = useState(0);
  const tok = token();

  const fetchCount = useCallback(async () => {
    if (!tok) return;
    try {
      const d = await apiFetch("/notifications/unread-count", tok);
      setCount(d.count || 0);
    } catch (_) {}
  }, [tok]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchCount();
    // Re-fetch on any WS event that could generate a notification
    const unsub = subscribe("*", (event) => {
      const evType = (event.event || event.type || "").toLowerCase();
      if (evType.includes("alert") || evType.includes("notification") || evType.includes("failed")) {
        fetchCount();
      }
    });
    return unsub;
  }, [isAuthenticated, fetchCount, subscribe]);

  if (count === 0) return null;
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      style={{
        position: "absolute", top: -4, right: -4,
        minWidth: 16, height: 16, borderRadius: 100,
        background: "#FB7185", color: "#04060F",
        fontSize: 9, fontWeight: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Mono',monospace", padding: "0 3px",
        pointerEvents: "none",
      }}
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

/* ── Main notification centre panel ─────────────────────────────────── */
export function NotificationCentre() {
  const { token, isAuthenticated } = useAuth();
  const { subscribe } = useWebSocketContext();
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState<string>("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const tok = token();

  const load = useCallback(async () => {
    if (!tok) return;
    setLoading(true);
    try {
      const params = filter !== "all" ? `?category=${filter}` : "";
      const d = await apiFetch(`/notifications${params}`, tok);
      setNotifs(d.notifications || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [tok, filter]);

  useEffect(() => { if (open) load(); }, [open, load]);

  // Real-time: push new notifications from WS
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = subscribe("*", async (event) => {
      const evType = (event.event || event.type || "").toLowerCase();
      if (!evType.includes("notification") && !evType.includes("alert_fired") && !evType.includes("failed")) return;
      // Re-fetch inbox on relevant events
      if (tok && open) load();
    });
    return unsub;
  }, [isAuthenticated, subscribe, tok, open, load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead    = async (id: number) => {
    if (!tok) return;
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    await apiFetch(`/notifications/${id}/read`, tok, { method: "POST" }).catch(() => {});
  };
  const archive     = async (id: number) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    if (tok) await apiFetch(`/notifications/${id}/archive`, tok, { method: "POST" }).catch(() => {});
  };
  const del         = async (id: number) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    if (tok) await apiFetch(`/notifications/${id}`, tok, { method: "DELETE" }).catch(() => {});
  };
  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    if (tok) await apiFetch("/notifications/read-all", tok, { method: "POST" }).catch(() => {});
  };

  const unreadCount = notifs.filter(n => !n.read_at).length;
  const filtered    = filter === "all" ? notifs : notifs.filter(n => n.category === filter);

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: "relative", background: "none", border: "none",
          cursor: "pointer", color: open ? "#FBBF24" : "rgba(232,238,255,0.45)",
          padding: 6, borderRadius: 8, transition: "color 0.15s",
          display: "flex", alignItems: "center",
        }}
      >
        <Bell size={16} color={open ? "#FBBF24" : "currentColor"} />
        <NotificationBadge />
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: -8,  scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            style={{
              position:     "absolute",
              top:          "calc(100% + 10px)",
              right:        0,
              zIndex:       500,
              width:        360,
              maxHeight:    520,
              background:   "rgba(6,9,20,0.98)",
              border:       "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              backdropFilter: "blur(24px)",
              boxShadow:    "0 20px 60px rgba(0,0,0,0.6)",
              overflow:     "hidden",
              display:      "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink: 0,
            }}>
              <Bell size={14} color="#FBBF24" />
              <span style={{
                fontSize: 13, fontWeight: 700, color: "#E8EEFF",
                fontFamily: "'Syne',sans-serif", flex: 1,
              }}>
                Notifications
                {unreadCount > 0 && (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 800,
                    color: "#FB7185", background: "rgba(251,113,133,0.12)",
                    border: "1px solid rgba(251,113,133,0.25)",
                    borderRadius: 100, padding: "1px 6px",
                    fontFamily: "'DM Mono',monospace",
                  }}>
                    {unreadCount} unread
                  </span>
                )}
              </span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} title="Mark all read" style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(232,238,255,0.3)", fontSize: 11,
                  fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", gap: 4,
                }}>
                  <CheckCheck size={11} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(232,238,255,0.25)", padding: 2,
              }}>
                <X size={13} />
              </button>
            </div>

            {/* Category filter */}
            <div style={{
              display: "flex", gap: 4, padding: "8px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              flexShrink: 0, overflowX: "auto",
            }}>
              {["all", "workflow", "alert", "ai", "platform"].map(cat => (
                <button key={cat} onClick={() => setFilter(cat)} style={{
                  fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                  cursor: "pointer", flexShrink: 0,
                  fontFamily: "'DM Mono',monospace", textTransform: "uppercase",
                  border: `1px solid ${filter === cat ? (CATEGORY_COLOR[cat] || "#A78BFA") : "rgba(255,255,255,0.08)"}`,
                  background: filter === cat ? `${(CATEGORY_COLOR[cat] || "#A78BFA")}15` : "transparent",
                  color: filter === cat ? (CATEGORY_COLOR[cat] || "#A78BFA") : "rgba(232,238,255,0.3)",
                  transition: "all 0.15s",
                }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {loading ? (
                <div style={{ padding: "28px 0", textAlign: "center", fontSize: 12, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Sans',sans-serif" }}>
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "36px 0", textAlign: "center" }}>
                  <Bell size={24} color="rgba(255,255,255,0.08)" style={{ margin: "0 auto 10px", display: "block" }} />
                  <div style={{ fontSize: 12, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Sans',sans-serif" }}>
                    No notifications
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filtered.map(n => (
                    <NotifRow key={n.id} notif={n} onRead={markRead} onArchive={archive} onDelete={del} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
