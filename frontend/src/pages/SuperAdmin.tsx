/**
 * AutoFlowNG — Super Admin Dashboard (Phase 10A)
 *
 * Accessible by: super_admin, admin, operator (read-only sections), support (read-only)
 * Role-gated sections use canDo() checks to show/hide controls.
 *
 * Bug 1 fix: S.row now wraps on narrow viewports; identity block is full-width
 *            on its own line, controls wrap below it on mobile.
 * Bug 4a fix: Added TestimonialsModerationPanel tab to SuperAdmin (was missing).
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminAPI, approvalsAPI } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import {
  canDo, getRoleBadge, STAFF_ROLES, ALL_PLATFORM_ROLES,
  isSuperAdmin, isPlatformAdmin,
  type PlatformRole,
} from "../lib/rbac";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Users, CreditCard, Activity, Settings2, Search,
  UserCheck, UserX, ChevronDown, Plus, Trash2, Eye,
  BarChart2, Globe, CheckCircle2, XCircle,
  RefreshCw, Lock, Unlock, ClipboardList, Crown,
  Phone, MapPin, FileText, X as XIcon, Loader2,
  Megaphone, Video, LifeBuoy, Clock, Star,
} from "lucide-react";
import PaystackBalanceWidget from "../components/PaystackBalanceWidget";
import MFAEnforcementBanner from "../components/MFAEnforcement";
import OperationalAlertsBadge from "../components/OperationalAlertsBadge";
import AnnouncementManager from "../components/AnnouncementManager";
import DemoVideoManager from "../components/DemoVideoManager";
import SupportAdminDashboard from "../components/SupportAdminDashboard";
// Bug 4a fix: import the existing TestimonialsModerationPanel
import TestimonialsModerationPanel from "../components/TestimonialsModerationPanel";

// ── Shared Styles ──────────────────────────────────────────────────────────────

const S = {
  glass:   { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px" } as React.CSSProperties,
  label:   { fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 4 } as React.CSSProperties,
  value:   { fontSize: "1.5rem", fontWeight: 900, fontFamily: "'Syne',sans-serif" } as React.CSSProperties,
  muted:   { fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" } as React.CSSProperties,
  input:   { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 14px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  select:  { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px", color: "#E8EEFF", fontSize: 12, fontFamily: "'DM Mono',monospace", outline: "none" } as React.CSSProperties,
  btn:     (color: string) => ({ display: "flex", alignItems: "center", gap: 5, background: `rgba(${color},0.1)`, border: `1px solid rgba(${color},0.2)`, borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }) as React.CSSProperties,
  // Bug 1 fix: added flexWrap: "wrap" so the row wraps on narrow screens
  row:     { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "11px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" } as React.CSSProperties,
};

// ── Role Badge ─────────────────────────────────────────────────────────────────

  /** Sends a heartbeat every 60s so super admin can see this staff member as online */
  function useStaffHeartbeat() {
    useEffect(() => {
      const ping = () => {
        fetch('/api/super-admin/heartbeat', { method: 'POST', credentials: 'include' }).catch(() => {});
      };
      ping();
      const interval = setInterval(ping, 60_000);
      return () => clearInterval(interval);
    }, []);
  }

  
