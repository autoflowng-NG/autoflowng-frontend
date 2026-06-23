/**
 * AutoFlowNG — Super Admin Dashboard (Phase 10A)
 *
 * Accessible by: super_admin, admin, operator (read-only sections), support (read-only)
 * Role-gated sections use canDo() checks to show/hide controls.
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminAPI } from "../lib/api";
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
  BarChart2, Globe, CheckCircle2, XCircle, MessageSquare,
  RefreshCw, Lock, Unlock, ClipboardList, Crown,
  Phone, MapPin, FileText, X as XIcon, Loader2,
  Megaphone, Video, LifeBuoy,
} from "lucide-react";
import PaystackBalanceWidget from "../components/PaystackBalanceWidget";
import MFAEnforcementBanner from "../components/MFAEnforcement";
import OperationalAlertsBadge from "../components/OperationalAlertsBadge";
import AnnouncementManager from "../components/AnnouncementManager";
import DemoVideoManager from "../components/DemoVideoManager";
import SupportAdminDashboard from "../components/SupportAdminDashboard";

// ── Shared Styles ──────────────────────────────────────────────────────────────

const S = {
  glass:   { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px" } as React.CSSProperties,
  label:   { fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 4 } as React.CSSProperties,
  value:   { fontSize: "1.5rem", fontWeight: 900, fontFamily: "'Syne',sans-serif" } as React.CSSProperties,
  muted:   { fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" } as React.CSSProperties,
  input:   { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 14px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  select:  { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px", color: "#E8EEFF", fontSize: 12, fontFamily: "'DM Mono',monospace", outline: "none" } as React.CSSProperties,
  btn:     (color: string) => ({ display: "flex", alignItems: "center", gap: 5, background: `rgba(${color},0.1)`, border: `1px solid rgba(${color},0.2)`, borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace" }) as React.CSSProperties,
  row:     { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" } as React.CSSProperties,
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

  if (!userId) return null;

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
      {/* Phase 10D: Paystack Balance Intelligence */}
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
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: u.is_active === false ? "rgba(251,113,133,0.2)" : "linear-gradient(135deg,#00C896,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#04060F", flexShrink: 0 }}>
              {(u.name || u.email || "?")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name || u.email}</div>
              <div style={S.muted}>{u.email} · {u.active_automations ?? 0} auto · {u.active_workflows ?? 0} wf</div>
            </div>

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
                <button onClick={() => unsuspend.mutate(u.id)}
                  style={{ ...S.btn("56,189,248"), color: "#38BDF8" }}>
                  <Unlock size={10} /> Restore
                </button>
              ) : (
                <button onClick={() => { if (window.confirm(`Suspend ${u.email}?`)) suspend.mutate({ id: u.id }); }}
                  style={{ ...S.btn("251,113,133"), color: "#FB7185" }}>
                  <Lock size={10} /> Suspend
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
        ))}
      </div>

      {(data as any)?.total > users.length && (
        <div style={{ textAlign: "center", padding: "12px", ...S.muted }}>
          Showing {users.length} of {(data as any).total} users
        </div>
      )}

      <UserProfileDrawer userId={viewingUserId} onClose={() => setViewingUserId(null)} />
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

// ── AI Chat Tab ────────────────────────────────────────────────────────────────

