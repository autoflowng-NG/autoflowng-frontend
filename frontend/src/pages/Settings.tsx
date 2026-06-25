/**
 * Settings — Enterprise Redesign
 *
 * All hooks, API calls, mutations, imports, and logic preserved exactly.
 * Visual layer only: design tokens, card wrappers, tab sidebar, accent lines.
 * Profile tab remains inside Settings (not a separate page).
 */

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { authAPI } from "../lib/api";
import { NotificationPreferences } from "../components/NotificationPreferences";
import { PageTransition } from "../components/PageTransition";
import { useAuth } from "../contexts/AuthContext";
import { useOrg, type OrgRole, type OrgMember, type PendingInvitation } from "../contexts/OrgContext";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import {
  User, Lock, Bell, Shield, Trash2, Check, Eye, EyeOff,
  AlertCircle, Camera, Phone, MapPin, FileText, Building2,
  UserPlus, X, Mail, Clock, RefreshCw,
} from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:      "#060810",
  surface: "#0C0F1A",
  raised:  "#111520",
  border:  "rgba(255,255,255,0.06)",
  text:    "#E2E8FF",
  muted:   "rgba(226,232,255,0.45)",
  faint:   "rgba(226,232,255,0.22)",
  green:   "#00C896",
  blue:    "#38BDF8",
  purple:  "#A78BFA",
  amber:   "#FBBF24",
  red:     "#FB7185",
};

/* ── Shared input style ─────────────────────────────────────────────── */
const baseInp: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 10,
  padding: "11px 14px",
  color: C.text,
  fontSize: 14,
  fontFamily: "'DM Sans',sans-serif",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.18s",
};

const withIconInp: React.CSSProperties = { ...baseInp, paddingLeft: 36 };

/* ── Shared label style ─────────────────────────────────────────────── */
const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: C.muted,
  fontFamily: "'DM Mono',monospace",
  letterSpacing: "0.06em",
  marginBottom: 7,
  textTransform: "uppercase",
};

/* ── Icon wrap inside inputs ────────────────────────────────────────── */
const iconWrap: React.CSSProperties = {
  position: "absolute",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  color: C.faint,
  pointerEvents: "none",
};

/* ── Accent line ────────────────────────────────────────────────────── */
function AccentLine({ color }: { color: string }) {
  return (
    <div style={{
      height: 1,
      background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
      marginBottom: 20,
    }} />
  );
}

/* ── Card ───────────────────────────────────────────────────────────── */
function Card({ children, style = {}, accent }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
}) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "20px",
      ...style,
    }}>
      {accent && <AccentLine color={accent} />}
      {children}
    </div>
  );
}