function RoleBadge({ role }: { role?: string }) {
  const b = getRoleBadge(role);
  return (
    <span style={{ fontSize: 9, fontWeight: 800, color: b.color, background: b.bg, border: `1px solid ${b.color}33`, borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {b.label}
    </span>
  );
}

  /** Green dot = seen within 2 minutes. Red dot = offline or never seen. */
  function OnlineDot({ lastSeenAt }: { lastSeenAt?: string | null }) {
    const isOnline = lastSeenAt
      ? Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000
      : false;
    return (
      <span
        title={isOnline ? "Online now" : lastSeenAt ? `Last seen ${new Date(lastSeenAt).toLocaleString()}` : "Never active"}
        style={{
          position:      "absolute",
          bottom:        0,
          right:         0,
          width:         8,
          height:        8,
          borderRadius:  "50%",
          background:    isOnline ? "#00C896" : "#FB7185",
          border:        "1px solid #04060F",
          boxShadow:     isOnline ? "0 0 5px #00C896" : "none",
          display:       "inline-block",
          flexShrink:    0,
        }}
      />
    );
  }

  
// ── UserProfileDrawer — super admin views any user's full profile ──────────────

interface UserProfileDrawerProps {
  userId: string | null;
  onClose: () => void;
}

function UserProfileDrawer({ userId, onClose }: UserProfileDrawerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin", "user-profile", userId],
    queryFn:  () => {
      const token = localStorage.getItem("autoflowng_token") || sessionStorage.getItem("autoflowng_token");
      return fetch(`/api/profile/user/${userId}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
    },
    enabled:  !!userId,
  });

  // Live clock for per-user local time — ticks every minute
  const [drawerClock, setDrawerClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setDrawerClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (!userId) return null;

  // Compute the user's current local time from their stored IANA timezone.
  const formatUserLocalTime = (tz: string | null | undefined): string => {
    if (!tz) return "Timezone unknown";
    try {
      const time = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      }).format(drawerClock);
      return `${time} (${tz})`;
    } catch {
      return "Timezone unknown";
    }
  };

  const p = (data as any) || {};
  const initials = (p.name || p.email || "?")
    .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  const formatCurrency = (v?: any) =>
    v ? `₦${(parseFloat(v) / 100).toLocaleString()}` : "₦0";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(4,6,15,0.75)",
          zIndex: 1000, backdropFilter: "blur(4px)",
        }}
      />
      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        background: "#08091A", borderLeft: "1px solid rgba(255,255,255,0.08)",
        zIndex: 1001, overflowY: "auto", padding: 28,
        fontFamily: "'DM Sans', sans-serif", color: "#E8EEFF",
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>User Profile</div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "rgba(232,238,255,0.5)" }}
          >
            <XIcon size={14} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
            <Loader2 size={28} color="#00C896" style={{ animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : p.error ? (
          <div style={{ padding: 24, color: "#FB7185", textAlign: "center", fontSize: 13 }}>{p.error}</div>
        ) : (
          <>
            {/* Avatar + identity */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(0,200,150,0.3)" }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#00C896,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#04060F" }}>
                  {initials}
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{p.name || "—"}</div>
                <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", marginTop: 2 }}>{p.email}</div>
                <RoleBadge role={p.role} />
              </div>
            </div>

            {/* Profile details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>PROFILE DETAILS</div>
              {[
                { label: "Phone",    value: p.phone,    icon: <Phone size={12} /> },
                { label: "Location", value: p.location, icon: <MapPin size={12} /> },
                { label: "Address",  value: p.address,  icon: <MapPin size={12} /> },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "rgba(232,238,255,0.25)", marginTop: 1, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 2 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: value ? "#E8EEFF" : "rgba(232,238,255,0.25)" }}>{value || "—"}</div>
                  </div>
                </div>
              ))}
              {p.bio && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "rgba(232,238,255,0.25)", marginTop: 1, flexShrink: 0 }}><FileText size={12} /></span>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 2 }}>BIO</div>
                    <div style={{ fontSize: 12, color: "#E8EEFF", lineHeight: 1.5 }}>{p.bio}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Account stats */}
            <div style={{ ...S.glass }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 14 }}>ACCOUNT STATS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Plan",            value: (p.plan || "—").toUpperCase() },
                  { label: "Member Since",    value: formatDate(p.created_at) },
                  { label: "Last Login",      value: p.last_login_at ? formatDate(p.last_login_at) : "Never" },
                  { label: "Automations",     value: p.active_automations ?? "—" },
                  { label: "Workflows",       value: p.active_workflows ?? "—" },
                  { label: "Connections",     value: p.connections ?? "—" },
                  { label: "Total Paid",      value: formatCurrency(p.total_paid) },
                  { label: "Status",          value: p.is_active === false ? "Suspended" : "Active" },
                  { label: "Local Time",      value: formatUserLocalTime(p.timezone) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 2 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF" }}>{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff notes */}
            {p.staff_notes && (
              <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#FBBF24", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 6 }}>STAFF NOTES</div>
                <div style={{ fontSize: 12, color: "#E8EEFF", lineHeight: 1.5 }}>{p.staff_notes}</div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, isLoading } = useQuery({ queryKey: ["super-admin", "overview"], queryFn: () => superAdminAPI.overview(), retry: 1 });
  const o = (data as any) || {};

  const statCards = [
    { label: "Total Users",       value: o.users?.total       ?? "—", sub: `+${o.users?.thisWeek ?? 0} this week`,  color: "#00C896" },
    { label: "Active Users",      value: o.users?.active      ?? "—", sub: `${o.users?.suspended ?? 0} suspended`,   color: "#38BDF8" },
    { label: "Total Revenue",     value: o.revenue?.totalAmount ? `₦${(o.revenue.totalAmount/100).toLocaleString()}` : "—", sub: `MRR: ₦${((o.revenue?.mrr ?? 0)/100).toLocaleString()}`, color: "#FBBF24" },
    { label: "Active Workflows",  value: o.workflows?.active  ?? "—", sub: `${o.workflows?.total ?? 0} total`,        color: "#A78BFA" },
    { label: "Staff Members",     value: o.staff?.total       ?? "—", sub: (o.staff?.byRole ?? []).map((r: any) => `${r.role}:${r.cnt}`).join(" · ") || "none", color: "#FB7185" },
    { label: "Pending Withdrawals",value: o.pendingWithdrawals?? "—", sub: "requires review",                         color: "#F59E0B" },
  ];

  if (isLoading) return <div style={{ textAlign: "center", padding: 40, color: "rgba(232,238,255,0.3)" }}>Loading platform overview…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PaystackBalanceWidget compact />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        {statCards.map(s => (
          <div key={s.label} style={S.glass}>
            <div style={S.label}>{s.label}</div>
            <div style={{ ...S.value, color: s.color }}>{s.value}</div>
            <div style={S.muted}>{s.sub}</div>
          </div>
        ))}
      </div>

      {o.users?.recent?.length > 0 && (
        <div style={S.glass}>
          <div style={{ ...S.label, marginBottom: 14 }}>RECENT REGISTRATIONS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {o.users.recent.slice(0, 8).map((u: any) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#00C896,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#04060F", flexShrink: 0 }}>
                  {(u.name || u.email || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name || u.email}</div>
                  <div style={S.muted}>{u.email}</div>
                </div>
                <RoleBadge role={u.role} />
                <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────────

function UsersTab({ userRole }: { userRole: string }) {
  const [search, setSearch]           = useState("");
  const [roleFilter, setRole]         = useState("");
  const [planFilter, setPlan]         = useState("");
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ["super-admin", "users", { search, roleFilter, planFilter }],
    queryFn:  () => superAdminAPI.users({ search: search || undefined, role: roleFilter || undefined, plan: planFilter || undefined }),
  });
  const users = (data as any)?.users ?? [];

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => superAdminAPI.updateUserRole(id, role),
    onSuccess:  () => { toast({ title: "Role updated" }); qc.invalidateQueries({ queryKey: ["super-admin"] }); },
    onError:    (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) => superAdminAPI.updateUserPlan(id, plan),
    onSuccess:  () => { toast({ title: "Plan updated" }); qc.invalidateQueries({ queryKey: ["super-admin", "users"] }); },
    onError:    (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const [approvalModal, setApprovalModal] = useState<{ userId: string; email: string; action: "suspend" | "unsuspend" } | null>(null);
  const [approvalReason, setApprovalReason] = useState("");

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => superAdminAPI.suspendUser(id, reason),
    onSuccess:  () => { toast({ title: "User suspended" }); qc.invalidateQueries({ queryKey: ["super-admin", "users"] }); },
    onError:    (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const unsuspend = useMutation({
    mutationFn: (id: string) => superAdminAPI.unsuspendUser(id),
    onSuccess:  () => { toast({ title: "User reactivated" }); qc.invalidateQueries({ queryKey: ["super-admin", "users"] }); },
    onError:    (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const submitApproval = useMutation({
    mutationFn: (data: { action_type: string; target_type: string; target_id: string; reason: string }) =>
      approvalsAPI.create(data),
    onSuccess: () => {
      toast({ title: "Approval request submitted", description: "A Super Admin will review this shortly." });
      setApprovalModal(null);
      setApprovalReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const canManage  = canDo(userRole, "manage_users");
  const canSuspend = canDo(userRole, "suspend_users");
  const canRole    = isSuperAdmin(userRole);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.3)" }} />
          <input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...S.input, paddingLeft: 34 }} />
        </div>
        <select value={roleFilter} onChange={e => setRole(e.target.value)} style={S.select}>
          <option value="">All roles</option>
          {ALL_PLATFORM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={planFilter} onChange={e => setPlan(e.target.value)} style={S.select}>
          <option value="">All plans</option>
          {["trial","free","basic","pro","business","unlimited"].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {isFetching && <div style={{ ...S.muted, marginBottom: 8, textAlign: "center" }}>Refreshing…</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>No users found</div>
        ) : users.map((u: any) => (
          <div key={u.id} style={{ ...S.row, opacity: u.is_active === false ? 0.6 : 1 }}>
            {/* Bug 1 fix: Avatar + identity block now has flexBasis: "100%" on its own line
                via a wrapping approach. Avatar is always visible. Identity (name/email)
                gets minWidth:0 + word wrapping so emails display fully on mobile.
                Controls wrap onto a second line via flexWrap: "wrap" on S.row. */}
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: u.is_active === false ? "rgba(251,113,133,0.2)" : "linear-gradient(135deg,#00C896,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#04060F", flexShrink: 0 }}>
              {(u.name || u.email || "?")[0].toUpperCase()}
            </div>
            {/* Identity block: flex:1 on wide, full-width on wrap so email is never clipped */}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || u.email}</div>
              {/* Bug 1 fix: email uses whiteSpace:"normal" so it wraps on mobile instead of getting clipped */}
              <div style={{ ...S.muted, wordBreak: "break-all" }}>{u.email} · {u.active_automations ?? 0} auto · {u.active_workflows ?? 0} wf</div>
            </div>

            {/* Controls group: these wrap together onto the next line on narrow screens */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <RoleBadge role={u.role} />

              {canRole ? (
                <select value={u.role || "user"} onChange={e => updateRole.mutate({ id: u.id, role: e.target.value })}
                  style={{ ...S.select, fontSize: 10 }}>
                  {ALL_PLATFORM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : null}

              {canManage ? (
                <select value={u.plan || "trial"} onChange={e => updatePlan.mutate({ id: u.id, plan: e.target.value })}
                  style={{ ...S.select, fontSize: 10 }}>
                  {["trial","free","basic","pro","business","unlimited"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : null}

              {canSuspend && (
                u.is_active === false ? (
                  <button
                    onClick={() => {
                      if (isSuperAdmin(userRole)) {
                        unsuspend.mutate(u.id);
                      } else {
                        setApprovalModal({ userId: String(u.id), email: u.email, action: "unsuspend" });
                      }
                    }}
                    style={{ ...S.btn("56,189,248"), color: "#38BDF8" }}>
                    <Unlock size={10} /> {isSuperAdmin(userRole) ? "Restore" : "Request Restore"}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (isSuperAdmin(userRole)) {
                        if (window.confirm(`Suspend ${u.email}?`)) suspend.mutate({ id: u.id });
                      } else {
                        setApprovalModal({ userId: String(u.id), email: u.email, action: "suspend" });
                      }
                    }}
                    style={{ ...S.btn("251,113,133"), color: "#FB7185" }}>
                    <Lock size={10} /> {isSuperAdmin(userRole) ? "Suspend" : "Request Suspend"}
                  </button>
                )
              )}

              {isSuperAdmin(userRole) && (
                <button onClick={() => setViewingUserId(String(u.id))}
                  style={{ ...S.btn("167,139,250"), color: "#A78BFA" }}>
                  <Eye size={10} /> Profile
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(data as any)?.total > users.length && (
        <div style={{ textAlign: "center", padding: "12px", ...S.muted }}>
          Showing {users.length} of {(data as any).total} users
        </div>
      )}

      <UserProfileDrawer userId={viewingUserId} onClose={() => setViewingUserId(null)} />

      {/* Approval request modal for non-super_admin users */}
      {approvalModal && (
        <>
          <div
            onClick={() => setApprovalModal(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(4,6,15,0.8)", zIndex: 2000, backdropFilter: "blur(4px)" }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "#08091A", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: 24, zIndex: 2001,
            width: 400, display: "flex", flexDirection: "column", gap: 14,
            fontFamily: "'DM Sans',sans-serif",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF" }}>
              Request {approvalModal.action === "suspend" ? "Suspension" : "Restoration"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(232,238,255,0.6)", lineHeight: 1.5 }}>
              You are requesting to <strong style={{ color: "#E8EEFF" }}>
                {approvalModal.action === "suspend" ? "suspend" : "restore"}
              </strong> <strong style={{ color: "#E8EEFF" }}>{approvalModal.email}</strong>.
              A Super Admin will review and execute this action.
            </div>
            <textarea
              value={approvalReason}
              onChange={e => setApprovalReason(e.target.value)}
              placeholder="Reason for this request…"
              rows={3}
              style={{ ...S.input, resize: "vertical" as any }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setApprovalModal(null)} style={{ ...S.btn("255,255,255"), color: "rgba(232,238,255,0.6)" }}>
                Cancel
              </button>
              <button
                onClick={() => submitApproval.mutate({
                  action_type: approvalModal.action === "suspend" ? "suspend_user" : "unsuspend_user",
                  target_type: "user",
                  target_id: approvalModal.userId,
                  reason: approvalReason,
                })}
                disabled={!approvalReason.trim() || submitApproval.isPending}
                style={{ ...S.btn("245,158,11"), color: "#F59E0B", opacity: (!approvalReason.trim() || submitApproval.isPending) ? 0.5 : 1 }}>
                Submit Request
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Staff Tab ──────────────────────────────────────────────────────────────────

function StaffTab({ userRole }: { userRole: string }) {
  const [showCreate, setShowCreate]       = useState(false);
  const [form, setForm]                   = useState({ name: "", email: "", password: "", role: "support" });
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["super-admin", "staff"], queryFn: superAdminAPI.staff, refetchInterval: 90_000 });
  const staff = (data as any)?.staff ?? [];

  const create = useMutation({
    mutationFn: () => superAdminAPI.createStaff(form as any),
    onSuccess:  () => {
      toast({ title: "Staff account created" });
      qc.invalidateQueries({ queryKey: ["super-admin"] });
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", role: "support" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const removeStaff = useMutation({
    mutationFn: (id: string) => superAdminAPI.removeStaff(id),
    onSuccess:  () => { toast({ title: "Staff removed" }); qc.invalidateQueries({ queryKey: ["super-admin", "staff"] }); },
    onError:    (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => superAdminAPI.updateStaffRole(id, role),
    onSuccess:  () => { toast({ title: "Role updated" }); qc.invalidateQueries({ queryKey: ["super-admin", "staff"] }); },
    onError:    (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const canManage = isSuperAdmin(userRole);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF" }}>{staff.length} staff member{staff.length !== 1 ? "s" : ""}</div>
        {canManage && (
          <button onClick={() => setShowCreate(s => !s)}
            style={{ ...S.btn("0,200,150"), color: "#00C896" }}>
            <Plus size={11} /> Add Staff
          </button>
        )}
      </div>

      {showCreate && canManage && (
        <div style={{ ...S.glass, marginBottom: 16 }}>
          <div style={{ ...S.label, marginBottom: 12 }}>CREATE STAFF ACCOUNT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input placeholder="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={S.input} />
            <input placeholder="Email address" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={S.input} />
            <input type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={S.input} />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ ...S.input, ...S.select }}>
              {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => create.mutate()}
              disabled={create.isPending || !form.name || !form.email || !form.password}
              style={{ ...S.btn("0,200,150"), color: "#00C896", opacity: create.isPending ? 0.6 : 1 }}>
              {create.isPending ? <RefreshCw size={10} /> : <Plus size={10} />}
              {create.isPending ? "Creating…" : "Create Account"}
            </button>
            <button onClick={() => setShowCreate(false)} style={{ ...S.btn("255,255,255"), color: "rgba(232,238,255,0.5)" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {staff.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>
            No staff members yet. {canManage ? "Add the first one above." : ""}
          </div>
        ) : staff.map((s: any) => (
          <div key={s.id} style={{ ...S.row, opacity: s.is_active === false ? 0.6 : 1 }}>
            {s.role === "super_admin" && <Crown size={14} color="#F59E0B" style={{ flexShrink: 0 }} />}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#A78BFA,#FB7185)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#04060F" }}>
                {(s.name || s.email || "?")[0].toUpperCase()}
              </div>
              <OnlineDot lastSeenAt={s.last_seen_at} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF" }}>{s.name}</div>
              <div style={S.muted}>{s.email} · {s.last_login_at ? `Last login: ${new Date(s.last_login_at).toLocaleDateString()}` : "Never logged in"}</div>
            </div>

            {canManage ? (
              <select value={s.role} onChange={e => changeRole.mutate({ id: s.id, role: e.target.value })}
                style={{ ...S.select, fontSize: 10 }}>
                {ALL_PLATFORM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <RoleBadge role={s.role} />
            )}

            {canManage && s.role !== "super_admin" && (
              <button onClick={() => { if (window.confirm(`Remove ${s.email} from staff?`)) removeStaff.mutate(s.id); }}
                style={{ ...S.btn("251,113,133"), color: "#FB7185" }}>
                <Trash2 size={10} />
              </button>
            )}

            {isSuperAdmin(userRole) && (
              <button onClick={() => setViewingUserId(String(s.id))}
                style={{ ...S.btn("167,139,250"), color: "#A78BFA" }}>
                <Eye size={10} /> Profile
              </button>
            )}
          </div>
        ))}
      </div>

      <UserProfileDrawer userId={viewingUserId} onClose={() => setViewingUserId(null)} />
    </div>
  );
}

// ── Payments Tab ───────────────────────────────────────────────────────────────

function PaymentsTab() {
  const { data } = useQuery({ queryKey: ["super-admin", "payments"], queryFn: () => superAdminAPI.payments() });
  const payments = (data as any)?.payments ?? [];
  const stats    = (data as any)?.stats ?? {};

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Revenue",    value: `₦${(parseFloat(stats.total_revenue || 0)/100).toLocaleString()}`, color: "#00C896" },
          { label: "Successful",       value: stats.successful ?? "—",                                           color: "#38BDF8" },
          { label: "Failed",           value: stats.failed     ?? "—",                                           color: "#FB7185" },
        ].map(s => (
          <div key={s.label} style={S.glass}>
            <div style={S.label}>{s.label}</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 900, color: s.color, fontFamily: "'Syne',sans-serif" }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {payments.map((p: any, i: number) => (
          <div key={i} style={S.row}>
            <CreditCard size={13} color="rgba(232,238,255,0.3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#E8EEFF" }}>{p.name || p.email}</div>
              <div style={S.muted}>{p.email} · {p.plan} · {p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#00C896" }}>₦{(p.amount / 100).toLocaleString()}</div>
            <span style={{ fontSize: 9, fontWeight: 800, color: p.status === "success" ? "#00C896" : "#FBBF24", background: p.status === "success" ? "rgba(0,200,150,0.1)" : "rgba(251,191,36,0.1)", borderRadius: 100, padding: "2px 8px", fontFamily: "'DM Mono',monospace" }}>
              {(p.status || "pending").toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Withdrawals Tab ────────────────────────────────────────────────────────────

function WithdrawalsTab({ userRole }: { userRole: string }) {
  const { data, refetch } = useQuery({ queryKey: ["super-admin", "withdrawals"], queryFn: superAdminAPI.withdrawals });
  const withdrawals = (data as any)?.withdrawals ?? [];
  const { toast } = useToast();

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => superAdminAPI.updateWithdrawal(id, status),
    onSuccess:  () => { toast({ title: "Updated" }); refetch(); },
    onError:    (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const canManage = canDo(userRole, "manage_withdrawals");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {withdrawals.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>No withdrawals</div>
      ) : withdrawals.map((w: any) => (
        <div key={w.id} style={S.row}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#E8EEFF" }}>{w.name || w.email}</div>
            <div style={S.muted}>₦{(w.amount / 100).toLocaleString()} · {w.bank_name} · {w.account_number}</div>
          </div>
          {canManage && w.status === "pending" && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => update.mutate({ id: w.id, status: "approved" })}
                style={{ ...S.btn("0,200,150"), color: "#00C896" }}>
                <CheckCircle2 size={10} /> Approve
              </button>
              <button onClick={() => update.mutate({ id: w.id, status: "rejected" })}
                style={{ ...S.btn("251,113,133"), color: "#FB7185" }}>
                <XCircle size={10} /> Reject
              </button>
            </div>
          )}
          <span style={{ fontSize: 9, fontWeight: 800, color: w.status === "approved" ? "#00C896" : w.status === "rejected" ? "#FB7185" : "#FBBF24", fontFamily: "'DM Mono',monospace" }}>
            {(w.status || "PENDING").toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Audit Log Tab ──────────────────────────────────────────────────────────────

function AuditLogTab() {
  const { data } = useQuery({ queryKey: ["super-admin", "audit-log"], queryFn: () => superAdminAPI.auditLog({ limit: 100 }) });
  const log = (data as any)?.log ?? [];

  const actionColor = (action: string) => {
    if (action.includes("delete") || action.includes("suspend"))  return "#FB7185";
    if (action.includes("create") || action.includes("bootstrap")) return "#00C896";
    if (action.includes("role"))   return "#A78BFA";
    if (action.includes("plan"))   return "#FBBF24";
    return "#38BDF8";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {log.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>No audit events yet</div>
      ) : log.map((e: any) => (
        <div key={e.id} style={{ ...S.row, padding: "8px 14px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: actionColor(e.action), flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: actionColor(e.action), fontFamily: "'DM Mono',monospace" }}>{e.action}</div>
            <div style={S.muted}>{e.actor_email || `Actor #${e.actor_id}`} {e.target_type ? `→ ${e.target_type} #${e.target_id}` : ""}</div>
          </div>
          <div style={S.muted}>{e.created_at ? new Date(e.created_at).toLocaleString() : ""}</div>
        </div>
      ))}
    </div>
  );
}

