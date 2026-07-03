/**
 * AutoFlowNG — Phase 43A: Media Cloud Page — Enterprise Redesign
 *
 * All hooks, state, API calls, and logic preserved exactly from the original.
 * Visual layer rewritten to the AutoFlowNG design system — inline styles only.
 *
 * Six-tab asset management UI:
 *   1. Library    — upload, search, grid view, asset detail drawer
 *   2. Governance — policies, compliance flags
 *   3. Brands     — brand profiles, rules, brand compliance checker
 *   4. Reviews    — pending/approved/rejected review requests
 *   5. Pub. Gates — publishing job approval gates
 *   6. Audit Log  — paginated org-wide audit trail
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Image as ImageIcon, Film, Music, FileText, LayoutTemplate, Tag, Package,
  Upload, Search, X, ChevronDown, ChevronUp, Check, AlertTriangle,
  Shield, BookMarked, ClipboardCheck, Send, Trash2, Archive, MessageSquare,
  Plus, ExternalLink, CalendarClock,
} from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:      "#060810",
  surface: "#0C0F1A",
  raised:  "#111520",
  border:  "rgba(255,255,255,0.06)",
  borderH: "rgba(255,255,255,0.11)",
  text:    "#E2E8FF",
  muted:   "rgba(226,232,255,0.45)",
  faint:   "rgba(226,232,255,0.22)",
  green:   "#00C896",
  blue:    "#38BDF8",
  purple:  "#A78BFA",
  amber:   "#FBBF24",
  red:     "#FB7185",
};

const FONT_HEAD = "'Syne',sans-serif";
const FONT_BODY = "'DM Sans',sans-serif";
const FONT_MONO = "'DM Mono',monospace";

// ── API helpers ───────────────────────────────────────────────────────────

const API = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${localStorage.getItem('autoflowng_token') || ''}`,
      ...(opts?.headers || {}),
    },
  }).then(r => r.json());

const formAPI = (path: string, body: FormData) =>
  fetch(`/api${path}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('autoflowng_token') || ''}` },
    body,
  }).then(r => r.json());

// ── Types ─────────────────────────────────────────────────────────────────

type AssetStatus   = 'active' | 'archived' | 'deleted' | 'pending_review';
type AssetType     = 'image' | 'video' | 'audio' | 'document' | 'template' | 'brand_asset' | 'other';
type Severity      = 'info' | 'warning' | 'critical';

interface Asset {
  id:              string;
  name:            string;
  asset_type:      AssetType;
  mime_type:       string;
  file_size_bytes: number;
  status:          AssetStatus;
  current_version: number;
  tags:            string[];
  public_url:      string | null;
  presigned_url?:  string;
  created_at:      string;
  updated_at:      string;
}

interface AssetVersion {
  id:             string;
  version_number: number;
  storage_key:    string;
  file_size_bytes:number;
  change_note:    string | null;
  created_by_name:string | null;
  created_at:     string;
}

interface ComplianceFlag {
  id:         string;
  flag_type:  string;
  severity:   Severity;
  message:    string;
  resolved:   boolean;
  created_at: string;
}

interface GovernancePolicy {
  id:             string;
  name:           string;
  asset_types:    string[];
  retention_days: number | null;
  archive_days:   number | null;
  is_active:      boolean;
  created_at:     string;
}

interface Brand {
  id:          string;
  name:        string;
  description: string | null;
  is_default:  boolean;
  status:      string;
}

interface BrandRule {
  id:        string;
  rule_type: string;
  rule_name: string;
  config:    Record<string, unknown>;
  is_active: boolean;
}

interface AuditEntry {
  id:           string;
  actor_name:   string | null;
  actor_email:  string | null;
  action:       string;
  asset_name:   string | null;
  detail:       Record<string, unknown>;
  created_at:   string;
}

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface ReviewRequest {
  id:               string;
  asset_id:         string;
  asset_name:       string | null;
  version_number:   number;
  status:           ReviewStatus;
  requested_by:     string;
  requester_name:   string | null;
  assigned_to:      string | null;
  assignee_name:    string | null;
  review_note:      string | null;
  rejection_reason: string | null;
  submitted_at:     string;
  reviewed_at:      string | null;
  reviewer_name:    string | null;
}

interface Comment {
  id:          string;
  asset_id:    string;
  author_id:   string;
  author_name: string | null;
  parent_id:   string | null;
  body:        string | null;
  mention_ids: string[];
  is_deleted:  boolean;
  created_at:  string;
  replies:     Comment[];
}

// ── Formatters ────────────────────────────────────────────────────────────

const fmtBytes = (b: number) => {
  if (b < 1024)       return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/* ── Shared primitives ─────────────────────────────────────────────── */

function Sk({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "rgba(255,255,255,0.05)",
      animation: "af-skeleton-pulse 1.8s ease-in-out infinite",
    }} />
  );
}

function Spinner({ color = C.amber, size = 28 }: { color?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${color}30`, borderTopColor: color,
      animation: "af-spin 0.8s linear infinite",
    }} />
  );
}

function Card({ children, style = {}, accent }: { children: React.ReactNode; style?: React.CSSProperties; accent?: string }) {
  return (
    <div style={{
      position: "relative", background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 20, overflow: "hidden", ...style,
    }}>
      {accent && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
        }} />
      )}
      {children}
    </div>
  );
}

function SectionLabel({ children, color = C.amber }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color, fontFamily: FONT_MONO, letterSpacing: "0.1em", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function PageHeader({ label, title, sub, color = C.amber, right }: {
  label: string; title: string; sub?: string; color?: string; right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
      <div>
        <SectionLabel color={color}>{label}</SectionLabel>
        <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 900, fontFamily: FONT_HEAD, letterSpacing: "-0.04em", color: C.text, margin: 0 }}>
          {title}
        </h1>
        {sub && <p style={{ fontSize: 13, color: C.muted, marginTop: 5, fontFamily: FONT_BODY }}>{sub}</p>}
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{right}</div>}
    </div>
  );
}

function StatPill({ icon: Icon, value, label, color }: { icon: any; value: number | string; label: string; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: `${color}08`, border: `1px solid ${color}20`,
      borderRadius: 10, padding: "10px 16px",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: `${color}12`, border: `1px solid ${color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={13} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: FONT_HEAD, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: C.faint, fontFamily: FONT_MONO, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

function StatusDotBadge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 700, color,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 100, padding: "3px 9px",
      fontFamily: FONT_MONO, textTransform: "capitalize",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

const STATUS_COLOR: Record<string, string> = {
  active: C.green, archived: C.muted, deleted: C.red, pending_review: C.amber,
  pending: C.amber, approved: C.green, rejected: C.red, cancelled: C.muted,
  completed: C.green, processing: C.amber, failed: C.red, blocked: C.red,
};

function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const color = STATUS_COLOR[status] || C.muted;
  return (
    <StatusDotBadge label={status.replace('_', ' ')} color={color} bg={`${color}12`} border={`${color}28`} />
  );
}

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const color = STATUS_COLOR[status] || C.muted;
  return <StatusDotBadge label={status} color={color} bg={`${color}12`} border={`${color}28`} />;
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = { info: C.blue, warning: C.amber, critical: C.red };
  const color = colors[severity];
  return <StatusDotBadge label={severity} color={color} bg={`${color}12`} border={`${color}28`} />;
}

/* ── Buttons ───────────────────────────────────────────────────────── */

function BtnPrimary({ children, onClick, disabled, style = {}, color = C.green, full }: any) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: color, border: "none", borderRadius: 8,
        padding: "9px 16px", color: "#06120D",
        fontSize: 12.5, fontWeight: 700, cursor: disabled ? "default" : "pointer",
        fontFamily: FONT_BODY, opacity: disabled ? 0.55 : 1,
        width: full ? "100%" : undefined, transition: "filter 0.14s",
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
    >
      {children}
    </button>
  );
}