/* ── Save button ────────────────────────────────────────────────────── */
function SaveBtn({ onClick, loading, label = "Save changes", icon }: {
  onClick?: () => void; loading?: boolean; label?: string; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: C.green, border: "none", borderRadius: 10,
        padding: "11px 22px", color: "#04060F", fontSize: 13,
        fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "'DM Sans',sans-serif", opacity: loading ? 0.7 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {icon || <Check size={14} />} {loading ? "Saving…" : label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PROFILE TAB
══════════════════════════════════════════════════════════════════════ */
function ProfileTab() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({
    name:     user?.name  || "",
    email:    user?.email || "",
    phone:    (user as any)?.phone    || "",
    location: (user as any)?.location || "",
    address:  (user as any)?.address  || "",
    bio:      (user as any)?.bio      || "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>((user as any)?.avatar_url || null);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Avatar card */}
      <Card accent={C.green} style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.border}` }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#00C896,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#04060F" }}>
              {(profile.name || profile.email || "?")[0].toUpperCase()}
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%", background: C.green, border: `2px solid ${C.surface}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Camera size={11} color="#04060F" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: C.text }}>{profile.name || "Your Name"}</div>
          <div style={{ fontSize: 12, color: C.faint, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{profile.email}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 100, padding: "2px 9px", marginTop: 6, fontSize: 10, fontWeight: 700, color: C.green, fontFamily: "'DM Mono',monospace" }}>
            {((user?.plan || "FREE") as string).toUpperCase()}
          </div>
        </div>
      </Card>

      {/* Name + Email */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={lbl}>Full name</label>
          <div style={{ position: "relative" }}>
            <span style={iconWrap}><User size={13} /></span>
            <input data-testid="input-name" style={withIconInp} value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.4)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"} />
          </div>
        </div>
        <div>
          <label style={lbl}>Email</label>
          <div style={{ position: "relative" }}>
            <span style={iconWrap}><Mail size={13} /></span>
            <input data-testid="input-email" type="email" style={{ ...withIconInp, opacity: 0.5, cursor: "not-allowed" }} value={profile.email} readOnly title="Email cannot be changed here" />
          </div>
        </div>
      </div>

      {/* Phone + Location */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={lbl}>Phone</label>
          <div style={{ position: "relative" }}>
            <span style={iconWrap}><Phone size={13} /></span>
            <input style={withIconInp} placeholder="+234 800 000 0000" value={profile.phone}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.4)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"} />
          </div>
        </div>
        <div>
          <label style={lbl}>Location</label>
          <div style={{ position: "relative" }}>
            <span style={iconWrap}><MapPin size={13} /></span>
            <input style={withIconInp} placeholder="City, Country" value={profile.location}
              onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
              onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.4)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"} />
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <label style={lbl}>Address</label>
        <div style={{ position: "relative" }}>
          <span style={iconWrap}><MapPin size={13} /></span>
          <input style={withIconInp} placeholder="Full mailing address" value={profile.address}
            onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
            onFocus={e => e.target.style.borderColor = "rgba(0,200,150,0.4)"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"} />
        </div>
      </div>

      {/* Bio */}
      <div>
        <label style={{ ...lbl, display: "flex", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><FileText size={10} />Bio</span>
          <span style={{ fontWeight: 400, opacity: 0.5 }}>{profile.bio.length}/500</span>
        </label>
        <textarea
          style={{ ...baseInp, resize: "vertical", minHeight: 88, lineHeight: 1.6 }}
          placeholder="Tell us about yourself…"
          value={profile.bio}
          onChange={e => setProfile(p => ({ ...p, bio: e.target.value.slice(0, 500) }))}
          onFocus={e => (e.target as any).style.borderColor = "rgba(0,200,150,0.4)"}
          onBlur={e => (e.target as any).style.borderColor = "rgba(255,255,255,0.09)"}
        />
      </div>

      <div>
        <SaveBtn onClick={handleSave} loading={saving} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SECURITY TAB
══════════════════════════════════════════════════════════════════════ */
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

  const pwInp: React.CSSProperties = { ...baseInp, paddingRight: 42 };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Info banner */}
      <div style={{ display: "flex", gap: 10, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.14)", borderRadius: 12, padding: "12px 16px" }}>
        <Lock size={14} color={C.blue} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
          Use a strong, unique password at least 8 characters long. We recommend a password manager.
        </div>
      </div>

      <div>
        <label style={lbl}>Current Password</label>
        <div style={{ position: "relative" }}>
          <input data-testid="input-current-password" type={showOld ? "text" : "password"} style={pwInp} {...register("currentPassword", { required: true })} />
          <button type="button" onClick={() => setShowOld(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.faint, padding: 0 }}>
            {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div>
        <label style={lbl}>New Password</label>
        <div style={{ position: "relative" }}>
          <input data-testid="input-new-password" type={showNew ? "text" : "password"} style={pwInp} {...register("newPassword", { required: true, minLength: 6 })} />
          <button type="button" onClick={() => setShowNew(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.faint, padding: 0 }}>
            {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {errors.newPassword && <p style={{ fontSize: 11, color: C.red, marginTop: 5 }}>Minimum 6 characters required</p>}
      </div>

      <div>
        <label style={lbl}>Confirm New Password</label>
        <input data-testid="input-confirm-password" type="password" style={baseInp} {...register("confirmPassword", { required: true })} />
      </div>

      <div>
        <button type="submit" data-testid="button-change-password" disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 8, background: C.green, border: "none", borderRadius: 10, padding: "11px 22px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", opacity: saving ? 0.7 : 1 }}>
          <Lock size={14} /> {saving ? "Updating…" : "Change Password"}
        </button>
      </div>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   NOTIFICATIONS TAB
══════════════════════════════════════════════════════════════════════ */
function NotificationsTab() {
  const [settings, setSettings] = useState({ email_workflow: true, email_billing: true, email_security: true, push_runs: false });
  const { toast } = useToast();

  const rows = [
    { key: "email_workflow", label: "Workflow run results",  desc: "Email when a workflow succeeds or fails",   color: C.green },
    { key: "email_billing",  label: "Billing & plan updates", desc: "Receipts and plan change confirmations",  color: C.purple },
    { key: "email_security", label: "Security alerts",       desc: "New sign-ins and suspicious activity",     color: C.amber },
    { key: "push_runs",      label: "Push: workflow runs",   desc: "Browser notifications for workflow runs",  color: C.blue },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {rows.map(r => (
        <div key={r.key} style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "16px 18px",
          background: C.raised,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          transition: "border-color 0.15s",
        }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.11)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = C.border}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0, boxShadow: `0 0 6px ${r.color}80` }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>{r.label}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{r.desc}</div>
          </div>
          <button
            data-testid={`toggle-${r.key}`}
            onClick={() => setSettings(s => ({ ...s, [r.key]: !s[r.key as keyof typeof s] }))}
            style={{
              width: 42, height: 24, borderRadius: 12,
              background: settings[r.key as keyof typeof settings] ? C.green : "rgba(255,255,255,0.08)",
              border: "none", cursor: "pointer", position: "relative", flexShrink: 0,
              transition: "background 0.2s",
            }}>
            <div style={{
              position: "absolute", top: 3,
              left: settings[r.key as keyof typeof settings] ? 21 : 3,
              width: 18, height: 18, borderRadius: "50%",
              background: "white", transition: "left 0.2s",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }} />
          </button>
        </div>
      ))}

      <div>
        <button
          onClick={() => toast({ title: "Preferences saved!" })}
          data-testid="button-save-notifications"
          style={{ display: "flex", alignItems: "center", gap: 8, background: C.green, border: "none", borderRadius: 10, padding: "11px 22px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          <Check size={14} /> Save preferences
        </button>
      </div>

      {/* NotificationPreferences extended component */}
      <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
        <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 12 }}>ADVANCED NOTIFICATION SETTINGS</div>
        <NotificationPreferences />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ACCOUNT TAB
══════════════════════════════════════════════════════════════════════ */
function AccountTab() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Warning */}
      <div style={{ display: "flex", gap: 10, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 12, padding: "14px 16px" }}>
        <AlertCircle size={15} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          Account deletion is permanent and cannot be undone. All your workflows, automations, and data will be permanently deleted.
        </div>
      </div>

      {/* Sign out */}
      <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif", marginBottom: 4 }}>Sign out</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Sign out of all active sessions across all devices.</div>
        <button
          data-testid="button-logout"
          onClick={logout}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 18px", color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          Sign out of all devices
        </button>
      </div>

      {/* Delete account */}
      <div style={{ background: "rgba(251,113,133,0.04)", border: "1px solid rgba(251,113,133,0.12)", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.red, fontFamily: "'Syne',sans-serif", marginBottom: 4 }}>Danger zone</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>This action is irreversible. Please be certain before proceeding.</div>
        {!confirming ? (
          <button
            data-testid="button-delete-account"
            onClick={() => setConfirming(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 10, padding: "10px 18px", color: C.red, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
            <Trash2 size={14} /> Delete account
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              data-testid="button-confirm-delete"
              onClick={() => { toast({ title: "Contact support to delete your account.", description: "Email support@autoflowng.com" }); setConfirming(false); }}
              style={{ background: C.red, border: "none", borderRadius: 10, padding: "10px 18px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              Yes, delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 18px", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   WORKSPACE TAB
══════════════════════════════════════════════════════════════════════ */
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
  const [pendingAction, setPendingAction] = useState<number | null>(null);

  const ROLE_BADGE: Record<OrgRole, string> = { owner: C.purple, admin: C.blue, operator: C.green, viewer: "#94A3B8" };

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

  if (!activeOrg) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Building2 size={22} color={C.faint} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.muted, marginBottom: 6, fontFamily: "'Syne',sans-serif" }}>Personal workspace</div>
        <div style={{ fontSize: 12, color: C.faint }}>Create or switch to a team workspace from the sidebar to manage members.</div>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif" }}>{activeOrg.name}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {members.length} member{members.length !== 1 ? "s" : ""} · role: <span style={{ color: ROLE_BADGE[myRole || "viewer"], fontWeight: 700 }}>{myRole}</span>
          </div>
        </div>
        {canManage && (
          <button data-testid="button-invite-member" onClick={() => setInviteOpen(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 10, padding: "9px 16px", color: C.purple, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
            <UserPlus size={13} /> Invite member
          </button>
        )}
      </div>

      {!canManage && (
        <div style={{ display: "flex", gap: 8, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 10, padding: "12px 14px" }}>
          <AlertCircle size={14} color={C.blue} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: C.muted }}>Only admins and owners can invite or manage members.</span>
        </div>
      )}

      {/* Invite form */}
      {inviteOpen && canManage && (
        <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={lbl}>Email address</label>
              <div style={{ position: "relative" }}>
                <Mail size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.faint }} />
                <input style={withIconInp} placeholder="teammate@email.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleInvite()} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={lbl}>Role</label>
              <select style={baseInp} value={role} onChange={e => setRole(e.target.value as OrgRole)}>
                <option value="viewer">Viewer — view only</option>
                <option value="operator">Operator — run workflows</option>
                {myRole === "owner" && <option value="admin">Admin — manage team</option>}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button data-testid="button-send-invite" onClick={handleInvite} disabled={inviting || !email.trim()}
              style={{ background: C.green, border: "none", borderRadius: 10, padding: "10px 20px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: inviting ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", opacity: inviting || !email.trim() ? 0.5 : 1 }}>
              {inviting ? "Sending…" : "Send invite"}
            </button>
            <button onClick={() => setInviteOpen(false)}
              style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 20px", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {loading && <div style={{ fontSize: 12, color: C.muted, padding: "12px 0" }}>Loading members…</div>}
        {!loading && members.map(m => (
          <div key={m.user_id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px",
            background: C.raised,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            transition: "border-color 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = C.border}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#00C896,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#04060F", flexShrink: 0 }}>
                {(m.user_name || m.email || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  {m.user_name || m.email}
                  {m.email === user?.email && <span style={{ color: C.faint, fontWeight: 400 }}> (you)</span>}
                </div>
                <div style={{ fontSize: 11, color: C.faint }}>{m.email}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {canManage && m.role !== "owner" ? (
                <select value={m.role} onChange={e => handleRoleChange(m.user_id, e.target.value as OrgRole)}
                  style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", color: ROLE_BADGE[m.role], fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>
                  <option value="viewer">viewer</option>
                  <option value="operator">operator</option>
                  {myRole === "owner" && <option value="admin">admin</option>}
                </select>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_BADGE[m.role], fontFamily: "'DM Mono',monospace", textTransform: "uppercase", background: `${ROLE_BADGE[m.role]}15`, border: `1px solid ${ROLE_BADGE[m.role]}30`, borderRadius: 100, padding: "2px 9px" }}>
                  {m.role}
                </span>
              )}
              {canManage && m.role !== "owner" && (
                <button onClick={() => handleRemove(m.user_id, m.user_name || m.email)}
                  style={{ background: "transparent", border: "none", color: "rgba(251,113,133,0.5)", cursor: "pointer", padding: 4, display: "flex" }}>
                  <X size={13} />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pending.map(inv => (
              <div key={inv.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 14px",
                background: "rgba(251,191,36,0.04)",
                border: "1px solid rgba(251,191,36,0.12)",
                borderRadius: 10,
                flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={12} color={C.amber} />
                  <span style={{ fontSize: 13, color: C.text }}>{inv.email}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_BADGE[inv.role], fontFamily: "'DM Mono',monospace", textTransform: "uppercase", background: `${ROLE_BADGE[inv.role]}15`, borderRadius: 100, padding: "2px 7px" }}>{inv.role}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, color: C.faint }}>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
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
                        <X size={13} />
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

/* ── Tab registry ───────────────────────────────────────────────────── */
const TABS = [
  { id: "profile",       label: "Profile",       icon: User,     color: C.green },
  { id: "security",      label: "Security",      icon: Lock,     color: C.blue },
  { id: "workspace",     label: "Workspace",     icon: Building2,color: C.purple },
  { id: "notifications", label: "Notifications", icon: Bell,     color: C.amber },
  { id: "account",       label: "Account",       icon: Shield,   color: C.red },
];

const TAB_CONTENT: Record<string, React.FC> = {
  profile: ProfileTab,
  security: SecurityTab,
  workspace: WorkspaceTab,
  notifications: NotificationsTab,
  account: AccountTab,
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════ */
export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const Content = TAB_CONTENT[activeTab] || ProfileTab;
  const activeColor = TABS.find(t => t.id === activeTab)?.color || C.purple;

  return (
    <PageTransition variant="slide">
      <style>{`
        @keyframes af-skeleton-pulse {
          0%,100% { opacity:1 } 50% { opacity:0.45 }
        }
      `}</style>

      <div style={{ padding: "32px", maxWidth: 900, margin: "0 auto", background: C.bg, minHeight: "100vh" }}>
        {/* Page header */}
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>ACCOUNT</div>
            <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: C.text, margin: 0 }}>Settings</h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Manage your profile, security, team, and notification preferences.</p>
          </div>
        </Reveal>

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          {/* Sidebar nav */}
          <div style={{ width: 188, flexShrink: 0 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              {TABS.map((t, i) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    data-testid={`settings-tab-${t.id}`}
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%",
                      padding: "12px 16px",
                      background: active ? `${t.color}12` : "transparent",
                      border: "none",
                      borderLeft: `3px solid ${active ? t.color : "transparent"}`,
                      borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                      cursor: "pointer",
                      color: active ? t.color : C.muted,
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      fontFamily: "'DM Sans',sans-serif",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: "24px",
            }}>
              {/* Card accent line in active tab color */}
              <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${activeColor}60, transparent)`, marginBottom: 20 }} />

              {/* Section title */}
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif", marginBottom: 6 }}>
                {TABS.find(t => t.id === activeTab)?.label}
              </div>
              <div style={{ height: 1, background: C.border, marginBottom: 22 }} />

              <Content />
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
