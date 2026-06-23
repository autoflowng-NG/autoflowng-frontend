/**
 * Profile — Phase 37
 *
 * Full profile management: avatar upload, display name, phone,
 * location, address, bio. Two-column layout on desktop.
 */

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useLocation } from "wouter";
import {
  Shield, ChevronRight, Mail, Calendar,
  Building2, Loader2, CheckCircle2, AlertCircle,
  Camera, Trash2, MapPin, Phone, FileText, User,
} from "lucide-react";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";

// ── Styles ─────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: "24px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#E8EEFF",
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  color: "rgba(232,238,255,0.35)",
  fontFamily: "'DM Mono', monospace",
  letterSpacing: "0.08em",
  marginBottom: 6,
  textTransform: "uppercase",
};

// ── Toast helper ───────────────────────────────────────────────────────────────

function Toast({ type, text, onDone }: { type: "success" | "error"; text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 18px", borderRadius: 12,
      background: type === "success" ? "rgba(0,200,150,0.12)" : "rgba(251,113,133,0.12)",
      border: `1px solid ${type === "success" ? "rgba(0,200,150,0.3)" : "rgba(251,113,133,0.3)"}`,
      color: type === "success" ? "#00C896" : "#FB7185",
      fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      animation: "slideUp 0.25s ease",
    }}>
      {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {text}
    </div>
  );
}

// ── Avatar card ────────────────────────────────────────────────────────────────

function AvatarCard({ profile, onRefetch }: { profile: any; onRefetch: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving]   = useState(false);
  const [toast, setToast]         = useState<{ type: "success" | "error"; text: string } | null>(null);

  const initials = (profile?.name || profile?.email || "?")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const token = localStorage.getItem("autoflowng_token") || sessionStorage.getItem("autoflowng_token");
      const res = await fetch("/api/profile/me/avatar", {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Upload failed");
      }
      setToast({ type: "success", text: "Avatar updated" });
      onRefetch();
    } catch (err: any) {
      setToast({ type: "error", text: err.message || "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Remove your profile picture?")) return;
    setRemoving(true);
    try {
      const token = localStorage.getItem("autoflowng_token") || sessionStorage.getItem("autoflowng_token");
      await fetch("/api/profile/me/avatar", {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      setToast({ type: "success", text: "Avatar removed" });
      onRefetch();
    } catch {
      setToast({ type: "error", text: "Failed to remove avatar" });
    } finally {
      setRemoving(false);
    }
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
      {/* Avatar */}
      <div style={{ position: "relative" }}>
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Profile"
            style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(0,200,150,0.3)" }}
          />
        ) : (
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "linear-gradient(135deg,#00C896,#38BDF8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 800, color: "#04060F",
            boxShadow: "0 8px 32px rgba(0,200,150,0.2)",
          }}>
            {initials}
          </div>
        )}
        {uploading && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "rgba(4,6,15,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Loader2 size={22} color="#00C896" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}
      </div>

      {/* Name + Role */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#E8EEFF" }}>
          {profile?.name || "—"}
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6,
          padding: "3px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 100,
          fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.5)",
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          <Shield size={10} />
          {profile?.role || "user"}
        </div>
      </div>

      {/* Upload / Remove buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.25)",
            borderRadius: 10, padding: "9px 16px", color: "#00C896",
            fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <Camera size={13} />
          {uploading ? "Uploading…" : "Upload Photo"}
        </button>

        {profile?.avatar_url && (
          <button
            onClick={handleRemove}
            disabled={removing}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.18)",
              borderRadius: 10, padding: "8px 16px", color: "#FB7185",
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              opacity: removing ? 0.6 : 1,
            }}
          >
            <Trash2 size={13} />
            {removing ? "Removing…" : "Remove Photo"}
          </button>
        )}

        <p style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", margin: 0, fontFamily: "'DM Mono', monospace" }}>
          Max 5 MB · JPEG, PNG, WEBP
        </p>
      </div>

      {/* Member since */}
      <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Member since</div>
        <div style={{ fontSize: 12, color: "#E8EEFF", fontFamily: "'DM Mono', monospace" }}>
          {formatDate(profile?.created_at)}
        </div>
      </div>

      {toast && (
        <Toast type={toast.type} text={toast.text} onDone={() => setToast(null)} />
      )}
    </div>
  );
}

// ── Edit form ──────────────────────────────────────────────────────────────────

