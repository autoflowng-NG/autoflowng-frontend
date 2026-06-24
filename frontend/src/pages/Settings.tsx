import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { authAPI } from "../lib/api";
import { NotificationPreferences } from "../components/NotificationPreferences";
import { PageTransition } from "../components/PageTransition";
import { useAuth } from "../contexts/AuthContext";
import { useOrg, type OrgRole, type OrgMember, type PendingInvitation } from "../contexts/OrgContext";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Bell, Shield, Trash2, Check, Eye, EyeOff, AlertCircle, Camera, Phone, MapPin, FileText, Building2, UserPlus, X, Mail, Clock, RefreshCw } from "lucide-react";

const TABS = [
  { id: "profile",   label: "Profile",   icon: User },
  { id: "security",  label: "Security",  icon: Lock },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account",   label: "Account",   icon: Shield },
];

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Extended profile state
  const [profile, setProfile] = useState({
    name:     user?.name  || "",
    email:    user?.email || "",
    phone:    (user as any)?.phone    || "",
    location: (user as any)?.location || "",
    address:  (user as any)?.address  || "",
    bio:      (user as any)?.bio      || "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>((user as any)?.avatar_url || null);

  // Fetch full profile on mount so extended fields are loaded
  React.useEffect(() => {
    const token = localStorage.getItem("autoflowng_token") || sessionStorage.getItem("autoflowng_token");
    fetch("/api/profile/me", { credentials: "include", headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setProfile({ name: d.name || "", email: d.email || "", phone: d.phone || "", location: d.location || "", address: d.address || "", bio: d.bio || "" });
        setAvatarUrl(d.avatar_url || null);
      })
      .catch(() => {});
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const token = localStorage.getItem("autoflowng_token") || sessionStorage.getItem("autoflowng_token");
      const res = await fetch("/api/profile/me/avatar", {
        method: "POST", credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAvatarUrl(data.avatar_url);
      toast({ title: "Profile photo updated!" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("autoflowng_token") || sessionStorage.getItem("autoflowng_token");
      const res = await fetch("/api/profile/me", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: profile.name, phone: profile.phone, location: profile.location, address: profile.address, bio: profile.bio }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Save failed"); }
      updateUser({ ...user, name: profile.name } as any);
      toast({ title: "Profile updated!" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10, padding: "11px 14px 11px 36px", color: "#E8EEFF", fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" as const };

  const iconWrap: React.CSSProperties = { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.3)", pointerEvents: "none" };

  return (
    <div>
      {/* Avatar row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, padding: "20px", background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#00C896,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#04060F" }}>
              {(profile.name || profile.email || "?")[0].toUpperCase()}
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: "50%", background: "#00C896", border: "2px solid #080A14", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Camera size={11} color="#04060F" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF" }}>{profile.name || "Your Name"}</div>
          <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace" }}>{profile.email}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 100, padding: "2px 8px", marginTop: 4, fontSize: 10, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace" }}>
            {((user?.plan || "FREE") as string).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Name + Email row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={lbl}>Full name</label>
          <div style={{ position: "relative" }}>
            <span style={iconWrap}><User size={14} /></span>
            <input data-testid="input-name" style={inp} value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.4)"} onBlur={e => e.target.style.borderColor = ""} />
          </div>
        </div>
        <div>
          <label style={lbl}>Email</label>
          <div style={{ position: "relative" }}>
            <span style={iconWrap}><User size={14} /></span>
            <input data-testid="input-email" type="email" style={{ ...inp, opacity: 0.6, cursor: "not-allowed" }} value={profile.email} readOnly title="Email cannot be changed here" />
          </div>
        </div>
      </div>

      {/* Phone + Location row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={lbl}>Phone</label>
          <div style={{ position: "relative" }}>
            <span style={iconWrap}><Phone size={14} /></span>
            <input style={inp} placeholder="+234 800 000 0000" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.4)"} onBlur={e => e.target.style.borderColor = ""} />
          </div>
        </div>
        <div>
          <label style={lbl}>Location</label>
          <div style={{ position: "relative" }}>
            <span style={iconWrap}><MapPin size={14} /></span>
            <input style={inp} placeholder="City, Country" value={profile.location} onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
              onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.4)"} onBlur={e => e.target.style.borderColor = ""} />
          </div>
        </div>
      </div>

      {/* Address */}
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Address</label>
        <div style={{ position: "relative" }}>
          <span style={iconWrap}><MapPin size={14} /></span>
          <input style={inp} placeholder="Full mailing address" value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
            onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.4)"} onBlur={e => e.target.style.borderColor = ""} />
        </div>
      </div>

      {/* Bio */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ ...lbl, display: "flex", justifyContent: "space-between" }}>
          <span><FileText size={11} style={{ display: "inline", marginRight: 4 }} />Bio</span>
          <span style={{ fontWeight: 400, opacity: 0.5 }}>{profile.bio.length}/500</span>
        </label>
        <textarea style={{ ...inp, paddingLeft: 14, resize: "vertical", minHeight: 88, lineHeight: 1.6 }}
          placeholder="Tell us about yourself…" value={profile.bio}
          onChange={e => setProfile(p => ({ ...p, bio: e.target.value.slice(0, 500) }))}
          onFocus={e => (e.target as any).style.borderColor = "rgba(0,200,150,0.4)"}
          onBlur={e => (e.target as any).style.borderColor = ""} />
      </div>

      <button data-testid="button-save-profile" onClick={handleSave} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 8, background: "#00C896", border: "none", borderRadius: 10, padding: "11px 22px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif" }}>
        <Check size={14} /> {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function SecurityTab() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>();

  const onSubmit = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast({ title: "Password updated successfully!" });
      reset();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "11px 42px 11px 14px", color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>Current Password</label>
        <div style={{ position: "relative" }}>
          <input data-testid="input-current-password" type={showOld ? "text" : "password"} style={inp} {...register("currentPassword", { required: true })} />
          <button type="button" onClick={() => setShowOld(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(232,238,255,0.4)", padding: 0 }}>{showOld ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>New Password</label>
        <div style={{ position: "relative" }}>
          <input data-testid="input-new-password" type={showNew ? "text" : "password"} style={inp} {...register("newPassword", { required: true, minLength: 6 })} />
          <button type="button" onClick={() => setShowNew(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(232,238,255,0.4)", padding: 0 }}>{showNew ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>
        {errors.newPassword && <p style={{ fontSize: 11, color: "#FB7185", marginTop: 4 }}>Min 6 characters</p>}
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>Confirm New Password</label>
        <input data-testid="input-confirm-password" type="password" style={{ ...inp, paddingRight: 14 }} {...register("confirmPassword", { required: true })} />
      </div>
      <button type="submit" data-testid="button-change-password" disabled={saving} style={{ display: "flex", alignItems: "center", gap: 8, background: "#00C896", border: "none", borderRadius: 10, padding: "11px 22px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif" }}>
        <Lock size={14} /> {saving ? "Updating…" : "Change Password"}
      </button>
    </form>
  );
}

function NotificationsTab() {
  const [settings, setSettings] = useState({ email_workflow: true, email_billing: true, email_security: true, push_runs: false });
  const { toast } = useToast();
  const rows = [
    { key: "email_workflow", label: "Workflow run results", desc: "Email when a workflow succeeds or fails" },
    { key: "email_billing",  label: "Billing & plan updates", desc: "Receipts and plan change confirmations" },
    { key: "email_security", label: "Security alerts",      desc: "New sign-ins and suspicious activity" },
    { key: "push_runs",      label: "Push: workflow runs",  desc: "Browser notifications for workflow runs" },
  ];
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map(r => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif" }}>{r.label}</div>
              <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)" }}>{r.desc}</div>
            </div>
            <button data-testid={`toggle-${r.key}`} onClick={() => setSettings(s => ({ ...s, [r.key]: !s[r.key as keyof typeof s] }))} style={{ width: 40, height: 22, borderRadius: 11, background: settings[r.key as keyof typeof settings] ? "#00C896" : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 2, left: settings[r.key as keyof typeof settings] ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => toast({ title: "Preferences saved!" })} data-testid="button-save-notifications" style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, background: "#00C896", border: "none", borderRadius: 10, padding: "11px 22px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
        <Check size={14} /> Save preferences
      </button>
    </div>
  );
}

function AccountTab() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
        <AlertCircle size={15} color="#FBBF24" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: "rgba(232,238,255,0.6)", lineHeight: 1.55 }}>
          Account deletion is permanent and cannot be undone. All your workflows, automations, and data will be permanently deleted.
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <button data-testid="button-logout" onClick={logout} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "11px 20px", color: "rgba(232,238,255,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginBottom: 12 }}>
          Sign out of all devices
        </button>
        {!confirming ? (
          <button data-testid="button-delete-account" onClick={() => setConfirming(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 10, padding: "11px 20px", color: "#FB7185", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
            <Trash2 size={14} /> Delete account
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button data-testid="button-confirm-delete" onClick={() => { toast({ title: "Contact support to delete your account.", description: "Email support@autoflowng.com" }); setConfirming(false); }} style={{ background: "#FB7185", border: "none", borderRadius: 10, padding: "11px 20px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Yes, delete</button>
            <button onClick={() => setConfirming(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "11px 20px", color: "rgba(232,238,255,0.4)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspaceTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeOrg, myRole, canDo, getMembers, inviteMember, changeRole, removeMember, resendInvite, revokeInvite } = useOrg();

  const [members,    setMembers]    = useState<OrgMember[]>([]);
  const [pending,    setPending]    = useState<PendingInvitation[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email,      setEmail]      = useState("");
  const [role,       setRole]       = useState<OrgRole>("viewer");
  const [inviting,   setInviting]   = useState(false);
  const [pendingAction, setPendingAction] = useState<number | null>(null); // invite id currently resending/revoking

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em", marginBottom: 6, display: "block" };
  const inp: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "11px 14px", color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" };

  const ROLE_BADGE: Record<OrgRole, string> = { owner: "#A78BFA", admin: "#38BDF8", operator: "#00C896", viewer: "#94A3B8" };

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    try {
      const data = await getMembers(activeOrg.id);
      setMembers(data.members || []);
      setPending(data.pending_invitations || []);
    } catch (e: any) {
      toast({ title: "Couldn't load members", description: e?.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeOrg?.id]);

  // BUGFIX: this whole tab is new — previously there was no way for a user
  // to invite teammates into a workspace at all, even though the backend
  // (routes/organizations.js) has fully working invite/member-management
  // routes. See OrgContext.tsx for the API wiring this calls into.
  if (!activeOrg) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <Building2 size={28} color="rgba(232,238,255,0.2)" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14, color: "rgba(232,238,255,0.5)", marginBottom: 4 }}>You're in your personal workspace</div>
        <div style={{ fontSize: 12, color: "rgba(232,238,255,0.3)" }}>Create or switch to a team workspace from the sidebar to manage members.</div>
      </div>
    );
  }

  const canManage = canDo("manage_members");

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      await inviteMember(activeOrg.id, email.trim(), role);
      toast({ title: "Invitation sent", description: `${email} will receive an email to join ${activeOrg.name}.` });
      setEmail(""); setRole("viewer"); setInviteOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Couldn't send invitation", description: e?.message, variant: "destructive" });
    } finally { setInviting(false); }
  };

  const handleRoleChange = async (userId: number, newRole: OrgRole) => {
    try {
      await changeRole(activeOrg.id, userId, newRole);
      toast({ title: "Role updated" });
      load();
    } catch (e: any) {
      toast({ title: "Couldn't update role", description: e?.message, variant: "destructive" });
    }
  };

  const handleRemove = async (userId: number, name: string) => {
    if (!window.confirm(`Remove ${name} from ${activeOrg.name}?`)) return;
    try {
      await removeMember(activeOrg.id, userId);
      toast({ title: "Member removed" });
      load();
    } catch (e: any) {
      toast({ title: "Couldn't remove member", description: e?.message, variant: "destructive" });
    }
  };

  // BUGFIX: resend previously generated a new token but never actually
  // sent an email (fixed in routes/organizations.js); revoke didn't exist
  // as an endpoint at all. Both are now wired through here.
  const handleResend = async (invId: number, inviteeEmail: string) => {
    setPendingAction(invId);
    try {
      await resendInvite(activeOrg.id, invId);
      toast({ title: "Invitation resent", description: `A new email was sent to ${inviteeEmail}.` });
      load();
    } catch (e: any) {
      toast({ title: "Couldn't resend invitation", description: e?.message, variant: "destructive" });
    } finally { setPendingAction(null); }
  };

  const handleRevoke = async (invId: number, inviteeEmail: string) => {
    if (!window.confirm(`Cancel the pending invite for ${inviteeEmail}?`)) return;
    setPendingAction(invId);
    try {
      await revokeInvite(activeOrg.id, invId);
      toast({ title: "Invitation cancelled" });
      load();
    } catch (e: any) {
      toast({ title: "Couldn't cancel invitation", description: e?.message, variant: "destructive" });
    } finally { setPendingAction(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>{activeOrg.name}</div>
          <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", marginTop: 2 }}>
            {members.length} member{members.length !== 1 ? "s" : ""} · your role: <span style={{ color: ROLE_BADGE[myRole || "viewer"], fontWeight: 700 }}>{myRole}</span>
          </div>
        </div>
        {canManage && (
          <button data-testid="button-invite-member" onClick={() => setInviteOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 10, padding: "9px 16px", color: "#A78BFA", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
            <UserPlus size={13} /> Invite member
          </button>
        )}
      </div>

      {!canManage && (
        <div style={{ display: "flex", gap: 8, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 20, fontSize: 12, color: "rgba(232,238,255,0.6)" }}>
          <AlertCircle size={14} color="#38BDF8" style={{ flexShrink: 0, marginTop: 1 }} />
          Only admins and owners can invite or manage members. You can view the team below.
        </div>
      )}

      {inviteOpen && canManage && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={lbl}>Email address</label>
              <div style={{ position: "relative" }}>
                <Mail size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.3)" }} />
                <input style={{ ...inp, paddingLeft: 36 }} placeholder="teammate@email.com" value={email}
                  onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleInvite()} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={lbl}>Role</label>
              <select style={inp} value={role} onChange={e => setRole(e.target.value as OrgRole)}>
                <option value="viewer">Viewer — view only</option>
                <option value="operator">Operator — run workflows</option>
                {myRole === "owner" && <option value="admin">Admin — manage team</option>}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button data-testid="button-send-invite" onClick={handleInvite} disabled={inviting || !email.trim()}
              style={{ background: "#00C896", border: "none", borderRadius: 10, padding: "10px 20px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: inviting ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", opacity: inviting || !email.trim() ? 0.5 : 1 }}>
              {inviting ? "Sending…" : "Send invite"}
            </button>
            <button onClick={() => setInviteOpen(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 20px", color: "rgba(232,238,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Member list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: pending.length ? 24 : 0 }}>
        {loading && <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", padding: "12px 0" }}>Loading members…</div>}
        {!loading && members.map(m => (
          <div key={m.user_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#00C896,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#04060F", flexShrink: 0 }}>
                {(m.user_name || m.email || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF" }}>{m.user_name || m.email}{m.email === user?.email && <span style={{ color: "rgba(232,238,255,0.3)", fontWeight: 400 }}> (you)</span>}</div>
                <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)" }}>{m.email}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {canManage && m.role !== "owner" ? (
                <select value={m.role} onChange={e => handleRoleChange(m.user_id, e.target.value as OrgRole)}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "5px 8px", color: ROLE_BADGE[m.role], fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>
                  <option value="viewer">viewer</option>
                  <option value="operator">operator</option>
                  {myRole === "owner" && <option value="admin">admin</option>}
                </select>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, color: ROLE_BADGE[m.role], fontFamily: "'DM Mono',monospace", textTransform: "uppercase" as const }}>{m.role}</span>
              )}
              {canManage && m.role !== "owner" && (
                <button onClick={() => handleRemove(m.user_id, m.user_name || m.email)} style={{ background: "transparent", border: "none", color: "rgba(251,113,133,0.6)", cursor: "pointer", padding: 4, display: "flex" }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pending invitations */}
      {pending.length > 0 && (
        <div>
          <div style={{ ...lbl, marginBottom: 10 }}>PENDING INVITATIONS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map(inv => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)", borderRadius: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={13} color="#FBBF24" />
                  <span style={{ fontSize: 13, color: "#E8EEFF" }}>{inv.email}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_BADGE[inv.role], fontFamily: "'DM Mono',monospace", textTransform: "uppercase" as const }}>{inv.role}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, color: "rgba(232,238,255,0.35)" }}>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                  {canManage && (
                    <>
                      <button data-testid={`button-resend-invite-${inv.id}`} onClick={() => handleResend(inv.id, inv.email)} disabled={pendingAction === inv.id}
                        title="Resend invite email"
                        style={{ background: "transparent", border: "none", color: "rgba(56,189,248,0.7)", cursor: pendingAction === inv.id ? "not-allowed" : "pointer", padding: 4, display: "flex", opacity: pendingAction === inv.id ? 0.4 : 1 }}>
                        <RefreshCw size={13} style={pendingAction === inv.id ? { animation: "spin 1s linear infinite" } : undefined} />
                      </button>
                      <button data-testid={`button-revoke-invite-${inv.id}`} onClick={() => handleRevoke(inv.id, inv.email)} disabled={pendingAction === inv.id}
                        title="Cancel invite"
                        style={{ background: "transparent", border: "none", color: "rgba(251,113,133,0.6)", cursor: pendingAction === inv.id ? "not-allowed" : "pointer", padding: 4, display: "flex", opacity: pendingAction === inv.id ? 0.4 : 1 }}>
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TAB_CONTENT: Record<string, React.FC> = { profile: ProfileTab, security: SecurityTab, workspace: WorkspaceTab, notifications: NotificationsTab, account: AccountTab };

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const Content = TAB_CONTENT[activeTab] || ProfileTab;

  return (
    <PageTransition variant="slide">
    <div style={{ padding: "32px", maxWidth: 800, margin: "0 auto" }}>
      <Reveal>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>ACCOUNT</div>
          <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>Settings</h1>
        </div>
      </Reveal>
      <div style={{ display: "flex", gap: 24 }}>
        {/* Sidebar nav */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {TABS.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button key={t.id} data-testid={`settings-tab-${t.id}`} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: active ? "rgba(167,139,250,0.1)" : "transparent", border: `1px solid ${active ? "rgba(167,139,250,0.2)" : "transparent"}`, borderRadius: 10, cursor: "pointer", color: active ? "#A78BFA" : "rgba(232,238,255,0.5)", fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: "'DM Sans',sans-serif", textAlign: "left", transition: "all 0.18s" }}>
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="af-glass" style={{ borderRadius: 18, padding: "28px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {TABS.find(t => t.id === activeTab)?.label}
            </div>
            <Content />
          </div>
        </div>
      </div>
    </div>
      <div style={{ marginTop: 24 }}><NotificationPreferences /></div>
</PageTransition>
  );
}