function AdminAITab() {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput]       = useState("");
  const { toast } = useToast();

  const chat = useMutation({
    mutationFn: (msgs: any[]) => superAdminAPI.chat({ messages: msgs }),
    onSuccess:  (data: any) => {
      const text = data?.content?.[0]?.text || data?.text || "No response";
      setMessages(m => [...m, { role: "assistant", text }]);
    },
    onError: (e: any) => toast({ title: "AI Error", description: e?.message, variant: "destructive" }),
  });

  const send = () => {
    if (!input.trim()) return;
    const updated = [...messages, { role: "user", text: input }];
    setMessages(updated);
    setInput("");
    chat.mutate(updated.map(m => ({ role: m.role, content: m.text })));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...S.glass, minHeight: 300, maxHeight: 480, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>
            Ask about platform metrics, user trends, revenue, or operational decisions.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ ...S.muted, textTransform: "uppercase" }}>{m.role === "user" ? "You" : "Supreme Admin AI"}</div>
            <div style={{
              maxWidth: "85%", padding: "10px 14px", borderRadius: 12,
              background: m.role === "user" ? "rgba(0,200,150,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${m.role === "user" ? "rgba(0,200,150,0.2)" : "rgba(255,255,255,0.08)"}`,
              fontSize: 13, color: "#E8EEFF", lineHeight: 1.5, whiteSpace: "pre-wrap", fontFamily: "'DM Sans',sans-serif",
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {chat.isPending && (
          <div style={{ display: "flex", gap: 4, padding: "8px 14px", alignSelf: "flex-start" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#A78BFA", animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          placeholder="Ask about platform health, metrics, users…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ ...S.input }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || chat.isPending}
          style={{ ...S.btn("167,139,250"), color: "#A78BFA", padding: "9px 18px", opacity: (!input.trim() || chat.isPending) ? 0.5 : 1 }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",     label: "Overview",     icon: BarChart2,    minRole: "support"     },
  { id: "users",        label: "Users",        icon: Users,        minRole: "support"     },
  { id: "staff",        label: "Staff",        icon: UserCheck,    minRole: "admin"       },
  { id: "payments",     label: "Payments",     icon: CreditCard,   minRole: "support"     },
  { id: "withdrawals",  label: "Withdrawals",  icon: Activity,     minRole: "admin"       },
  { id: "audit-log",    label: "Audit Log",    icon: ClipboardList,minRole: "admin"       },
  { id: "system",       label: "System",       icon: Settings2,    minRole: "operator"    },
  { id: "announcements",label: "Announcements",icon: Megaphone,    minRole: "admin"       },
  { id: "demo-video",   label: "Demo Video",   icon: Video,        minRole: "super_admin" },
  { id: "support",      label: "Support",      icon: LifeBuoy,     minRole: "admin"       },
  { id: "ai",           label: "Admin AI",     icon: MessageSquare,minRole: "admin"       },
  { id: "sa-assistant", label: "SA Assistant", icon: Crown,        minRole: "super_admin" },
];


import { hasRole } from "../lib/rbac";
import SuperAdminAssistant from "../components/SuperAdminAssistant";

export default function SuperAdmin() {
  const { user } = useAuth();
  const userRole = user?.role ?? "user";
  const [activeTab, setActiveTab] = useState("overview");

  useStaffHeartbeat();

  const visibleTabs = TABS.filter(t => hasRole(userRole, t.minRole as PlatformRole));

  const renderTab = () => {
    switch (activeTab) {
      case "overview":    return <OverviewTab />;
      case "users":       return <UsersTab userRole={userRole} />;
      case "staff":       return <StaffTab userRole={userRole} />;
      case "payments":    return <PaymentsTab />;
      case "withdrawals": return <WithdrawalsTab userRole={userRole} />;
      case "audit-log":   return <AuditLogTab />;
      case "system":      return <SystemTab />;
      case "ai":           return <AdminAITab />;
      case "announcements":return <AnnouncementManager />;
      case "demo-video":   return <DemoVideoManager />;
      case "support":      return <SupportAdminDashboard />;
      case "sa-assistant": return <SuperAdminAssistant />;
      default:             return <OverviewTab />;
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
                PLATFORM CONTROL — PHASE 10D
              </div>
              <h1 style={{ fontSize: "1.55rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", margin: 0 }}>
                Super Admin
              </h1>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <OperationalAlertsBadge onClick={() => window.location.href = '/financial-integrity'} />
              <RoleBadge role={userRole} />
            </div>
          </div>
          {/* Phase 10D: MFA enforcement banner */}
          <MFAEnforcementBanner role={userRole} className="mb-2" />
        </Reveal>

        <Reveal delay={30}>
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