function BtnSecondary({ children, onClick, disabled, style = {}, color = C.purple, full }: any) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: `${color}0D`, border: `1px solid ${color}30`, borderRadius: 8,
        padding: "9px 16px", color,
        fontSize: 12.5, fontWeight: 600, cursor: disabled ? "default" : "pointer",
        fontFamily: FONT_BODY, opacity: disabled ? 0.5 : 1,
        width: full ? "100%" : undefined, transition: "background 0.14s",
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = `${color}18`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}0D`; }}
    >
      {children}
    </button>
  );
}

function BtnDanger({ children, onClick, disabled, style = {}, full }: any) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.28)", borderRadius: 8,
        padding: "9px 16px", color: C.red,
        fontSize: 12.5, fontWeight: 600, cursor: disabled ? "default" : "pointer",
        fontFamily: FONT_BODY, opacity: disabled ? 0.4 : 1,
        width: full ? "100%" : undefined, transition: "background 0.14s",
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = "rgba(251,113,133,0.16)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(251,113,133,0.08)"; }}
    >
      {children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { full?: boolean }) {
  const { style, full, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        width: full ? "100%" : undefined,
        background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 12px", color: C.text,
        fontSize: 12.5, fontFamily: FONT_BODY, outline: "none",
        boxSizing: "border-box", transition: "border-color 0.15s",
        ...style,
      }}
      onFocus={e => (e.currentTarget.style.borderColor = "rgba(251,191,36,0.4)")}
      onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { style, children, ...rest } = props;
  return (
    <select
      {...rest}
      style={{
        background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 12px", color: C.text,
        fontSize: 12.5, fontFamily: FONT_BODY, outline: "none",
        cursor: "pointer", ...style,
      }}
    >
      {children}
    </select>
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { style, ...rest } = props;
  return (
    <textarea
      {...rest}
      style={{
        width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 12px", color: C.text,
        fontSize: 12.5, fontFamily: FONT_BODY, outline: "none",
        resize: "none", boxSizing: "border-box", ...style,
      }}
    />
  );
}

/* ── Asset Type Icon ───────────────────────────────────────────────── */

const ASSET_ICONS: Record<AssetType, any> = {
  image: ImageIcon, video: Film, audio: Music, document: FileText,
  template: LayoutTemplate, brand_asset: Tag, other: Package,
};
const ASSET_ICON_COLOR: Record<AssetType, string> = {
  image: C.blue, video: C.purple, audio: C.green, document: C.amber,
  template: C.blue, brand_asset: C.purple, other: C.muted,
};

function AssetIcon({ type, size = 18 }: { type: AssetType; size?: number }) {
  const Icon = ASSET_ICONS[type] || Package;
  const color = ASSET_ICON_COLOR[type] || C.muted;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 9,
      background: `${color}12`, border: `1px solid ${color}24`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <Icon size={size} color={color} />
    </div>
  );
}

/* ── Tab bar ───────────────────────────────────────────────────────── */

type Tab = 'library' | 'governance' | 'brands' | 'reviews' | 'audit';

const TAB_DEFS: { id: Tab; label: string; icon: any; color: string }[] = [
  { id: 'library',    label: 'Library',     icon: ImageIcon,      color: C.amber  },
  { id: 'governance', label: 'Governance',  icon: Shield,         color: C.purple },
  { id: 'brands',     label: 'Brands',      icon: BookMarked,     color: C.blue   },
  { id: 'reviews',    label: 'Reviews',     icon: ClipboardCheck, color: C.green  },
  { id: 'audit',      label: 'Audit Log',   icon: FileText,       color: C.muted  },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{
      display: "flex", gap: 4, marginBottom: 24, flexWrap: "wrap",
      borderBottom: `1px solid ${C.border}`, paddingBottom: 2,
    }}>
      {TAB_DEFS.map(t => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
              background: isActive ? `${t.color}10` : "transparent",
              color: isActive ? t.color : C.muted,
              fontSize: 12.5, fontWeight: isActive ? 700 : 500,
              fontFamily: FONT_BODY,
              borderBottom: isActive ? `2px solid ${t.color}` : "2px solid transparent",
              marginBottom: -2, transition: "all 0.14s",
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.text; }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = C.muted; }}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Upload Zone ───────────────────────────────────────────────────── */

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name);
      fd.append('asset_type', file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('video/') ? 'video'
        : file.type.startsWith('audio/') ? 'audio' : 'other');
      await formAPI('/asset-library/upload', fd);
    }
    setUploading(false);
    setProgress('');
    onUploaded();
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? C.amber : C.border}`,
        borderRadius: 14, padding: "32px 20px", textAlign: "center",
        cursor: "pointer", marginBottom: 24, transition: "all 0.18s",
        background: dragging ? "rgba(251,191,36,0.06)" : "transparent",
      }}
    >
      <input ref={inputRef} type="file" multiple style={{ display: "none" }}
        onChange={e => e.target.files && handleFiles(e.target.files)} />
      {uploading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: C.amber, fontSize: 13, fontFamily: FONT_BODY }}>
          <Spinner size={18} /> {progress}
        </div>
      ) : (
        <>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: "0 auto 12px",
            background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Upload size={20} color={C.amber} />
          </div>
          <p style={{ color: C.text, fontWeight: 600, fontSize: 13.5, fontFamily: FONT_BODY, margin: 0 }}>
            Drop files here or click to upload
          </p>
          <p style={{ color: C.faint, fontSize: 11.5, fontFamily: FONT_MONO, marginTop: 5 }}>
            MAX 100 MB PER FILE
          </p>
        </>
      )}
    </div>
  );
}

/* ── Asset Card ────────────────────────────────────────────────────── */

function AssetCard({ asset, onClick }: { asset: Asset; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.surface, border: `1px solid ${hover ? C.borderH : C.border}`,
        borderRadius: 12, padding: 14, cursor: "pointer",
        transition: "all 0.16s", transform: hover ? "translateY(-2px)" : "none",
      }}
    >
      {asset.presigned_url && asset.asset_type === 'image' && (
        <div style={{ width: "100%", height: 100, borderRadius: 8, overflow: "hidden", marginBottom: 10, background: C.border }}>
          <img src={asset.presigned_url} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      {asset.presigned_url && asset.asset_type === 'video' && (
        <div style={{ position: "relative", width: "100%", height: 100, borderRadius: 8, overflow: "hidden", marginBottom: 10, background: "#000" }}>
          <video src={asset.presigned_url} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}>
            <span style={{ fontSize: 22, color: "#fff" }}>▶</span>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <AssetIcon type={asset.asset_type} />
        <AssetStatusBadge status={asset.status} />
      </div>
      <p style={{
        color: C.text, fontWeight: 600, fontSize: 12.5, margin: "0 0 3px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontFamily: FONT_BODY,
      }}>
        {asset.name}
      </p>
      <p style={{ color: C.faint, fontSize: 10.5, margin: "0 0 8px", fontFamily: FONT_MONO }}>
        {fmtBytes(asset.file_size_bytes)}
      </p>
      {asset.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {asset.tags.slice(0, 3).map(t => (
            <span key={t} style={{
              fontSize: 9.5, background: "rgba(255,255,255,0.05)", color: C.muted,
              padding: "2px 6px", borderRadius: 5, fontFamily: FONT_MONO,
            }}>
              {t}
            </span>
          ))}
        </div>
      )}
      <p style={{ color: C.faint, fontSize: 10, margin: 0, fontFamily: FONT_MONO }}>{fmtDate(asset.created_at)}</p>
    </div>
  );
}