// ── System Tab ─────────────────────────────────────────────────────────────────

function SystemTab() {
  const { data, refetch } = useQuery({ queryKey: ["super-admin", "system"], queryFn: superAdminAPI.system });
  const s = (data as any) ?? {};

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => refetch()} style={{ ...S.btn("56,189,248"), color: "#38BDF8" }}>
          <RefreshCw size={10} /> Refresh
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { k: "Version",      v: s.version },
          { k: "Phase",        v: s.phase },
          { k: "Environment",  v: s.environment },
          { k: "Uptime",       v: s.uptime ? `${Math.floor(s.uptime / 60)}m ${Math.floor(s.uptime % 60)}s` : "—" },
          { k: "DB Connected", v: s.database ? "✅ Online" : "❌ Offline" },
          { k: "DB Latency",   v: s.dbLatency ? `${s.dbLatency}ms` : "—" },
          { k: "WebSocket",    v: s.websocket?.connections ?? "—" },
          { k: "RBAC",         v: s.rbac?.enabled ? "Enabled" : "Disabled" },
        ].map(({ k, v }) => (
          <div key={k} style={{ ...S.glass, padding: "12px 14px" }}>
            <div style={S.label}>{k.toUpperCase()}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF", fontFamily: "'DM Mono',monospace" }}>{String(v ?? "—")}</div>
          </div>
        ))}
      </div>

      {s.providers && (
        <div style={{ ...S.glass, marginTop: 12 }}>
          <div style={{ ...S.label, marginBottom: 12 }}>PROVIDER STATUS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 8 }}>
            {Object.entries(s.providers).map(([k, v]: any) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: v ? "#00C896" : "#64748B", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: v ? "#E8EEFF" : "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>{k}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {s.dbStats && (
        <div style={{ ...S.glass, marginTop: 12 }}>
          <div style={{ ...S.label, marginBottom: 12 }}>DATABASE STATISTICS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px,1fr))", gap: 8 }}>
            {Object.entries(s.dbStats).map(([k, v]: any) => (
              <div key={k} style={{ ...S.glass, padding: "10px 12px" }}>
                <div style={S.label}>{k.toUpperCase()}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>{parseInt(v).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Approvals Tab ─────────────────────────────────────────────────────────────

function ApprovalsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [declineModal, setDeclineModal] = useState<{ id: number } | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["approvals", statusFilter],
    queryFn: () => approvalsAPI.list({ status: statusFilter || undefined }),
    refetchInterval: 30_000,
  });

  const requests = (data as any)?.requests || [];

  const approve = useMutation({
    mutationFn: (id: number) => approvalsAPI.approve(id),
    onSuccess: () => { toast({ title: "Approved and executed" }); refetch(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const decline = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      approvalsAPI.decline(id, reason),
    onSuccess: () => {
      toast({ title: "Request declined" });
      setDeclineModal(null);
      setDeclineReason("");
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const ACTION_LABELS: Record<string, string> = {
    suspend_user:       "Suspend User",
    unsuspend_user:     "Restore User",
    delete_user:        "Delete User",
    update_plan:        "Change Plan",
    approve_withdrawal: "Approve Withdrawal",
    reject_withdrawal:  "Reject Withdrawal",
    issue_refund:       "Issue Refund",
  };

  const statusColor = (s: string) =>
    s === "pending" ? "#FBBF24" : s === "approved" ? "#00C896" : "#FB7185";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={S.select}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="">All</option>
        </select>
        <span style={S.muted}>{requests.length} request{requests.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Loader2 size={24} color="#00C896" style={{ animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>
          No requests found
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map((r: any) => (
            <div key={r.id} style={{ ...S.glass, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>
                      {ACTION_LABELS[r.action_type] || r.action_type}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: statusColor(r.status),
                      background: `${statusColor(r.status)}18`,
                      borderRadius: 100, padding: "2px 7px",
                      fontFamily: "'DM Mono',monospace",
                    }}>
                      {(r.status || "").toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>
                    Requested by{" "}
                    <strong style={{ color: "#E8EEFF" }}>
                      {r.requester_name || r.requester_email || `User #${r.requested_by}`}
                    </strong>
                    {r.target_type && r.target_id && ` · Target: ${r.target_type} #${r.target_id}`}
                  </div>
                  {r.reason && (
                    <div style={{
                      fontSize: 12, color: "rgba(232,238,255,0.7)",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 8, padding: "7px 10px",
                      fontStyle: "italic", lineHeight: 1.5,
                    }}>
                      "{r.reason}"
                    </div>
                  )}
                  {r.decision_reason && (
                    <div style={{ fontSize: 11, color: "#FB7185", marginTop: 6 }}>
                      Decline reason: {r.decision_reason}
                    </div>
                  )}
                  <div style={{ ...S.muted, marginTop: 6 }}>
                    {new Date(r.created_at).toLocaleString()}
                    {r.decided_at && ` · Decided ${new Date(r.decided_at).toLocaleString()} by ${r.decider_name || `#${r.decided_by}`}`}
                  </div>
                </div>
                {r.status === "pending" && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => approve.mutate(r.id)}
                      disabled={approve.isPending}
                      style={{ ...S.btn("0,200,150"), color: "#00C896", opacity: approve.isPending ? 0.5 : 1 }}>
                      <CheckCircle2 size={10} /> Approve
                    </button>
                    <button
                      onClick={() => setDeclineModal({ id: r.id })}
                      style={{ ...S.btn("251,113,133"), color: "#FB7185" }}>
                      <XCircle size={10} /> Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decline reason modal */}
      {declineModal && (
        <>
          <div
            onClick={() => setDeclineModal(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(4,6,15,0.8)", zIndex: 2000, backdropFilter: "blur(4px)" }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "#08091A", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: 24, zIndex: 2001,
            width: 380, display: "flex", flexDirection: "column", gap: 14,
            fontFamily: "'DM Sans',sans-serif",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF" }}>
              Decline Request
            </div>
            <div style={{ fontSize: 13, color: "rgba(232,238,255,0.6)" }}>
              Provide a reason for declining this request:
            </div>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="Reason for declining…"
              rows={3}
              style={{ ...S.input, resize: "vertical" as any }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeclineModal(null)}
                style={{ ...S.btn("255,255,255"), color: "rgba(232,238,255,0.6)" }}>
                Cancel
              </button>
              <button
                onClick={() => decline.mutate({ id: declineModal.id, reason: declineReason })}
                disabled={!declineReason.trim() || decline.isPending}
                style={{ ...S.btn("251,113,133"), color: "#FB7185", opacity: (!declineReason.trim() || decline.isPending) ? 0.5 : 1 }}>
                Decline
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Affiliate Drawer — full application, audit line, stats + actions ───────────

interface AffiliateDrawerProps {
  row: any;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onSuspend: (id: number) => void;
  approvePending: boolean;
}

function AffiliateDrawer({ row, onClose, onApprove, onReject, onSuspend, approvePending }: AffiliateDrawerProps) {
  if (!row) return null;
  const app = row.application || {};
  const stats = row.stats || {};

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const statusColor = (s: string) =>
    s === "active" ? "#00C896" : s === "pending" ? "#FBBF24" : s === "suspended" ? "#FB7185" : "#FB7185";

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(4,6,15,0.75)", zIndex: 1000, backdropFilter: "blur(4px)" }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 440,
        background: "#08091A", borderLeft: "1px solid rgba(255,255,255,0.08)",
        zIndex: 1001, overflowY: "auto", padding: 28,
        fontFamily: "'DM Sans', sans-serif", color: "#E8EEFF",
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Affiliate Application</div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "rgba(232,238,255,0.5)" }}
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Identity */}
        <div style={{ paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
              {app.full_name || row.user_name || row.user_email || `User #${row.user_id}`}
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700, color: statusColor(row.status),
              background: `${statusColor(row.status)}18`, borderRadius: 100, padding: "2px 7px",
              fontFamily: "'DM Mono',monospace",
            }}>
              {(row.status || "").toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)" }}>{row.user_email}</div>
          <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
            Applied {formatDate(row.applied_at)}
          </div>
        </div>

        {/* Full application */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>APPLICATION</div>
          {[
            { label: "Primary channel URL", value: app.primary_channel_url },
            { label: "Audience size",       value: app.audience_size_bucket },
            { label: "Promotional channels",value: Array.isArray(app.promotional_channels) ? app.promotional_channels.join(", ") : app.promotional_channels },
            { label: "Terms version agreed",value: app.terms_version },
            { label: "Agreed at",           value: app.agreed_at ? formatDate(app.agreed_at) : null },
            { label: "Self-referral ack",   value: app.self_referral_ack ? "Yes" : "No" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 2 }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: value ? "#E8EEFF" : "rgba(232,238,255,0.25)" }}>{value || "—"}</div>
            </div>
          ))}
          {app.promotion_plan && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 2 }}>PROMOTION PLAN</div>
              <div style={{
                fontSize: 12, color: "rgba(232,238,255,0.8)", background: "rgba(255,255,255,0.03)",
                borderRadius: 8, padding: "8px 10px", fontStyle: "italic", lineHeight: 1.5,
              }}>
                "{app.promotion_plan}"
              </div>
            </div>
          )}
        </div>

        {/* Review audit line */}
        {(row.reviewed_at || row.suspended_at || row.rejection_reason || row.suspended_reason) && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8 }}>REVIEW AUDIT</div>
            {row.reviewed_at && (
              <div style={{ fontSize: 12, color: "rgba(232,238,255,0.7)", marginBottom: 4 }}>
                Reviewed {formatDate(row.reviewed_at)} {row.reviewed_by_email && `by ${row.reviewed_by_email}`}
              </div>
            )}
            {row.rejection_reason && (
              <div style={{ fontSize: 12, color: "#FB7185", marginBottom: 4 }}>Rejection reason: {row.rejection_reason}</div>
            )}
            {row.suspended_at && (
              <div style={{ fontSize: 12, color: "#FB7185", marginBottom: 4 }}>Suspended {formatDate(row.suspended_at)}</div>
            )}
            {row.suspended_reason && (
              <div style={{ fontSize: 12, color: "#FB7185" }}>Suspension reason: {row.suspended_reason}</div>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div style={{ ...S.glass }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 14 }}>STATS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Referrals (total)",  value: stats.referrals_total ?? 0 },
              { label: "Referrals (active)", value: stats.referrals_active ?? 0 },
              { label: "Commission lifetime",value: `₦${Number(stats.commission_lifetime ?? 0).toLocaleString()}` },
              { label: "Commission pending", value: `₦${Number(stats.commission_pending ?? 0).toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 2 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF" }}>{String(value)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          {row.status === "pending" && (
            <>
              <button
                onClick={() => onApprove(row.id)}
                disabled={approvePending}
                style={{ ...S.btn("0,200,150"), color: "#00C896", opacity: approvePending ? 0.5 : 1 }}>
                <CheckCircle2 size={10} /> Approve
              </button>
              <button
                onClick={() => onReject(row.id)}
                style={{ ...S.btn("251,113,133"), color: "#FB7185" }}>
                <XCircle size={10} /> Reject
              </button>
            </>
          )}
          {row.status === "active" && (
            <button
              onClick={() => onSuspend(row.id)}
              style={{ ...S.btn("251,113,133"), color: "#FB7185" }}>
              <XCircle size={10} /> Suspend
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Affiliate Applications Tab ───────────────────────────────────────────────

function AffiliateApplicationsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: number } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [suspendModal, setSuspendModal] = useState<{ id: number } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["super-admin", "affiliates", statusFilter],
    queryFn: () => superAdminAPI.affiliates.list(statusFilter || undefined),
  });

  const rows = (data as any)?.affiliates || (data as any)?.applications || [];

  const approve = useMutation({
    mutationFn: (id: number) => superAdminAPI.affiliates.approve(id),
    onSuccess: () => { toast({ title: "Affiliate approved" }); setSelectedRow(null); refetch(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => superAdminAPI.affiliates.reject(id, reason),
    onSuccess: () => {
      toast({ title: "Application rejected" });
      setRejectModal(null);
      setRejectReason("");
      setSelectedRow(null);
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => superAdminAPI.affiliates.suspend(id, reason),
    onSuccess: () => {
      toast({ title: "Affiliate suspended" });
      setSuspendModal(null);
      setSuspendReason("");
      setSelectedRow(null);
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const statusColor = (s: string) =>
    s === "active" ? "#00C896" : s === "pending" ? "#FBBF24" : s === "suspended" ? "#FB7185" : "#FB7185";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={S.select}>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
          <option value="">All</option>
        </select>
        <span style={S.muted}>{rows.length} application{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Loader2 size={24} color="#00C896" style={{ animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>
          No affiliate applications found
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r: any) => {
            const app = r.application || {};
            const stats = r.stats || {};
            return (
              <div
                key={r.id}
                onClick={() => setSelectedRow(r)}
                style={{ ...S.glass, display: "flex", flexDirection: "column", gap: 10, cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>
                        {app.full_name || r.user_name || r.user_email || `User #${r.user_id}`}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: statusColor(r.status),
                        background: `${statusColor(r.status)}18`,
                        borderRadius: 100, padding: "2px 7px",
                        fontFamily: "'DM Mono',monospace",
                      }}>
                        {(r.status || "").toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>
                      {r.user_email} {app.primary_channel_url && `· ${app.primary_channel_url}`}
                      {app.audience_size_bucket && ` · Audience: ${app.audience_size_bucket}`}
                    </div>
                    <div style={{ ...S.muted }}>
                      Referrals: {stats.referrals_total ?? 0} · Lifetime earned: ₦{Number(stats.commission_lifetime ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <Eye size={14} color="rgba(232,238,255,0.35)" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedRow && (
        <AffiliateDrawer
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onApprove={(id) => approve.mutate(id)}
          onReject={(id) => setRejectModal({ id })}
          onSuspend={(id) => setSuspendModal({ id })}
          approvePending={approve.isPending}
        />
      )}

      {/* Reject reason modal */}
      {rejectModal && (
        <>
          <div
            onClick={() => setRejectModal(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(4,6,15,0.8)", zIndex: 2000, backdropFilter: "blur(4px)" }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "#08091A", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: 24, zIndex: 2001,
            width: 380, display: "flex", flexDirection: "column", gap: 14,
            fontFamily: "'DM Sans',sans-serif",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF" }}>
              Reject Application
            </div>
            <div style={{ fontSize: 13, color: "rgba(232,238,255,0.6)" }}>
              This is permanent — the applicant will not be able to reapply. Provide a reason (10-500 characters):
            </div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…"
              rows={3}
              style={{ ...S.input, resize: "vertical" as any }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setRejectModal(null)}
                style={{ ...S.btn("255,255,255"), color: "rgba(232,238,255,0.6)" }}>
                Cancel
              </button>
              <button
                onClick={() => reject.mutate({ id: rejectModal.id, reason: rejectReason })}
                disabled={rejectReason.trim().length < 10 || rejectReason.trim().length > 500 || reject.isPending}
                style={{ ...S.btn("251,113,133"), color: "#FB7185", opacity: (rejectReason.trim().length < 10 || reject.isPending) ? 0.5 : 1 }}>
                Reject Permanently
              </button>
            </div>
          </div>
        </>
      )}

      {/* Suspend reason modal */}
      {suspendModal && (
        <>
          <div
            onClick={() => setSuspendModal(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(4,6,15,0.8)", zIndex: 2000, backdropFilter: "blur(4px)" }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "#08091A", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: 24, zIndex: 2001,
            width: 380, display: "flex", flexDirection: "column", gap: 14,
            fontFamily: "'DM Sans',sans-serif",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF" }}>
              Suspend Affiliate
            </div>
            <textarea
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension (optional)…"
              rows={3}
              style={{ ...S.input, resize: "vertical" as any }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setSuspendModal(null)}
                style={{ ...S.btn("255,255,255"), color: "rgba(232,238,255,0.6)" }}>
                Cancel
              </button>
              <button
                onClick={() => suspend.mutate({ id: suspendModal.id, reason: suspendReason })}
                disabled={suspend.isPending}
                style={{ ...S.btn("251,113,133"), color: "#FB7185", opacity: suspend.isPending ? 0.5 : 1 }}>
                Suspend
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

// Bug 4a fix: Added "testimonials" tab entry to TABS array
const TABS = [
  { id: "overview",      label: "Overview",                  icon: BarChart2,    minRole: "support"     },
  { id: "users",         label: "Users",                     icon: Users,        minRole: "support"     },
  { id: "staff",         label: "Staff",                     icon: UserCheck,    minRole: "admin"       },
  { id: "payments",      label: "Payments",                  icon: CreditCard,   minRole: "support"     },
  { id: "withdrawals",   label: "Withdrawals",               icon: Activity,     minRole: "admin"       },
  { id: "audit-log",     label: "Audit Log",                 icon: ClipboardList,minRole: "admin"       },
  { id: "system",        label: "System",                    icon: Settings2,    minRole: "operator"    },
  { id: "announcements", label: "Announcements",             icon: Megaphone,    minRole: "admin"       },
  { id: "demo-video",    label: "Demo Video",                icon: Video,        minRole: "super_admin" },
  { id: "support",       label: "Support",                   icon: LifeBuoy,     minRole: "admin"       },
  { id: "sa-assistant",  label: "SA Assistant",              icon: Crown,        minRole: "super_admin" },
  { id: "approvals",     label: "Approvals",                 icon: CheckCircle2, minRole: "super_admin" },
  { id: "testimonials",  label: "Testimonials",              icon: Star,         minRole: "admin"       },
  { id: "affiliates",    label: "Affiliate Applications",    icon: UserCheck,    minRole: "super_admin" },
];


import { hasRole } from "../lib/rbac";
import SuperAdminAssistant from "../components/SuperAdminAssistant";

export default function SuperAdmin() {
  const { user } = useAuth();
  const userRole = user?.role ?? "user";
  const [activeTab, setActiveTab] = useState("overview");
  const [clockTime, setClockTime] = useState(() => new Date());

  useStaffHeartbeat();

  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: pendingApprovalsData } = useQuery({
    queryKey: ["approvals-badge", "pending"],
    queryFn: () => approvalsAPI.list({ status: "pending" }),
    refetchInterval: 30_000,
    enabled: isSuperAdmin(userRole),
  });
  const pendingCount: number = (pendingApprovalsData as any)?.requests?.length ?? 0;

  const { data: pendingAffiliatesData } = useQuery({
    queryKey: ["affiliates-badge", "pending"],
    queryFn: () => superAdminAPI.affiliates.list("pending"),
    refetchInterval: 30_000,
    enabled: isSuperAdmin(userRole),
  });
  const pendingAffiliateCount: number = (pendingAffiliatesData as any)?.affiliates?.length ?? 0;

  // Bug 4a fix: fetch pending testimonials count for the badge
  const { data: pendingTestimonialsData } = useQuery({
    queryKey: ["testimonials-badge", "pending"],
    queryFn: () => {
      const token = localStorage.getItem("autoflowng_token") || sessionStorage.getItem("autoflowng_token");
      return fetch("/api/testimonials/admin/pending", {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : { testimonials: [] });
    },
    refetchInterval: 60_000,
    enabled: hasRole(userRole, "admin"),
  });
  const pendingTestimonialsCount: number = (pendingTestimonialsData as any)?.testimonials?.length ?? 0;

  const visibleTabs = TABS.filter(t => hasRole(userRole, t.minRole as PlatformRole));

  const renderTab = () => {
    switch (activeTab) {
      case "overview":      return <OverviewTab />;
      case "users":         return <UsersTab userRole={userRole} />;
      case "staff":         return <StaffTab userRole={userRole} />;
      case "payments":      return <PaymentsTab />;
      case "withdrawals":   return <WithdrawalsTab userRole={userRole} />;
      case "audit-log":     return <AuditLogTab />;
      case "system":        return <SystemTab />;
      case "announcements": return <AnnouncementManager />;
      case "demo-video":    return <DemoVideoManager />;
      case "support":       return <SupportAdminDashboard />;
      case "sa-assistant":  return <SuperAdminAssistant />;
      case "approvals":     return <ApprovalsTab />;
      // Bug 4a fix: render TestimonialsModerationPanel for the new "testimonials" tab
      case "testimonials":  return <TestimonialsModerationPanel />;
      case "affiliates":    return <AffiliateApplicationsTab />;
      default:              return <OverviewTab />;
    }
  };


  const activeLabel = TABS.find(t => t.id === activeTab)?.label ?? "";

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Crown size={20} color="#F59E0B" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em" }}>
                PLATFORM CONTROL
              </div>
              <h1 style={{ fontSize: "1.55rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", margin: 0 }}>
                Super Admin
              </h1>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              {/* Global clock */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 8, padding: "5px 10px" }}>
                <Clock size={11} color="#F59E0B" />
                {([
                  { tz: "Africa/Lagos",     label: "WAT" },
                  { tz: "UTC",              label: "UTC" },
                  { tz: "Europe/London",    label: "LON" },
                  { tz: "America/New_York", label: "NY"  },
                ] as const).map(({ tz, label }) => (
                  <span key={tz} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(245,158,11,0.55)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>
                      {clockTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: tz, hour12: false })}
                    </span>
                  </span>
                ))}
              </div>
              <OperationalAlertsBadge onClick={() => window.location.href = '/financial-integrity'} />
              <RoleBadge role={userRole} />
            </div>
          </div>
          <MFAEnforcementBanner role={userRole} className="mb-2" />
        </Reveal>

        <Reveal delay={30}>
          <style>{`
            @keyframes badge-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50%       { opacity: 0.75; transform: scale(0.92); }
            }
          `}</style>
          <div style={{ display: "flex", gap: 5, marginBottom: 22, flexWrap: "wrap" }}>
            {visibleTabs.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: active ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 10, padding: "7px 13px",
                    color: active ? "#F59E0B" : "rgba(232,238,255,0.5)",
                    fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                    fontFamily: "'DM Sans',sans-serif", transition: "all 0.16s",
                  }}>
                  <Icon size={13} /> {t.label}
                  {t.id === "approvals" && pendingCount > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 16, height: 16, borderRadius: 100,
                      background: active ? "#F59E0B" : "#FB7185", color: "#04060F",
                      fontSize: 9, fontWeight: 900, fontFamily: "'DM Mono',monospace",
                      padding: "0 4px", lineHeight: 1,
                      animation: "badge-pulse 2s ease-in-out infinite",
                    }}>
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                  {/* Bug 4a fix: testimonials pending badge */}
                  {t.id === "testimonials" && pendingTestimonialsCount > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 16, height: 16, borderRadius: 100,
                      background: active ? "#F59E0B" : "#A78BFA", color: "#04060F",
                      fontSize: 9, fontWeight: 900, fontFamily: "'DM Mono',monospace",
                      padding: "0 4px", lineHeight: 1,
                      animation: "badge-pulse 2s ease-in-out infinite",
                    }}>
                      {pendingTestimonialsCount > 99 ? "99+" : pendingTestimonialsCount}
                    </span>
                  )}
                  {t.id === "affiliates" && pendingAffiliateCount > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 16, height: 16, borderRadius: 100,
                      background: active ? "#F59E0B" : "#FB7185", color: "#04060F",
                      fontSize: 9, fontWeight: 900, fontFamily: "'DM Mono',monospace",
                      padding: "0 4px", lineHeight: 1,
                      animation: "badge-pulse 2s ease-in-out infinite",
                    }}>
                      {pendingAffiliateCount > 99 ? "99+" : pendingAffiliateCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div style={{ ...S.glass, minHeight: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {activeLabel}
            </div>
            {renderTab()}
          </div>
        </Reveal>
      </div>
    </PageTransition>
  );
}
