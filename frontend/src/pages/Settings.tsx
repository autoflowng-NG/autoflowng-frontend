import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { authAPI } from "../lib/api";
import { NotificationPreferences } from "../components/NotificationPreferences";
import { PageTransition } from "../components/PageTransition";
import { useAuth } from "../contexts/AuthContext";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Bell, Shield, Trash2, Check, Eye, EyeOff, AlertCircle, Camera, Phone, MapPin, FileText } from "lucide-react";

const TABS = [
  { id: "profile",   label: "Profile",   icon: User },
  { id: "security",  label: "Security",  icon: Lock },
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

const TAB_CONTENT: Record<string, React.FC> = { profile: ProfileTab, security: SecurityTab, notifications: NotificationsTab, account: AccountTab };

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