/* ── Pagination ────────────────────────────────────────────────────── */

function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total <= pageSize) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
      <BtnSecondary color={C.muted} onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</BtnSecondary>
      <span style={{ padding: "9px 12px", color: C.muted, fontSize: 12.5, fontFamily: FONT_MONO }}>Page {page}</span>
      <BtnSecondary color={C.muted} onClick={() => onPage(page + 1)} disabled={page * pageSize >= total}>Next</BtnSecondary>
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────── */

function EmptyState({ icon: Icon, title, sub, color = C.amber }: { icon: any; title: string; sub: string; color?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
        background: `${color}0C`, border: `1px solid ${color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={24} color={`${color}90`} />
      </div>
      <p style={{ color: C.muted, fontWeight: 700, fontSize: 14, fontFamily: FONT_HEAD, margin: "0 0 6px" }}>{title}</p>
      <p style={{ color: C.faint, fontSize: 12.5, fontFamily: FONT_BODY, margin: 0 }}>{sub}</p>
    </div>
  );
}

/* ── Drawer sub-tab pill ───────────────────────────────────────────── */

function DrawerTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, padding: "10px 12px", border: "none", cursor: "pointer",
        background: "transparent", color: active ? C.amber : C.faint,
        fontSize: 11.5, fontWeight: active ? 700 : 500, fontFamily: FONT_BODY,
        borderBottom: active ? `2px solid ${C.amber}` : "2px solid transparent",
        transition: "color 0.14s",
      }}
    >
      {label}
    </button>
  );
}

/* ── Asset Drawer ──────────────────────────────────────────────────── */

function AssetDrawer({ assetId, orgId, onClose, onRefresh, onSchedule }: {
  assetId: string;
  orgId: string;
  onClose: () => void;
  onRefresh: () => void;
  onSchedule: (asset: Asset) => void;
}) {
  const [asset, setAsset]               = useState<Asset | null>(null);
  const [versions, setVersions]         = useState<AssetVersion[]>([]);
  const [flags, setFlags]               = useState<ComplianceFlag[]>([]);
  const [reviews, setReviews]           = useState<ReviewRequest[]>([]);
  const [comments, setComments]         = useState<Comment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<'preview'|'versions'|'flags'|'review'|'comments'>('preview');
  const [commentBody, setCommentBody]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitNote, setSubmitNote]     = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [a, v, f, r, c] = await Promise.all([
      API(`/asset-library/${assetId}`),
      API(`/asset-library/${assetId}/versions`),
      API(`/asset-library/${assetId}/compliance-flags`).catch(() => []),
      API(`/asset-review/asset/${assetId}/history`).catch(() => []),
      API(`/asset-collaboration/${assetId}/comments`).catch(() => []),
    ]);
    setAsset(a);
    setVersions(Array.isArray(v) ? v : []);
    setFlags(Array.isArray(f) ? f : []);
    setReviews(Array.isArray(r) ? r : []);
    setComments(Array.isArray(c) ? c : []);
    setLoading(false);
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const archive = async () => {
    await API(`/asset-library/${assetId}/archive`, { method: 'POST' });
    onRefresh();
    onClose();
  };

  const remove = async () => {
    await API(`/asset-library/${assetId}`, { method: 'DELETE' });
    onRefresh();
    onClose();
  };

  const submitForReview = async () => {
    setSubmitting(true);
    await API('/asset-review/submit', {
      method: 'POST',
      body:   JSON.stringify({ asset_id: assetId, review_note: submitNote }),
    });
    setSubmitNote('');
    setSubmitting(false);
    load();
  };

  const approveRequest = async (reqId: string) => {
    await API(`/asset-review/${reqId}/approve`, { method: 'POST', body: JSON.stringify({}) });
    load();
    onRefresh();
  };

  const rejectRequest = async (reqId: string) => {
    if (!rejectReason.trim()) return;
    await API(`/asset-review/${reqId}/reject`, {
      method: 'POST',
      body:   JSON.stringify({ rejection_reason: rejectReason }),
    });
    setRejectReason('');
    load();
    onRefresh();
  };

  const postComment = async () => {
    if (!commentBody.trim()) return;
    setSubmitting(true);
    await API(`/asset-collaboration/${assetId}/comments`, {
      method: 'POST',
      body:   JSON.stringify({ body: commentBody }),
    });
    setCommentBody('');
    setSubmitting(false);
    load();
  };

  const openReview = reviews.find(r => r.status === 'pending') || null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{
        position: "relative", width: "100%", maxWidth: 480, background: C.bg,
        borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: 16, borderBottom: `1px solid ${C.border}`,
        }}>
          <h2 style={{ color: C.text, fontWeight: 700, fontSize: 15, fontFamily: FONT_HEAD, margin: 0 }}>Asset Details</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>
        ) : asset ? (
          <>
            <div style={{ padding: 16, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <AssetIcon type={asset.asset_type} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: C.text, fontWeight: 600, fontSize: 13.5, margin: 0, wordBreak: "break-word", fontFamily: FONT_BODY }}>{asset.name}</p>
                  <p style={{ color: C.faint, fontSize: 11, margin: "3px 0 0", fontFamily: FONT_MONO }}>{asset.mime_type} · {fmtBytes(asset.file_size_bytes)}</p>
                  <p style={{ color: C.faint, fontSize: 11, margin: "2px 0 0", fontFamily: FONT_MONO }}>v{asset.current_version} · {fmtDate(asset.updated_at)}</p>
                  {openReview && <div style={{ marginTop: 6 }}><ReviewStatusBadge status="pending" /></div>}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
              {(['preview','versions','flags','review','comments'] as const).map(t => (
                <DrawerTab
                  key={t} active={tab === t} onClick={() => setTab(t)}
                  label={
                    t === 'flags'    ? `Flags (${flags.length})`
                  : t === 'versions' ? `Versions (${versions.length})`
                  : t === 'review'   ? `Review${openReview ? ' ●' : ''}`
                  : t === 'comments' ? `Comments (${comments.length})`
                  : 'Preview'
                  }
                />
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {tab === 'preview' && (
                <div>
                  {asset.presigned_url && asset.asset_type === 'image' && (
                    <img src={asset.presigned_url} alt={asset.name}
                      style={{ width: "100%", borderRadius: 10, marginBottom: 16, maxHeight: 260, objectFit: "contain", background: C.surface }} />
                  )}
                  {asset.presigned_url && asset.asset_type === 'video' && (
                    <video src={asset.presigned_url} controls style={{ width: "100%", borderRadius: 10, marginBottom: 16, maxHeight: 260, background: "#000" }} />
                  )}
                  {asset.presigned_url && asset.asset_type === 'audio' && (
                    <audio src={asset.presigned_url} controls style={{ width: "100%", marginBottom: 16 }} />
                  )}
                  {(asset.presigned_url || asset.public_url) && (
                    <div style={{ marginBottom: 14 }}>
                      <a
                        href={asset.presigned_url || asset.public_url}
                        download={asset.name}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          background: C.surface, border: `1px solid ${C.border}`,
                          color: C.text, padding: "8px 14px", borderRadius: 8,
                          fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY,
                          textDecoration: "none", cursor: "pointer",
                        }}
                      >
                        ↓ Download {asset.name}
                      </a>
                    </div>
                  )}
                  {asset.tags.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ color: C.faint, fontSize: 10.5, margin: "0 0 6px", fontFamily: FONT_MONO }}>TAGS</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {asset.tags.map(t => (
                          <span key={t} style={{ fontSize: 10.5, background: "rgba(255,255,255,0.05)", color: C.muted, padding: "3px 8px", borderRadius: 6, fontFamily: FONT_MONO }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
                    <p style={{ color: C.faint, fontSize: 10.5, margin: "0 0 8px", fontFamily: FONT_MONO }}>SOCIAL & CAMPAIGNS</p>
                    <button
                      onClick={() => onSchedule(asset)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        width: "100%", background: C.amber, color: "#1a1305",
                        padding: "11px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                        fontFamily: FONT_BODY, border: "none", cursor: "pointer", boxSizing: "border-box",
                      }}
                    >
                      <CalendarClock size={14} /> Schedule / Post
                    </button>
                    <p style={{ color: C.faint, fontSize: 10, marginTop: 8, textAlign: "center", fontFamily: FONT_BODY }}>
                      Schedule or publish this asset to social platforms.
                    </p>
                  </div>
                </div>
              )}

              {tab === 'versions' && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {versions.map(v => (
                    <Card key={v.id} style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: C.amber, fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700 }}>v{v.version_number}</span>
                        <span style={{ color: C.faint, fontSize: 10.5, fontFamily: FONT_MONO }}>{fmtDate(v.created_at)}</span>
                      </div>
                      {v.change_note && <p style={{ color: C.muted, fontSize: 12, margin: "6px 0 0", fontFamily: FONT_BODY }}>{v.change_note}</p>}
                      <p style={{ color: C.faint, fontSize: 10.5, margin: "4px 0 0", fontFamily: FONT_MONO }}>{fmtBytes(v.file_size_bytes)}</p>
                    </Card>
                  ))}
                  {versions.length === 0 && <p style={{ color: C.faint, fontSize: 12.5, textAlign: "center", padding: "16px 0", fontFamily: FONT_BODY }}>No versions found</p>}
                </div>
              )}

              {tab === 'flags' && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {flags.map(f => (
                    <Card key={f.id} style={{ padding: 12, opacity: f.resolved ? 0.5 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <SeverityBadge severity={f.severity} />
                        <span style={{ color: C.faint, fontSize: 10.5, fontFamily: FONT_MONO }}>{fmtDate(f.created_at)}</span>
                      </div>
                      <p style={{ color: C.muted, fontSize: 12, margin: "8px 0 0", fontFamily: FONT_BODY }}>{f.message}</p>
                      <p style={{ color: C.faint, fontSize: 10.5, margin: "4px 0 0", fontFamily: FONT_MONO }}>{f.flag_type}</p>
                    </Card>
                  ))}
                  {flags.length === 0 && <p style={{ color: C.faint, fontSize: 12.5, textAlign: "center", padding: "16px 0", fontFamily: FONT_BODY }}>No compliance flags</p>}
                </div>
              )}

              {tab === 'review' && (
                <div>
                  {asset.status !== 'pending_review' && (
                    <Card style={{ marginBottom: 16 }}>
                      <p style={{ color: C.text, fontWeight: 600, fontSize: 12.5, margin: "0 0 10px", fontFamily: FONT_BODY }}>Submit for Review</p>
                      <TextArea rows={2} placeholder="Optional note for reviewer…" value={submitNote}
                        onChange={(e: any) => setSubmitNote(e.target.value)} style={{ marginBottom: 10 }} />
                      <BtnPrimary full color={C.amber} onClick={submitForReview} disabled={submitting}>
                        {submitting ? 'Submitting…' : 'Submit for Review'}
                      </BtnPrimary>
                    </Card>
                  )}

                  {openReview && (
                    <Card accent={C.amber} style={{ marginBottom: 16, background: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.25)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <p style={{ color: C.amber, fontWeight: 700, fontSize: 12.5, margin: 0, fontFamily: FONT_BODY }}>Pending Review</p>
                        <ReviewStatusBadge status="pending" />
                      </div>
                      {openReview.review_note && (
                        <p style={{ color: C.muted, fontSize: 11.5, margin: "0 0 12px", fontFamily: FONT_BODY }}>Note: {openReview.review_note}</p>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <BtnPrimary full color={C.green} onClick={() => approveRequest(openReview.id)}>
                          <Check size={13} /> Approve
                        </BtnPrimary>
                        <Input full placeholder="Rejection reason (required to reject)…" value={rejectReason}
                          onChange={(e: any) => setRejectReason(e.target.value)} />
                        <BtnDanger full onClick={() => rejectRequest(openReview.id)} disabled={!rejectReason.trim()}>
                          <X size={13} /> Reject
                        </BtnDanger>
                      </div>
                    </Card>
                  )}

                  {reviews.length > 0 && (
                    <div>
                      <p style={{ color: C.faint, fontSize: 10.5, fontWeight: 700, margin: "0 0 8px", fontFamily: FONT_MONO }}>REVIEW HISTORY</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {reviews.map(r => (
                          <Card key={r.id} style={{ padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <ReviewStatusBadge status={r.status} />
                              <span style={{ color: C.faint, fontSize: 10.5, fontFamily: FONT_MONO }}>{fmtDate(r.submitted_at)}</span>
                            </div>
                            <p style={{ color: C.muted, fontSize: 11, margin: 0, fontFamily: FONT_BODY }}>v{r.version_number} · By {r.requester_name || 'unknown'}</p>
                            {r.rejection_reason && <p style={{ color: C.red, fontSize: 11, margin: "4px 0 0", fontFamily: FONT_BODY }}>Reason: {r.rejection_reason}</p>}
                            {r.reviewer_name && <p style={{ color: C.faint, fontSize: 10.5, margin: "4px 0 0", fontFamily: FONT_BODY }}>Reviewed by {r.reviewer_name}</p>}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {reviews.length === 0 && asset.status !== 'pending_review' && (
                    <p style={{ color: C.faint, fontSize: 12.5, textAlign: "center", padding: "16px 0", fontFamily: FONT_BODY }}>No review history</p>
                  )}
                </div>
              )}

              {tab === 'comments' && (
                <div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                    {comments.map(c => (
                      <Card key={c.id} style={{ padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ color: C.amber, fontSize: 11, fontWeight: 700, fontFamily: FONT_BODY }}>{c.author_name || 'Unknown'}</span>
                          <span style={{ color: C.faint, fontSize: 10, fontFamily: FONT_MONO }}>{fmtDate(c.created_at)}</span>
                        </div>
                        <p style={{ color: C.muted, fontSize: 12, margin: 0, fontFamily: FONT_BODY }}>
                          {c.is_deleted ? <em style={{ color: C.faint }}>[deleted]</em> : c.body}
                        </p>
                        {c.replies && c.replies.length > 0 && (
                          <div style={{ marginTop: 10, marginLeft: 14, paddingLeft: 12, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                            {c.replies.map(r => (
                              <div key={r.id}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                                  <span style={{ color: C.amber, fontSize: 10.5, fontFamily: FONT_BODY }}>{r.author_name || 'Unknown'}</span>
                                  <span style={{ color: C.faint, fontSize: 9.5, fontFamily: FONT_MONO }}>{fmtDate(r.created_at)}</span>
                                </div>
                                <p style={{ color: C.muted, fontSize: 11.5, margin: 0, fontFamily: FONT_BODY }}>
                                  {r.is_deleted ? <em style={{ color: C.faint }}>[deleted]</em> : r.body}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                    {comments.length === 0 && (
                      <p style={{ color: C.faint, fontSize: 12.5, textAlign: "center", padding: "16px 0", fontFamily: FONT_BODY }}>No comments yet. Start the conversation.</p>
                    )}
                  </div>

                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                    <TextArea rows={3} placeholder="Write a comment… Use @name to mention a teammate" value={commentBody}
                      onChange={(e: any) => setCommentBody(e.target.value)} style={{ marginBottom: 10 }} />
                    <BtnPrimary full color={C.amber} onClick={postComment} disabled={submitting || !commentBody.trim()}>
                      <MessageSquare size={13} /> {submitting ? 'Posting…' : 'Post Comment'}
                    </BtnPrimary>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, padding: 16, borderTop: `1px solid ${C.border}` }}>
              {asset.status === 'active' && (
                <BtnSecondary full color={C.muted} onClick={archive}><Archive size={13} /> Archive</BtnSecondary>
              )}
              <BtnDanger full onClick={remove}><Trash2 size={13} /> Delete</BtnDanger>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontFamily: FONT_BODY }}>Asset not found</div>
        )}
      </div>
    </div>
  );
}

/* ── Library Tab ───────────────────────────────────────────────────── */

function LibraryTab({ onSchedule }: { onSchedule: (asset: Asset) => void }) {
  const [assets, setAssets]       = useState<Asset[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState('');
  const [assetType, setAssetType] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (query)     params.set('q', query);
    if (assetType) params.set('asset_type', assetType);
    const res = await API(`/asset-library?${params}`);
    setAssets(res.assets || []);
    setTotal(res.total || 0);
    setLoading(false);
  }, [query, assetType, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <UploadZone onUploaded={load} />

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.faint, pointerEvents: "none" }} />
          <Input full placeholder="Search assets…" value={query}
            onChange={(e: any) => { setQuery(e.target.value); setPage(1); }} style={{ paddingLeft: 32 }} />
        </div>
        <Select value={assetType} onChange={(e: any) => { setAssetType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {['image','video','audio','document','template','brand_asset','other'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <Sk w={36} h={36} r={9} /><Sk w={50} h={18} r={100} />
              </div>
              <Sk w="80%" h={12} /><div style={{ marginTop: 6 }}><Sk w="40%" h={10} /></div>
            </Card>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState icon={Package} title="No assets found" sub="Upload your first file above to get started." />
      ) : (
        <>
          <p style={{ color: C.faint, fontSize: 11.5, marginBottom: 14, fontFamily: FONT_MONO }}>{total} ASSETS</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
            {assets.map(a => (
              <AssetCard key={a.id} asset={a} onClick={() => setSelectedId(a.id)} />
            ))}
          </div>
          <Pagination page={page} total={total} pageSize={20} onPage={setPage} />
        </>
      )}

      {selectedId && (
        <AssetDrawer
          assetId={selectedId}
          orgId=""
          onClose={() => setSelectedId(null)}
          onRefresh={load}
          onSchedule={onSchedule}
        />
      )}
    </div>
  );
}

/* ── Governance Tab ────────────────────────────────────────────────── */

function GovernanceTab() {
  const [policies, setPolicies]   = useState<GovernancePolicy[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: '', retention_days: '', archive_days: '' });

  const load = async () => {
    const data = await API('/asset-governance/policies');
    setPolicies(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    await API('/asset-governance/policies', {
      method: 'POST',
      body:   JSON.stringify({
        name:           form.name,
        retention_days: form.retention_days ? parseInt(form.retention_days) : null,
        archive_days:   form.archive_days   ? parseInt(form.archive_days)   : null,
      }),
    });
    setShowForm(false);
    setForm({ name: '', retention_days: '', archive_days: '' });
    load();
  };

  const deactivate = async (id: string) => {
    await API(`/asset-governance/policies/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: 0, fontFamily: FONT_HEAD }}>Governance Policies</p>
        <BtnPrimary color={C.amber} onClick={() => setShowForm(true)}><Plus size={13} /> New Policy</BtnPrimary>
      </div>

      {showForm && (
        <Card accent={C.amber} style={{ marginBottom: 20, borderColor: "rgba(251,191,36,0.25)" }}>
          <p style={{ color: C.text, fontWeight: 600, fontSize: 13, margin: "0 0 14px", fontFamily: FONT_BODY }}>Create Policy</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 14 }}>
            <Input full placeholder="Policy name" value={form.name}
              onChange={(e: any) => setForm(f => ({ ...f, name: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input full type="number" placeholder="Archive after N days" value={form.archive_days}
                onChange={(e: any) => setForm(f => ({ ...f, archive_days: e.target.value }))} />
              <Input full type="number" placeholder="Delete after N days" value={form.retention_days}
                onChange={(e: any) => setForm(f => ({ ...f, retention_days: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <BtnPrimary color={C.amber} onClick={submit}>Create</BtnPrimary>
            <BtnSecondary color={C.muted} onClick={() => setShowForm(false)}>Cancel</BtnSecondary>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {policies.map(p => (
          <Card key={p.id} style={{ opacity: p.is_active ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <p style={{ color: C.text, fontWeight: 600, fontSize: 13, margin: 0, fontFamily: FONT_BODY }}>{p.name}</p>
                <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
                  {p.archive_days && <span style={{ color: C.faint, fontSize: 10.5, fontFamily: FONT_MONO }}>Archive after {p.archive_days}d</span>}
                  {p.retention_days && <span style={{ color: C.faint, fontSize: 10.5, fontFamily: FONT_MONO }}>Delete after {p.retention_days}d</span>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StatusDotBadge label={p.is_active ? 'Active' : 'Inactive'} color={p.is_active ? C.green : C.muted} bg={p.is_active ? "rgba(0,200,150,0.1)" : "rgba(255,255,255,0.05)"} border={p.is_active ? "rgba(0,200,150,0.25)" : C.border} />
                {p.is_active && (
                  <button onClick={() => deactivate(p.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 11, cursor: "pointer", fontFamily: FONT_BODY }}>
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {policies.length === 0 && (
          <EmptyState icon={Shield} title="No governance policies yet" sub="Create a policy to manage asset retention and archiving." />
        )}
      </div>
    </div>
  );
}

/* ── Brands Tab ────────────────────────────────────────────────────── */

const RULE_TYPES = ['color_palette','font_family','logo_usage','tone_of_voice','aspect_ratio','file_format','naming_convention','custom'];

function BrandsTab() {
  const [brands, setBrands]           = useState<Brand[]>([]);
  const [activeBrand, setActiveBrand] = useState<(Brand & { rules: BrandRule[] }) | null>(null);
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandName, setBrandName]     = useState('');
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm]       = useState({ rule_type: 'color_palette', rule_name: '', config: '{}' });
  const [checkAssetId, setCheckAssetId] = useState('');
  const [checkResult, setCheckResult] = useState<{ violations: unknown[]; warnings_emitted: number } | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  const loadBrands = async () => {
    const data = await API('/brands');
    setBrands(Array.isArray(data) ? data : []);
  };

  const loadBrand = async (id: string) => {
    const data = await API(`/brands/${id}`);
    setActiveBrand(data);
  };

  useEffect(() => { loadBrands(); }, []);

  const createBrand = async () => {
    await API('/brands', { method: 'POST', body: JSON.stringify({ name: brandName }) });
    setShowBrandForm(false);
    setBrandName('');
    await loadBrands();
  };

  const addRule = async () => {
    if (!activeBrand) return;
    let config;
    try { config = JSON.parse(ruleForm.config); } catch { return alert('Config must be valid JSON'); }
    await API(`/brands/${activeBrand.id}/rules`, {
      method: 'POST',
      body:   JSON.stringify({ ...ruleForm, config }),
    });
    setShowRuleForm(false);
    setRuleForm({ rule_type: 'color_palette', rule_name: '', config: '{}' });
    await loadBrand(activeBrand.id);
  };

  const deleteRule = async (ruleId: string) => {
    if (!activeBrand) return;
    await API(`/brands/${activeBrand.id}/rules/${ruleId}`, { method: 'DELETE' });
    await loadBrand(activeBrand.id);
  };

  const runCheck = async () => {
    if (!activeBrand || !checkAssetId.trim()) return;
    setCheckLoading(true);
    const result = await API(`/brands/${activeBrand.id}/check/${checkAssetId.trim()}`, { method: 'POST' });
    setCheckResult(result);
    setCheckLoading(false);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }} className="af-brands-grid">
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ color: C.text, fontWeight: 700, fontSize: 12.5, margin: 0, fontFamily: FONT_HEAD }}>Brands</p>
          <button onClick={() => setShowBrandForm(true)} style={{
            display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, padding: "4px 8px",
            background: C.blue, color: "#06141F", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 700,
          }}>
            <Plus size={10} /> New
          </button>
        </div>

        {showBrandForm && (
          <div style={{ marginBottom: 12 }}>
            <Input full placeholder="Brand name" value={brandName} onChange={(e: any) => setBrandName(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <BtnPrimary full color={C.blue} onClick={createBrand}>Create</BtnPrimary>
              <BtnSecondary full color={C.muted} onClick={() => setShowBrandForm(false)}>Cancel</BtnSecondary>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {brands.map(b => {
            const isActive = activeBrand?.id === b.id;
            return (
              <button key={b.id} onClick={() => loadBrand(b.id)} style={{
                textAlign: "left", padding: "9px 11px", borderRadius: 8, fontSize: 12.5,
                background: isActive ? "rgba(56,189,248,0.1)" : "transparent",
                color: isActive ? C.blue : C.muted,
                border: isActive ? "1px solid rgba(56,189,248,0.25)" : "1px solid transparent",
                cursor: "pointer", fontFamily: FONT_BODY, transition: "all 0.14s",
              }}>
                {b.name}
                {b.is_default && <span style={{ marginLeft: 8, fontSize: 10, color: C.faint, fontFamily: FONT_MONO }}>default</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {activeBrand ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: 0, fontFamily: FONT_HEAD }}>{activeBrand.name} — Rules</p>
              <BtnPrimary color={C.blue} onClick={() => setShowRuleForm(true)}><Plus size={13} /> Add Rule</BtnPrimary>
            </div>

            {showRuleForm && (
              <Card accent={C.blue} style={{ marginBottom: 16, borderColor: "rgba(56,189,248,0.25)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <Select value={ruleForm.rule_type} onChange={(e: any) => setRuleForm(f => ({ ...f, rule_type: e.target.value }))}>
                    {RULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <Input full placeholder="Rule name" value={ruleForm.rule_name}
                    onChange={(e: any) => setRuleForm(f => ({ ...f, rule_name: e.target.value }))} />
                </div>
                <TextArea rows={3} placeholder='Config JSON e.g. {"colors":["#FF0000"]}' value={ruleForm.config}
                  onChange={(e: any) => setRuleForm(f => ({ ...f, config: e.target.value }))}
                  style={{ fontFamily: FONT_MONO, marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <BtnPrimary color={C.blue} onClick={addRule}>Add</BtnPrimary>
                  <BtnSecondary color={C.muted} onClick={() => setShowRuleForm(false)}>Cancel</BtnSecondary>
                </div>
              </Card>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {(activeBrand.rules || []).map(r => (
                <Card key={r.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: 14 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", color: C.muted, padding: "2px 7px", borderRadius: 5, fontFamily: FONT_MONO }}>{r.rule_type}</span>
                      <span style={{ color: C.text, fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY }}>{r.rule_name}</span>
                    </div>
                    <p style={{ color: C.faint, fontSize: 10.5, margin: 0, fontFamily: FONT_MONO }}>{JSON.stringify(r.config)}</p>
                  </div>
                  <button onClick={() => deleteRule(r.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 11, cursor: "pointer", marginLeft: 14, fontFamily: FONT_BODY, flexShrink: 0 }}>
                    Remove
                  </button>
                </Card>
              ))}
              {(!activeBrand.rules || activeBrand.rules.length === 0) && (
                <p style={{ color: C.faint, fontSize: 12.5, textAlign: "center", padding: "20px 0", fontFamily: FONT_BODY }}>No rules yet. Add a rule above.</p>
              )}
            </div>

            <Card>
              <p style={{ color: C.text, fontWeight: 600, fontSize: 12.5, margin: "0 0 12px", fontFamily: FONT_BODY }}>Check Asset Against Brand</p>
              <div style={{ display: "flex", gap: 8 }}>
                <Input full placeholder="Asset ID (UUID)" value={checkAssetId} onChange={(e: any) => setCheckAssetId(e.target.value)} />
                <BtnPrimary color={C.blue} onClick={runCheck} disabled={checkLoading}>{checkLoading ? '…' : 'Check'}</BtnPrimary>
              </div>
              {checkResult && (
                <div style={{ marginTop: 12, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                  <p style={{ color: C.muted, fontSize: 12, margin: "0 0 4px", fontFamily: FONT_BODY }}>
                    Violations: <span style={{ color: checkResult.violations.length > 0 ? C.red : C.green, fontWeight: 700 }}>{checkResult.violations.length}</span>
                  </p>
                  <p style={{ color: C.muted, fontSize: 12, margin: 0, fontFamily: FONT_BODY }}>
                    Warnings emitted: <span style={{ color: C.amber, fontWeight: 700 }}>{checkResult.warnings_emitted}</span>
                  </p>
                </div>
              )}
            </Card>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: C.faint, fontSize: 12.5, fontFamily: FONT_BODY }}>
            Select a brand from the left to manage its rules
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Reviews Tab ───────────────────────────────────────────────────── */

function ReviewsTab() {
  const [requests, setRequests]     = useState<ReviewRequest[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [statusFilter, setStatus]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [rejectId, setRejectId]     = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    const res = await API(`/asset-review?${params}`);
    setRequests(res.requests || []);
    setTotal(res.total || 0);
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (reqId: string) => {
    await API(`/asset-review/${reqId}/approve`, { method: 'POST', body: JSON.stringify({}) });
    load();
  };

  const reject = async (reqId: string) => {
    if (!rejectReason.trim()) return;
    await API(`/asset-review/${reqId}/reject`, {
      method: 'POST',
      body:   JSON.stringify({ rejection_reason: rejectReason }),
    });
    setRejectId(null);
    setRejectReason('');
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <Select value={statusFilter} onChange={(e: any) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {(['pending','approved','rejected','cancelled'] as ReviewStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <span style={{ color: C.faint, fontSize: 11.5, fontFamily: FONT_MONO }}>{total} REQUESTS</span>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Spinner color={C.green} /></div>
      ) : requests.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No review requests found" sub="Submitted assets awaiting review will appear here." color={C.green} />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.map(r => (
              <Card key={r.id} accent={r.status === 'pending' ? C.amber : undefined} style={r.status === 'pending' ? { borderColor: "rgba(251,191,36,0.25)" } : {}}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      color: C.text, fontWeight: 600, fontSize: 13, margin: 0, fontFamily: FONT_BODY,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {r.asset_name || r.asset_id}
                    </p>
                    <p style={{ color: C.faint, fontSize: 10.5, margin: "3px 0 0", fontFamily: FONT_MONO }}>
                      v{r.version_number} · Requested by {r.requester_name || 'unknown'} · {fmtDate(r.submitted_at)}
                    </p>
                    {r.assignee_name && <p style={{ color: C.muted, fontSize: 11, margin: "3px 0 0", fontFamily: FONT_BODY }}>Assigned to: {r.assignee_name}</p>}
                    {r.review_note && <p style={{ color: C.muted, fontSize: 11.5, margin: "5px 0 0", fontStyle: "italic", fontFamily: FONT_BODY }}>"{r.review_note}"</p>}
                    {r.rejection_reason && <p style={{ color: C.red, fontSize: 11, margin: "5px 0 0", fontFamily: FONT_BODY }}>Rejection: {r.rejection_reason}</p>}
                  </div>
                  <ReviewStatusBadge status={r.status} />
                </div>

                {r.status === 'pending' && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <BtnPrimary color={C.green} onClick={() => approve(r.id)} style={{ padding: "7px 13px", fontSize: 11.5 }}>
                      <Check size={12} /> Approve
                    </BtnPrimary>
                    <BtnDanger onClick={() => setRejectId(r.id === rejectId ? null : r.id)} style={{ padding: "7px 13px", fontSize: 11.5 }}>
                      <X size={12} /> Reject
                    </BtnDanger>
                  </div>
                )}

                {rejectId === r.id && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    <Input full placeholder="Rejection reason…" value={rejectReason} onChange={(e: any) => setRejectReason(e.target.value)} />
                    <BtnDanger onClick={() => reject(r.id)} disabled={!rejectReason.trim()} style={{ fontSize: 11.5 }}>Confirm</BtnDanger>
                  </div>
                )}
              </Card>
            ))}
          </div>
          <Pagination page={page} total={total} pageSize={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/* ── Audit Log Tab ─────────────────────────────────────────────────── */

function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [action, setAction]   = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (action) params.set('action', action);
    const res = await API(`/asset-governance/audit-log?${params}`);
    setEntries(res.entries || []);
    setTotal(res.total || 0);
    setLoading(false);
  }, [page, action]);

  useEffect(() => { load(); }, [load]);

  const ACTIONS = ['upload','update','archive','delete','version_created','policy_applied','compliance_flag'];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <Select value={action} onChange={(e: any) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All Actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>
        <span style={{ color: C.faint, fontSize: 11.5, fontFamily: FONT_MONO }}>{total} ENTRIES</span>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Spinner color={C.muted} /></div>
      ) : (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, overflow: "hidden",
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: "120px 1fr 140px 1fr 30px",
            gap: 12, padding: "9px 18px", borderBottom: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.015)",
          }}>
            {["TIME", "ACTOR", "ACTION", "ASSET", ""].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 800, color: C.faint, fontFamily: FONT_MONO, letterSpacing: "0.08em" }}>{h}</div>
            ))}
          </div>

          {entries.map(e => {
            const isExp = expanded === e.id;
            return (
              <div key={e.id}>
                <div
                  onClick={() => setExpanded(isExp ? null : e.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "120px 1fr 140px 1fr 30px",
                    gap: 12, alignItems: "center", padding: "12px 18px",
                    borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.14s",
                  }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <span style={{ color: C.faint, fontSize: 11, fontFamily: FONT_MONO, whiteSpace: "nowrap" }}>{fmtDate(e.created_at)}</span>
                  <span style={{ color: C.muted, fontSize: 12, fontFamily: FONT_BODY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.actor_name || e.actor_email || '—'}</span>
                  <span>
                    <span style={{ background: "rgba(251,191,36,0.1)", color: C.amber, fontSize: 10.5, padding: "2px 8px", borderRadius: 5, fontFamily: FONT_MONO }}>{e.action}</span>
                  </span>
                  <span style={{ color: C.faint, fontSize: 11.5, fontFamily: FONT_BODY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.asset_name || '—'}</span>
                  <span style={{ color: C.faint, display: "flex", justifyContent: "flex-end" }}>
                    {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </span>
                </div>
                {isExp && (
                  <div style={{ padding: "0 18px 14px", borderBottom: `1px solid ${C.border}` }}>
                    <pre style={{
                      background: "rgba(0,0,0,0.3)", color: C.muted, fontSize: 11,
                      borderRadius: 8, padding: 12, overflow: "auto", maxHeight: 140,
                      fontFamily: FONT_MONO, margin: 0,
                    }}>
                      {JSON.stringify(e.detail, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}

          {entries.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: C.faint, fontSize: 12.5, fontFamily: FONT_BODY }}>No audit entries found</div>
          )}
        </div>
      )}
      <Pagination page={page} total={total} pageSize={25} onPage={setPage} />
    </div>
  );
}

/* ── Publishing Gate Tab ───────────────────────────────────────────── */

function SocialComposerModal({ asset, onClose }: { asset: any; onClose: () => void }) {
  const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok'];
  const [connected, setConnected] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState(asset?.custom_metadata?.copy || '');
  const [scheduleAt, setScheduleAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/connections', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load connections')))
      .then(rows => {
        if (cancelled) return;
        const connectedPlatforms = (Array.isArray(rows) ? rows : rows?.connections || [])
          .map((r: any) => r.platform)
          .filter((p: string) => PLATFORMS.includes(p));
        setConnected(connectedPlatforms);
        // Default-select only platforms the user has actually connected.
        setSelected(connectedPlatforms.length ? [connectedPlatforms[0]] : []);
      })
      .catch(() => { if (!cancelled) setConnected([]); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (p: string) =>
    setSelected(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const submit = async () => {
    if (!selected.length) { setErr('Select at least one platform'); return; }
    setSubmitting(true); setErr(null);
    try {
      const res = await fetch('/api/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title:      asset.name,
          content:    caption,
          assetId:    asset.id,
          platforms:  selected,
          scheduleAt: scheduleAt || null,
          mediaUrl:   asset.storage_url || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) {
        throw new Error(body.error || `Failed to schedule post (${res.status})`);
      }
      setDone(true);
    } catch (e: any) {
      setErr(e.message || 'Failed to schedule post');
    } finally {
      setSubmitting(false);
    }
  };

  const OVERLAY: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  };
  const MODAL: React.CSSProperties = {
    background: '#0C0F1A', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, padding: 28, width: '100%', maxWidth: 480,
    boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
  };

  if (done) return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={{ ...MODAL, textAlign: 'center' }}>
        <Check size={40} color="#00C896" style={{ marginBottom: 16 }} />
        <p style={{ color: '#E2E8FF', fontWeight: 700, fontSize: 17, margin: '0 0 8px' }}>Post Scheduled!</p>
        <p style={{ color: 'rgba(226,232,255,0.45)', fontSize: 13, margin: '0 0 20px' }}>
          Your asset has been queued for publishing.
        </p>
        <button onClick={onClose} style={{
          background: '#FBBF24', color: '#1a1305', padding: '10px 28px',
          borderRadius: 9, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14,
        }}>Done</button>
      </div>
    </div>
  );

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={MODAL} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ color: '#E2E8FF', fontWeight: 700, fontSize: 15 }}>Schedule / Post</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(226,232,255,0.45)' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'rgba(226,232,255,0.45)', fontSize: 11.5, margin: '0 0 4px' }}>ASSET</p>
        <p style={{ color: '#E2E8FF', fontSize: 13, fontWeight: 600, margin: '0 0 16px' }}>{asset.name}</p>

        <p style={{ color: 'rgba(226,232,255,0.45)', fontSize: 11.5, margin: '0 0 8px' }}>PLATFORMS</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {PLATFORMS.map(p => {
            const isConnected = connected === null || connected.includes(p);
            return (
              <button
                key={p}
                onClick={() => isConnected && toggle(p)}
                disabled={!isConnected}
                title={isConnected ? undefined : `${p} isn't connected — add it in Settings → Integrations`}
                style={{
                  padding: '5px 13px', borderRadius: 20, border: 'none',
                  cursor: isConnected ? 'pointer' : 'not-allowed',
                  background: selected.includes(p) ? '#FBBF24' : 'rgba(255,255,255,0.07)',
                  color: selected.includes(p) ? '#1a1305' : 'rgba(226,232,255,0.6)',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  opacity: isConnected ? 1 : 0.35,
                }}
              >{p}</button>
            );
          })}
        </div>
        {connected !== null && connected.length === 0 && (
          <p style={{ color: '#FB7185', fontSize: 11.5, margin: '0 0 16px' }}>
            No social platforms connected yet. Connect one in Settings → Integrations.
          </p>
        )}
        {connected !== null && connected.length > 0 && (
          <div style={{ marginBottom: 16 }} />
        )}

        <p style={{ color: 'rgba(226,232,255,0.45)', fontSize: 11.5, margin: '0 0 6px' }}>CAPTION</p>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={4}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            color: '#E2E8FF', fontSize: 13, padding: '10px 12px',
            fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
          }}
          placeholder="Write a caption for this post…"
        />

        <p style={{ color: 'rgba(226,232,255,0.45)', fontSize: 11.5, margin: '12px 0 6px' }}>SCHEDULE DATE (optional)</p>
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={e => setScheduleAt(e.target.value)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            color: '#E2E8FF', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box',
          }}
        />

        {err && <p style={{ color: '#FB7185', fontSize: 12, margin: '10px 0 0' }}>{err}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: 'rgba(226,232,255,0.5)', cursor: 'pointer', fontSize: 13,
          }}>Cancel</button>
          <button onClick={submit} disabled={submitting} style={{
            flex: 2, padding: '11px', borderRadius: 9, border: 'none',
            background: submitting ? 'rgba(251,191,36,0.4)' : '#FBBF24',
            color: '#1a1305', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 13,
          }}>{submitting ? 'Scheduling…' : 'Schedule / Post'}</button>
        </div>
      </div>
    </div>
  );
}

export default function MediaCloudPage() {
  const [tab, setTab] = useState<Tab>('library');
  const [composerAsset, setComposerAsset] = useState<any | null>(null);
  const { user } = useAuth();

  // BUGFIX: these four pills previously showed a hardcoded "—" — the page
  // header read like a real enterprise dashboard summary but displayed no
  // actual data. Each count below is genuinely available (LibraryTab and
  // ReviewsTab already track `total` from their own paginated loads;
  // GovernanceTab and BrandsTab fetch their full lists directly), but
  // since only the active tab is mounted at any time ({tab === 'x' &&
  // <XTab/>} unmounts the others), the parent can't read those counts
  // directly. Instead it fetches each count independently, once, on page
  // load — limit=1 on the paginated endpoints since only `total` is
  // needed, not the actual records.
  const [counts, setCounts] = useState<{
    assets: number | null; policies: number | null;
    brands: number | null; pendingReview: number | null;
  }>({ assets: null, policies: null, brands: null, pendingReview: null });

  useEffect(() => {
    let cancelled = false;
    API('/asset-library?page=1&limit=1').then(r => {
      if (!cancelled) setCounts(c => ({ ...c, assets: r.total ?? 0 }));
    }).catch(() => { if (!cancelled) setCounts(c => ({ ...c, assets: 0 })); });

    API('/asset-governance/policies').then(r => {
      if (!cancelled) setCounts(c => ({ ...c, policies: Array.isArray(r) ? r.length : 0 }));
    }).catch(() => { if (!cancelled) setCounts(c => ({ ...c, policies: 0 })); });

    API('/brands').then(r => {
      if (!cancelled) setCounts(c => ({ ...c, brands: Array.isArray(r) ? r.length : 0 }));
    }).catch(() => { if (!cancelled) setCounts(c => ({ ...c, brands: 0 })); });

    API('/asset-review?page=1&limit=1&status=pending').then(r => {
      if (!cancelled) setCounts(c => ({ ...c, pendingReview: r.total ?? 0 }));
    }).catch(() => { if (!cancelled) setCounts(c => ({ ...c, pendingReview: 0 })); });

    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ padding: "clamp(16px,3vw,28px)", maxWidth: 1440, margin: "0 auto" }}>

        <PageHeader
          label="PLATFORM"
          title="Media Cloud"
          sub="Enterprise asset library, governance policies, brand management, and audit trail."
          color={C.amber}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
          <StatPill icon={ImageIcon}      value={counts.assets        ?? "…"} label="TOTAL ASSETS"    color={C.amber} />
          <StatPill icon={Shield}         value={counts.policies      ?? "…"} label="POLICIES"        color={C.purple} />
          <StatPill icon={BookMarked}     value={counts.brands        ?? "…"} label="BRANDS"          color={C.blue} />
          <StatPill icon={ClipboardCheck} value={counts.pendingReview ?? "…"} label="PENDING REVIEW"  color={C.green} />
        </div>

        <TabBar active={tab} onChange={setTab} />

        {tab === 'library'    && <LibraryTab onSchedule={setComposerAsset} />}
        {tab === 'governance' && <GovernanceTab />}
        {tab === 'brands'     && <BrandsTab />}
        {tab === 'reviews'    && <ReviewsTab />}

      {composerAsset && (
        <SocialComposerModal
          asset={composerAsset}
          onClose={() => setComposerAsset(null)}
        />
      )}
        {tab === 'audit'      && <AuditLogTab />}
      </div>

      <style>{`
        @keyframes af-skeleton-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes af-spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .af-brands-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