function EditForm({ profile, onRefetch }: { profile: any; onRefetch: () => void }) {
  const [form, setForm] = useState({
    name:     profile?.name     || "",
    phone:    profile?.phone    || "",
    location: profile?.location || "",
    address:  profile?.address  || "",
    bio:      profile?.bio      || "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setForm({
      name:     profile?.name     || "",
      phone:    profile?.phone    || "",
      location: profile?.location || "",
      address:  profile?.address  || "",
      bio:      profile?.bio      || "",
    });
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("autoflowng_token") || sessionStorage.getItem("autoflowng_token");
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Save failed");
      }
      setToast({ type: "success", text: "Profile updated" });
      onRefetch();
    } catch (err: any) {
      setToast({ type: "error", text: err.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof typeof form,
    icon: React.ReactNode,
    opts?: { textarea?: boolean; maxLen?: number; placeholder?: string }
  ) => (
    <div>
      <label style={labelStyle}>
        {label}
      </label>
      {opts?.textarea ? (
        <div style={{ position: "relative" }}>
          <textarea
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value.slice(0, opts.maxLen || 500) }))}
            placeholder={opts.placeholder || label}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", minHeight: 96 }}
            onFocus={e => (e.target.style.borderColor = "rgba(0,200,150,0.4)")}
            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          <div style={{
            textAlign: "right", fontSize: 10, marginTop: 4,
            color: form[key].length >= (opts.maxLen || 500) * 0.9
              ? "#FB7185"
              : "rgba(232,238,255,0.25)",
            fontFamily: "'DM Mono', monospace",
          }}>
            {form[key].length} / {opts.maxLen || 500}
          </div>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.25)", pointerEvents: "none" }}>
            {icon}
          </span>
          <input
            type="text"
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            placeholder={opts?.placeholder || label}
            style={{ ...inputStyle, paddingLeft: 36 }}
            onFocus={e => (e.target.style.borderColor = "rgba(0,200,150,0.4)")}
            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne', sans-serif", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        Edit Profile
      </div>

      {field("Full Name",          "name",     <User size={14} />)}
      {field("Phone",              "phone",    <Phone size={14} />)}
      {field("Location",           "location", <MapPin size={14} />, { placeholder: "City, Country" })}
      {field("Address",            "address",  <MapPin size={14} />, { placeholder: "Full mailing address" })}
      {field("Bio",                "bio",      <FileText size={14} />, { textarea: true, maxLen: 500, placeholder: "Tell us about yourself…" })}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: "#00C896", color: "#04060F",
            border: "none", borderRadius: 10,
            padding: "10px 24px", fontWeight: 700, fontSize: 13,
            cursor: saving ? "default" : "pointer",
            fontFamily: "'DM Sans', sans-serif",
            display: "flex", alignItems: "center", gap: 8,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : "Save Changes"}
        </button>

        {/* Email (read-only) */}
        <div style={{ flex: 1, fontSize: 11, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono', monospace" }}>
          <Mail size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          {profile?.email}
        </div>
      </div>

      {toast && (
        <Toast type={toast.type} text={toast.text} onDone={() => setToast(null)} />
      )}
    </div>
  );
}

// ── Security section ───────────────────────────────────────────────────────────

function SecuritySection() {
  const { user } = useAuth();
  const [, nav] = useLocation();

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne', sans-serif", marginBottom: 14 }}>
        Security
      </div>
      <button
        onClick={() => nav("/mfa/setup")}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px", background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12,
          cursor: "pointer", color: "#E8EEFF", textAlign: "left",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={18} color="#00C896" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Two-Factor Authentication</div>
            <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", marginTop: 2 }}>Add an extra layer of security</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 800,
            color: user?.mfa_enabled ? "#00C896" : "#FBBF24",
            background: user?.mfa_enabled ? "rgba(0,200,150,0.1)" : "rgba(251,191,36,0.1)",
            padding: "3px 9px", borderRadius: 100,
          }}>
            {user?.mfa_enabled ? "ENABLED" : "DISABLED"}
          </span>
          <ChevronRight size={14} color="rgba(232,238,255,0.2)" />
        </div>
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Profile() {
  const qc = useQueryClient();

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile", "me"],
    queryFn:  () => {
      const token = localStorage.getItem("autoflowng_token") || sessionStorage.getItem("autoflowng_token");
      return fetch("/api/profile/me", {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
    },
  });

  const handleRefetch = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["profile", "me"] });
  };

  return (
    <PageTransition variant="slide">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{
        minHeight: "100vh",
        background: "#04060F",
        padding: "36px 24px",
        fontFamily: "'DM Sans', sans-serif",
        color: "#E8EEFF",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Reveal>
            <header style={{ marginBottom: 28 }}>
              <h1 style={{
                fontSize: "2rem", fontWeight: 900,
                fontFamily: "'Syne', sans-serif",
                letterSpacing: "-0.04em", marginBottom: 6,
              }}>
                My Profile
              </h1>
              <p style={{ color: "rgba(232,238,255,0.4)", fontSize: 13 }}>
                Manage your personal information and profile picture.
              </p>
            </header>
          </Reveal>

          <Reveal delay={30}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "clamp(220px, 30%, 280px) 1fr",
              gap: 20,
              alignItems: "start",
            }}>
              {/* Left col */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <AvatarCard profile={profile} onRefetch={handleRefetch} />
                {/* Account info */}
                <div style={{ ...card }}>
                  <div style={{ ...labelStyle, marginBottom: 10 }}>Account Info</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 2 }}>Plan</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>
                        {profile?.plan || "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 2 }}>Organization</div>
                      <div style={{ fontSize: 12, color: "#E8EEFF" }}>
                        {(profile as any)?.org_name || "Personal"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right col */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <EditForm profile={profile} onRefetch={handleRefetch} />
                <SecuritySection />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}
