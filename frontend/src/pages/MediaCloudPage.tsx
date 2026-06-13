/**
 * AutoFlowNG — Phase 43A: Media Cloud Page
 *
 * Four-tab asset management UI:
 *   1. Library   — upload, search, grid view, asset detail drawer
 *   2. Governance — policies, compliance flags
 *   3. Brands    — brand profiles, rules, brand compliance checker
 *   4. Audit Log — paginated org-wide audit trail
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

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

// ── Asset Type Icon ───────────────────────────────────────────────────────

function AssetIcon({ type }: { type: AssetType }) {
  const icons: Record<string, string> = {
    image:       '🖼️',
    video:       '🎬',
    audio:       '🎵',
    document:    '📄',
    template:    '📋',
    brand_asset: '🏷️',
    other:       '📦',
  };
  return <span className="text-2xl">{icons[type] || '📦'}</span>;
}

// ── Severity Badge ────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    info:     'bg-blue-900/40 text-blue-300 border border-blue-700',
    warning:  'bg-amber-900/40 text-amber-300 border border-amber-700',
    critical: 'bg-red-900/40 text-red-300 border border-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[severity]}`}>
      {severity}
    </span>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────

type Tab = 'library' | 'governance' | 'brands' | 'reviews' | 'publishing' | 'audit';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'library',    label: 'Library'     },
    { id: 'governance', label: 'Governance'  },
    { id: 'brands',     label: 'Brands'      },
    { id: 'reviews',    label: 'Reviews'     },
    { id: 'publishing', label: 'Pub. Gates'  },
    { id: 'audit',      label: 'Audit Log'   },
  ];
  return (
    <div className="flex gap-1 border-b border-gray-800 mb-6">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-5 py-2.5 text-sm font-medium transition-colors rounded-t
            ${active === t.id
              ? 'bg-amber-500 text-black'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Upload Zone ───────────────────────────────────────────────────────────

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
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-6
        ${dragging ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 hover:border-gray-500'}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)} />
      {uploading ? (
        <div className="text-amber-400 text-sm">{progress}</div>
      ) : (
        <>
          <div className="text-4xl mb-2">📁</div>
          <p className="text-gray-300 font-medium">Drop files here or click to upload</p>
          <p className="text-gray-500 text-sm mt-1">Max 100 MB per file</p>
        </>
      )}
    </div>
  );
}

// ── Asset Card ────────────────────────────────────────────────────────────

function AssetCard({ asset, onClick }: { asset: Asset; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-900 border border-gray-800 rounded-lg p-4 cursor-pointer
                 hover:border-amber-600 hover:bg-gray-800 transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <AssetIcon type={asset.asset_type} />
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
          ${asset.status === 'active'    ? 'bg-green-900/40 text-green-300 border border-green-800'
          : asset.status === 'archived'  ? 'bg-gray-700 text-gray-400'
          : asset.status === 'deleted'   ? 'bg-red-900/40 text-red-400'
          : 'bg-blue-900/40 text-blue-300'}`}>
          {asset.status}
        </span>
      </div>
      <p className="text-white font-medium text-sm truncate mb-1">{asset.name}</p>
      <p className="text-gray-500 text-xs mb-2">{fmtBytes(asset.file_size_bytes)}</p>
      {asset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {asset.tags.slice(0, 3).map(t => (
            <span key={t} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}
      <p className="text-gray-600 text-xs mt-2">{fmtDate(asset.created_at)}</p>
    </div>
  );
}

// ── Review Status Badge ───────────────────────────────────────────────────

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const styles: Record<ReviewStatus, string> = {
    pending:   'bg-amber-900/40 text-amber-300 border border-amber-700',
    approved:  'bg-green-900/40 text-green-300 border border-green-800',
    rejected:  'bg-red-900/40 text-red-300 border border-red-800',
    cancelled: 'bg-gray-700 text-gray-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

// ── Asset Drawer ──────────────────────────────────────────────────────────

function AssetDrawer({ assetId, orgId, onClose, onRefresh }: {
  assetId: string;
  orgId: string;
  onClose: () => void;
  onRefresh: () => void;
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-950 border-l border-gray-800 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Asset Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : asset ? (
          <>
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-start gap-3">
                <AssetIcon type={asset.asset_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium break-words">{asset.name}</p>
                  <p className="text-gray-500 text-xs">{asset.mime_type} · {fmtBytes(asset.file_size_bytes)}</p>
                  <p className="text-gray-600 text-xs">v{asset.current_version} · {fmtDate(asset.updated_at)}</p>
                  {openReview && (
                    <span className="inline-block mt-1"><ReviewStatusBadge status="pending" /></span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex border-b border-gray-800 overflow-x-auto">
              {(['preview','versions','flags','review','comments'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-shrink-0 px-3 py-2 text-xs font-medium capitalize transition-colors
                    ${tab === t ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t === 'flags'    ? `Flags (${flags.length})`
                  : t === 'versions' ? `Versions (${versions.length})`
                  : t === 'review'   ? `Review${openReview ? ' 🔴' : ''}`
                  : t === 'comments' ? `Comments (${comments.length})`
                  : t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'preview' && (
                <div>
                  {asset.presigned_url && asset.asset_type === 'image' && (
                    <img src={asset.presigned_url} alt={asset.name}
                      className="w-full rounded-lg mb-4 max-h-64 object-contain bg-gray-900" />
                  )}
                  {asset.presigned_url && asset.asset_type === 'video' && (
                    <video src={asset.presigned_url} controls className="w-full rounded-lg mb-4 max-h-64 bg-black" />
                  )}
                  {asset.presigned_url && asset.asset_type === 'audio' && (
                    <audio src={asset.presigned_url} controls className="w-full mb-4" />
                  )}
                  {asset.tags.length > 0 && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-xs mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {asset.tags.map(t => (
                          <span key={t} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'versions' && (
                <div className="space-y-2">
                  {versions.map(v => (
                    <div key={v.id} className="bg-gray-900 border border-gray-800 rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-amber-400 font-mono text-sm">v{v.version_number}</span>
                        <span className="text-gray-500 text-xs">{fmtDate(v.created_at)}</span>
                      </div>
                      {v.change_note && <p className="text-gray-300 text-sm mt-1">{v.change_note}</p>}
                      <p className="text-gray-600 text-xs mt-1">{fmtBytes(v.file_size_bytes)}</p>
                    </div>
                  ))}
                  {versions.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">No versions found</p>
                  )}
                </div>
              )}

              {tab === 'flags' && (
                <div className="space-y-2">
                  {flags.map(f => (
                    <div key={f.id} className={`border rounded p-3 ${f.resolved ? 'border-gray-800 opacity-50' : 'border-amber-700'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <SeverityBadge severity={f.severity} />
                        <span className="text-gray-500 text-xs">{fmtDate(f.created_at)}</span>
                      </div>
                      <p className="text-gray-300 text-sm mt-1">{f.message}</p>
                      <p className="text-gray-500 text-xs mt-1">{f.flag_type}</p>
                    </div>
                  ))}
                  {flags.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">No compliance flags</p>
                  )}
                </div>
              )}

              {tab === 'review' && (
                <div>
                  {asset.status !== 'pending_review' && (
                    <div className="mb-4 p-3 bg-gray-900 border border-gray-800 rounded-lg">
                      <p className="text-gray-300 text-sm font-medium mb-2">Submit for Review</p>
                      <textarea
                        rows={2}
                        placeholder="Optional note for reviewer..."
                        value={submitNote}
                        onChange={e => setSubmitNote(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none resize-none mb-2"
                      />
                      <button onClick={submitForReview} disabled={submitting}
                        className="w-full py-2 bg-amber-500 text-black text-sm font-medium rounded hover:bg-amber-400 disabled:opacity-50">
                        {submitting ? 'Submitting…' : 'Submit for Review'}
                      </button>
                    </div>
                  )}

                  {openReview && (
                    <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-amber-300 text-sm font-medium">Pending Review</p>
                        <ReviewStatusBadge status="pending" />
                      </div>
                      {openReview.review_note && (
                        <p className="text-gray-300 text-xs mb-3">Note: {openReview.review_note}</p>
                      )}
                      <div className="space-y-2">
                        <button onClick={() => approveRequest(openReview.id)}
                          className="w-full py-2 bg-green-700 text-white text-sm rounded hover:bg-green-600">
                          ✓ Approve
                        </button>
                        <input
                          placeholder="Rejection reason (required to reject)…"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none"
                        />
                        <button onClick={() => rejectRequest(openReview.id)} disabled={!rejectReason.trim()}
                          className="w-full py-2 bg-red-900/50 border border-red-700 text-red-300 text-sm rounded hover:bg-red-900/70 disabled:opacity-40">
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {reviews.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs font-medium mb-2">Review History</p>
                      <div className="space-y-2">
                        {reviews.map(r => (
                          <div key={r.id} className="bg-gray-900 border border-gray-800 rounded p-3">
                            <div className="flex justify-between items-center mb-1">
                              <ReviewStatusBadge status={r.status} />
                              <span className="text-gray-500 text-xs">{fmtDate(r.submitted_at)}</span>
                            </div>
                            <p className="text-gray-400 text-xs">v{r.version_number} · By {r.requester_name || 'unknown'}</p>
                            {r.rejection_reason && (
                              <p className="text-red-300 text-xs mt-1">Reason: {r.rejection_reason}</p>
                            )}
                            {r.reviewer_name && (
                              <p className="text-gray-500 text-xs mt-1">Reviewed by {r.reviewer_name}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reviews.length === 0 && asset.status !== 'pending_review' && (
                    <p className="text-gray-500 text-sm text-center py-4">No review history</p>
                  )}
                </div>
              )}

              {tab === 'comments' && (
                <div>
                  <div className="space-y-3 mb-4">
                    {comments.map(c => (
                      <div key={c.id} className="bg-gray-900 border border-gray-800 rounded p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-amber-400 text-xs font-medium">{c.author_name || 'Unknown'}</span>
                          <span className="text-gray-600 text-xs">{fmtDate(c.created_at)}</span>
                        </div>
                        <p className="text-gray-300 text-sm">{c.is_deleted ? <em className="text-gray-600">[deleted]</em> : c.body}</p>
                        {c.replies && c.replies.length > 0 && (
                          <div className="mt-2 ml-4 space-y-2 border-l border-gray-700 pl-3">
                            {c.replies.map(r => (
                              <div key={r.id}>
                                <div className="flex justify-between items-center mb-0.5">
                                  <span className="text-amber-400 text-xs">{r.author_name || 'Unknown'}</span>
                                  <span className="text-gray-600 text-xs">{fmtDate(r.created_at)}</span>
                                </div>
                                <p className="text-gray-300 text-sm">{r.is_deleted ? <em className="text-gray-600">[deleted]</em> : r.body}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">No comments yet. Start the conversation.</p>
                    )}
                  </div>

                  <div className="border-t border-gray-800 pt-3">
                    <textarea
                      rows={3}
                      placeholder="Write a comment… Use @name to mention a teammate"
                      value={commentBody}
                      onChange={e => setCommentBody(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none resize-none mb-2"
                    />
                    <button onClick={postComment} disabled={submitting || !commentBody.trim()}
                      className="w-full py-2 bg-amber-500 text-black text-sm font-medium rounded hover:bg-amber-400 disabled:opacity-50">
                      {submitting ? 'Posting…' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-800 flex gap-2">
              {asset.status === 'active' && (
                <button onClick={archive}
                  className="flex-1 py-2 text-sm bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors">
                  Archive
                </button>
              )}
              <button onClick={remove}
                className="flex-1 py-2 text-sm bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 border border-red-800 transition-colors">
                Delete
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">Asset not found</div>
        )}
      </div>
    </div>
  );
}

// ── Library Tab ───────────────────────────────────────────────────────────

function LibraryTab() {
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

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search assets..."
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
        />
        <select
          value={assetType}
          onChange={e => { setAssetType(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
        >
          <option value="">All Types</option>
          {['image','video','audio','document','template','brand_asset','other'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-4">📁</div>
          <p>No assets found. Upload your first file above.</p>
        </div>
      ) : (
        <>
          <p className="text-gray-500 text-sm mb-4">{total} assets</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {assets.map(a => (
              <AssetCard key={a.id} asset={a} onClick={() => setSelectedId(a.id)} />
            ))}
          </div>

          {total > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded disabled:opacity-30">
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-400">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded disabled:opacity-30">
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedId && (
        <AssetDrawer
          assetId={selectedId}
          orgId=""
          onClose={() => setSelectedId(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

// ── Governance Tab ────────────────────────────────────────────────────────

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
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-semibold">Governance Policies</h3>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-amber-500 text-black text-sm font-medium rounded hover:bg-amber-400 transition-colors">
          + New Policy
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-amber-700 rounded-lg p-4 mb-6">
          <h4 className="text-white font-medium mb-4">Create Policy</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <input
              placeholder="Policy name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm col-span-1 sm:col-span-3 focus:outline-none"
            />
            <input
              type="number"
              placeholder="Archive after N days"
              value={form.archive_days}
              onChange={e => setForm(f => ({ ...f, archive_days: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none"
            />
            <input
              type="number"
              placeholder="Delete after N days"
              value={form.retention_days}
              onChange={e => setForm(f => ({ ...f, retention_days: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={submit}
              className="px-4 py-2 bg-amber-500 text-black text-sm font-medium rounded hover:bg-amber-400">
              Create
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {policies.map(p => (
          <div key={p.id} className={`bg-gray-900 border rounded-lg p-4 ${p.is_active ? 'border-gray-800' : 'border-gray-700 opacity-50'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white font-medium">{p.name}</p>
                <div className="flex gap-4 mt-1">
                  {p.archive_days && <span className="text-gray-400 text-xs">Archive after {p.archive_days}d</span>}
                  {p.retention_days && <span className="text-gray-400 text-xs">Delete after {p.retention_days}d</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-900/40 text-green-300 border border-green-800' : 'bg-gray-700 text-gray-400'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
                {p.is_active && (
                  <button onClick={() => deactivate(p.id)}
                    className="text-xs text-red-400 hover:text-red-300">
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {policies.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No governance policies yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Brands Tab ────────────────────────────────────────────────────────────

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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="md:col-span-1">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-white font-semibold text-sm">Brands</h3>
          <button onClick={() => setShowBrandForm(true)}
            className="text-xs px-2 py-1 bg-amber-500 text-black rounded hover:bg-amber-400">
            + New
          </button>
        </div>

        {showBrandForm && (
          <div className="mb-3">
            <input
              placeholder="Brand name"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm mb-2 focus:outline-none"
            />
            <div className="flex gap-1">
              <button onClick={createBrand}
                className="flex-1 py-1.5 bg-amber-500 text-black text-xs rounded hover:bg-amber-400">Create</button>
              <button onClick={() => setShowBrandForm(false)}
                className="flex-1 py-1.5 bg-gray-800 text-gray-300 text-xs rounded">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {brands.map(b => (
            <button key={b.id}
              onClick={() => loadBrand(b.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors
                ${activeBrand?.id === b.id ? 'bg-amber-500/20 text-amber-400 border border-amber-700' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              {b.name}
              {b.is_default && <span className="ml-2 text-xs text-gray-500">default</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-3">
        {activeBrand ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">{activeBrand.name} — Rules</h3>
              <button onClick={() => setShowRuleForm(true)}
                className="text-sm px-3 py-1.5 bg-amber-500 text-black rounded hover:bg-amber-400">
                + Add Rule
              </button>
            </div>

            {showRuleForm && (
              <div className="bg-gray-900 border border-amber-700 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <select value={ruleForm.rule_type} onChange={e => setRuleForm(f => ({ ...f, rule_type: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none">
                    {RULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input placeholder="Rule name" value={ruleForm.rule_name}
                    onChange={e => setRuleForm(f => ({ ...f, rule_name: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none" />
                </div>
                <textarea rows={3} placeholder='Config JSON e.g. {"colors":["#FF0000"]}' value={ruleForm.config}
                  onChange={e => setRuleForm(f => ({ ...f, config: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none mb-3" />
                <div className="flex gap-2">
                  <button onClick={addRule}
                    className="px-4 py-1.5 bg-amber-500 text-black text-sm rounded hover:bg-amber-400">Add</button>
                  <button onClick={() => setShowRuleForm(false)}
                    className="px-4 py-1.5 bg-gray-800 text-gray-300 text-sm rounded">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2 mb-6">
              {(activeBrand.rules || []).map(r => (
                <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{r.rule_type}</span>
                      <span className="text-white text-sm font-medium">{r.rule_name}</span>
                    </div>
                    <p className="text-gray-500 text-xs font-mono">{JSON.stringify(r.config)}</p>
                  </div>
                  <button onClick={() => deleteRule(r.id)}
                    className="text-red-400 hover:text-red-300 text-xs ml-4">Remove</button>
                </div>
              ))}
              {(!activeBrand.rules || activeBrand.rules.length === 0) && (
                <p className="text-gray-500 text-sm text-center py-6">No rules yet. Add a rule above.</p>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 text-sm">Check Asset Against Brand</h4>
              <div className="flex gap-2">
                <input
                  placeholder="Asset ID (UUID)"
                  value={checkAssetId}
                  onChange={e => setCheckAssetId(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none"
                />
                <button onClick={runCheck} disabled={checkLoading}
                  className="px-4 py-2 bg-amber-500 text-black text-sm rounded hover:bg-amber-400 disabled:opacity-50">
                  {checkLoading ? '...' : 'Check'}
                </button>
              </div>
              {checkResult && (
                <div className="mt-3 p-3 bg-gray-800 rounded text-sm">
                  <p className="text-gray-300">Violations: <span className={checkResult.violations.length > 0 ? 'text-red-400' : 'text-green-400'}>{checkResult.violations.length}</span></p>
                  <p className="text-gray-300">Warnings emitted: <span className="text-amber-400">{checkResult.warnings_emitted}</span></p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-500">
            Select a brand from the left to manage its rules
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reviews Tab ───────────────────────────────────────────────────────────

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
      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
        >
          <option value="">All Statuses</option>
          {(['pending','approved','rejected','cancelled'] as ReviewStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-gray-500 text-sm self-center">{total} requests</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-4">✅</div>
          <p>No review requests found.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id}
                className={`bg-gray-900 border rounded-lg p-4 ${r.status === 'pending' ? 'border-amber-700' : 'border-gray-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{r.asset_name || r.asset_id}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      v{r.version_number} · Requested by {r.requester_name || 'unknown'} · {fmtDate(r.submitted_at)}
                    </p>
                    {r.assignee_name && (
                      <p className="text-gray-400 text-xs mt-0.5">Assigned to: {r.assignee_name}</p>
                    )}
                    {r.review_note && (
                      <p className="text-gray-400 text-xs mt-1 italic">"{r.review_note}"</p>
                    )}
                    {r.rejection_reason && (
                      <p className="text-red-400 text-xs mt-1">Rejection: {r.rejection_reason}</p>
                    )}
                  </div>
                  <ReviewStatusBadge status={r.status} />
                </div>

                {r.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => approve(r.id)}
                      className="px-3 py-1.5 bg-green-700 text-white text-xs rounded hover:bg-green-600">
                      ✓ Approve
                    </button>
                    <button onClick={() => setRejectId(r.id === rejectId ? null : r.id)}
                      className="px-3 py-1.5 bg-red-900/40 border border-red-700 text-red-300 text-xs rounded hover:bg-red-900/60">
                      ✗ Reject
                    </button>
                  </div>
                )}

                {rejectId === r.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      placeholder="Rejection reason..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-xs focus:outline-none"
                    />
                    <button onClick={() => reject(r.id)} disabled={!rejectReason.trim()}
                      className="px-3 py-1.5 bg-red-700 text-white text-xs rounded hover:bg-red-600 disabled:opacity-40">
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {total > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded disabled:opacity-30">
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-400">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded disabled:opacity-30">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Publishing Gate Tab ───────────────────────────────────────────────────

interface BlockingAsset {
  id:                string;
  name:              string;
  status:            string;
  review_request_id: string | null;
}

interface GateStatus {
  gated:           boolean;
  reason?:         string;
  blocking_assets?: BlockingAsset[];
}

interface PublishingJob {
  id:                     string;
  status:                 string;
  target_platforms:       string[];
  created_at:             string;
  requires_asset_approval?: boolean;
  blocked_reason?:        { reason: string; blocking_assets: BlockingAsset[] } | null;
  gate?:                  GateStatus | null;
  gateLoading?:           boolean;
}

const JOB_STATUS_COLORS: Record<string, string> = {
  pending:    'bg-blue-900/40 text-blue-300 border border-blue-700',
  processing: 'bg-amber-900/40 text-amber-300 border border-amber-700',
  completed:  'bg-green-900/40 text-green-300 border border-green-800',
  failed:     'bg-red-900/40 text-red-300 border border-red-800',
  blocked:    'bg-orange-900/50 text-orange-300 border border-orange-700',
  cancelled:  'bg-gray-700 text-gray-400',
};

function PublishingGateTab() {
  const [jobs, setJobs]       = useState<PublishingJob[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    const res = await API(`/publishing/jobs?${params}`).catch(() => ({ jobs: [], total: 0 }));
    const rawJobs: PublishingJob[] = res.jobs || [];
    setTotal(res.total || 0);

    // Fetch gate check for each job in parallel (fire-and-forget per job)
    const withGates = await Promise.all(
      rawJobs.map(async (job) => {
        try {
          const gate: GateStatus = await API(`/publishing-gate/${job.id}/check`);
          return { ...job, gate };
        } catch {
          return { ...job, gate: null };
        }
      })
    );

    setJobs(withGates);
    setLoading(false);
  }, [page]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const toggleGate = async (jobId: string, currentlyOn: boolean) => {
    setToggling(jobId);
    await API(`/publishing-gate/${jobId}/set`, {
      method: 'POST',
      body:   JSON.stringify({ requires_approval: !currentlyOn }),
    }).catch(() => {});
    setToggling(null);
    loadJobs();
  };

  const recheck = async (jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, gateLoading: true } : j));
    try {
      const gate: GateStatus = await API(`/publishing-gate/${jobId}/check`);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, gate, gateLoading: false } : j));
    } catch {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, gateLoading: false } : j));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white font-semibold">Publishing Gates</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            Require all campaign assets to be approved before a job can publish.
          </p>
        </div>
        <span className="text-gray-500 text-sm">{total} jobs</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-4">📤</div>
          <p>No publishing jobs found.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {jobs.map(job => {
              const gateOn      = job.requires_asset_approval ?? false;
              const isBlocked   = job.status === 'blocked';
              const gateStatus  = job.gate;
              const blockers    = isBlocked
                ? (job.blocked_reason?.blocking_assets ?? [])
                : (gateStatus?.blocking_assets ?? []);
              const isExpanded  = expanded === job.id;

              return (
                <div
                  key={job.id}
                  className={`bg-gray-900 border rounded-lg overflow-hidden transition-all
                    ${isBlocked ? 'border-orange-700' : gateOn ? 'border-amber-700/50' : 'border-gray-800'}`}
                >
                  {/* ── Job header ── */}
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : job.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-mono text-xs">{job.id.slice(0, 8)}…</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${JOB_STATUS_COLORS[job.status] || 'bg-gray-700 text-gray-400'}`}>
                          {job.status}
                        </span>
                        {isBlocked && (
                          <span className="text-xs text-orange-300 font-medium">
                            🚫 {blockers.length} asset{blockers.length !== 1 ? 's' : ''} pending approval
                          </span>
                        )}
                        {gateOn && !isBlocked && gateStatus?.gated && (
                          <span className="text-xs text-amber-300">⚠ {gateStatus.blocking_assets?.length ?? 0} pending</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-gray-500 text-xs">
                          {(job.target_platforms || []).join(', ') || 'No platforms'}
                        </p>
                        <span className="text-gray-700 text-xs">·</span>
                        <p className="text-gray-600 text-xs">{fmtDate(job.created_at)}</p>
                      </div>
                    </div>

                    {/* ── Gate toggle ── */}
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <span className={`text-xs ${gateOn ? 'text-amber-400' : 'text-gray-600'}`}>
                        {gateOn ? 'Gate ON' : 'Gate OFF'}
                      </span>
                      <button
                        onClick={() => toggleGate(job.id, gateOn)}
                        disabled={toggling === job.id || ['completed','failed','cancelled'].includes(job.status)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                          ${gateOn ? 'bg-amber-500' : 'bg-gray-700'}
                          disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
                          ${gateOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-gray-700 ml-1">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* ── Expanded detail ── */}
                  {isExpanded && (
                    <div className="border-t border-gray-800 p-4 space-y-4">

                      {/* Gate status panel */}
                      <div className="bg-gray-800/60 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-gray-300 text-sm font-medium">Gate Status</p>
                          <button
                            onClick={() => recheck(job.id)}
                            disabled={job.gateLoading}
                            className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-40"
                          >
                            {job.gateLoading ? 'Checking…' : '↻ Re-check'}
                          </button>
                        </div>

                        {!gateOn ? (
                          <p className="text-gray-500 text-xs">
                            Asset approval gate is <strong className="text-gray-400">disabled</strong> for this job.
                            Toggle it on to require all campaign assets to be approved before publishing.
                          </p>
                        ) : gateStatus === null ? (
                          <p className="text-gray-500 text-xs italic">Gate check unavailable</p>
                        ) : gateStatus?.gated ? (
                          <div>
                            <p className="text-orange-300 text-xs mb-2">
                              🚫 Job is <strong>blocked</strong> — {blockers.length} asset{blockers.length !== 1 ? 's' : ''} require approval before this job can run.
                            </p>
                            <div className="space-y-1.5">
                              {blockers.map(a => (
                                <div key={a.id} className="flex items-center gap-2 bg-gray-900 rounded px-2 py-1.5">
                                  <span className="text-orange-400 text-xs">⏳</span>
                                  <span className="text-gray-300 text-xs font-medium truncate flex-1">{a.name || a.id}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700">
                                    {a.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-green-400 text-xs">
                            ✓ All campaign assets are approved — job can proceed.
                          </p>
                        )}
                      </div>

                      {/* Blocked reason (from DB, if job is in blocked state) */}
                      {isBlocked && job.blocked_reason && (
                        <div className="bg-orange-900/20 border border-orange-800 rounded-lg p-3">
                          <p className="text-orange-300 text-xs font-medium mb-1">Blocked by orchestrator</p>
                          <p className="text-gray-400 text-xs">
                            Reason: <span className="text-orange-300">{job.blocked_reason.reason}</span>
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            Approve the blocking assets, then re-queue or re-run this job.
                          </p>
                        </div>
                      )}

                      {/* Gate toggle guidance */}
                      <div className="text-xs text-gray-600 border-t border-gray-800 pt-3">
                        <p>
                          {gateOn
                            ? 'Gate is enabled. The orchestrator will block this job if any campaign assets have pending review requests.'
                            : 'Gate is disabled. The job will publish regardless of asset review status.'}
                        </p>
                        {['completed','failed','cancelled'].includes(job.status) && (
                          <p className="mt-1 text-gray-700">Gate toggle is locked for jobs in terminal state ({job.status}).</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {total > 15 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded disabled:opacity-30">
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-400">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 15 >= total}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded disabled:opacity-30">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────

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
      <div className="flex gap-3 mb-6">
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
          <option value="">All Actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-gray-500 text-sm self-center">{total} entries</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="text-gray-400 font-medium pb-3 pr-4">Time</th>
                <th className="text-gray-400 font-medium pb-3 pr-4">Actor</th>
                <th className="text-gray-400 font-medium pb-3 pr-4">Action</th>
                <th className="text-gray-400 font-medium pb-3 pr-4">Asset</th>
                <th className="text-gray-400 font-medium pb-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <>
                  <tr key={e.id}
                    className="border-b border-gray-900 hover:bg-gray-900/50 cursor-pointer"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">{fmtDate(e.created_at)}</td>
                    <td className="py-2.5 pr-4 text-gray-300">{e.actor_name || e.actor_email || '—'}</td>
                    <td className="py-2.5 pr-4">
                      <span className="bg-gray-800 text-amber-400 text-xs px-2 py-0.5 rounded font-mono">{e.action}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400 truncate max-w-[150px]">{e.asset_name || '—'}</td>
                    <td className="py-2.5 text-gray-600 text-xs">
                      {expanded === e.id ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr key={`${e.id}-exp`} className="border-b border-gray-900">
                      <td colSpan={5} className="pb-3 pt-0 px-4">
                        <pre className="bg-gray-900 text-gray-400 text-xs rounded p-3 overflow-auto max-h-32">
                          {JSON.stringify(e.detail, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {entries.length === 0 && (
            <div className="text-center py-12 text-gray-500">No audit entries found</div>
          )}

          {total > 25 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded disabled:opacity-30">Previous</button>
              <span className="px-4 py-2 text-sm text-gray-400">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 25 >= total}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function MediaCloudPage() {
  const [tab, setTab] = useState<Tab>('library');
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Media Cloud</h1>
          <p className="text-gray-400 text-sm mt-1">
            Enterprise asset library, governance policies, brand management, and audit trail.
          </p>
        </div>

        <TabBar active={tab} onChange={setTab} />

        {tab === 'library'    && <LibraryTab />}
        {tab === 'governance' && <GovernanceTab />}
        {tab === 'brands'     && <BrandsTab />}
        {tab === 'reviews'    && <ReviewsTab />}
        {tab === 'publishing' && <PublishingGateTab />}
        {tab === 'audit'      && <AuditLogTab />}
      </div>
    </div>
  );
}
