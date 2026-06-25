/**
 * ReportsCenter — Enterprise Redesign
 *
 * All existing hooks, API calls, mutations, and logic preserved exactly.
 * Visual layer only: inline styles, design tokens, no Tailwind.
 */

import React, { useState } from 'react';
import {
  useReportHistory,
  useReportSchedules,
  analyticsApi,
  type ReportSchedule,
  type GeneratedReport,
} from '../api/analyticsApi';
import {
  FileText, Download, Calendar, Clock, Mail, Trash2,
  Plus, Play, AlertCircle, Archive, BarChart2, FileDown,
  ChevronRight, CheckCircle2, PauseCircle, RefreshCw,
} from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:      '#060810',
  surface: '#0C0F1A',
  raised:  '#111520',
  border:  'rgba(255,255,255,0.06)',
  borderHv:'rgba(255,255,255,0.11)',
  text:    '#E2E8FF',
  muted:   'rgba(226,232,255,0.45)',
  faint:   'rgba(226,232,255,0.22)',
  green:   '#00C896',
  blue:    '#38BDF8',
  purple:  '#A78BFA',
  amber:   '#FBBF24',
  red:     '#FB7185',
};

/* ── Skeleton ──────────────────────────────────────────────────────── */
function Sk({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'rgba(255,255,255,0.05)',
      animation: 'af-pulse 1.8s ease-in-out infinite',
    }} />
  );
}

/* ── Card ──────────────────────────────────────────────────────────── */
function Card({
  children, accent = C.purple, style = {},
}: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>
      {/* top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
      }} />
      {children}
    </div>
  );
}

/* ── Section label ─────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontFamily: "'DM Mono', monospace",
      fontSize: 10, fontWeight: 600,
      letterSpacing: '0.12em',
      color: C.faint,
      textTransform: 'uppercase',
      marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

/* ── Stat Pill ─────────────────────────────────────────────────────── */
function StatPill({ label, value, color, icon: Icon }: {
  label: string; value: string | number; color: string; icon: any;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: `${color}10`,
      border: `1px solid ${color}28`,
      borderRadius: 10, padding: '10px 14px',
      flex: 1, minWidth: 120,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={14} color={color} />
      </div>
      <div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.muted, marginTop: 2, letterSpacing: '0.06em' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ── Badge ─────────────────────────────────────────────────────────── */
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontFamily: "'DM Mono', monospace",
      fontSize: 9, fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color,
      background: `${color}15`,
      border: `1px solid ${color}30`,
      borderRadius: 100,
      padding: '2px 8px',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

/* ── Input / Select shared style ───────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.raised,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 12,
  color: C.text,
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
};

/* ── Generate Report Panel ─────────────────────────────────────────── */
const GenerateReportPanel: React.FC = () => {
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [format,     setFormat]     = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      await analyticsApi.generateReport(reportType, format);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const TYPE_LABELS   = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
  const TYPE_DESCS    = { daily: 'Last 24 hours', weekly: 'Last 7 days', monthly: 'Last 30 days' };
  const TYPE_COLORS   = { daily: C.blue, weekly: C.purple, monthly: C.green };
  const FORMAT_LABELS = { pdf: 'PDF', csv: 'CSV', json: 'JSON' };
  const FORMAT_DESCS  = {
    pdf:  'Formatted report with charts and branding',
    csv:  'Raw data export for spreadsheets',
    json: 'Structured data for API consumers',
  };
  const FORMAT_COLORS = { pdf: C.red, csv: C.green, json: C.blue };

  return (
    <Card accent={C.purple}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `${C.purple}18`, border: `1px solid ${C.purple}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Download size={16} color={C.purple} />
        </div>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: C.text }}>
            Generate Report
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.faint, letterSpacing: '0.05em' }}>
            INSTANT EXPORT
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Report type */}
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.faint, letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
            Report Period
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(['daily', 'weekly', 'monthly'] as const).map(t => {
              const active = reportType === t;
              const col = TYPE_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => setReportType(t)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 9,
                    border: `1px solid ${active ? col + '50' : C.border}`,
                    background: active ? `${col}12` : C.raised,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: active ? col : C.muted }}>
                    {TYPE_LABELS[t]}
                  </span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.faint }}>
                    {TYPE_DESCS[t]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Format */}
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.faint, letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
            Export Format
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(['pdf', 'csv', 'json'] as const).map(f => {
              const active = format === f;
              const col = FORMAT_COLORS[f];
              return (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 9,
                    border: `1px solid ${active ? col + '50' : C.border}`,
                    background: active ? `${col}12` : C.raised,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: active ? col : C.muted }}>
                    {FORMAT_LABELS[f]}
                  </span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.faint }}>
                    {FORMAT_DESCS[f]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: `${C.red}10`, border: `1px solid ${C.red}30`,
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={13} color={C.red} />
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.red }}>{error}</span>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          marginTop: 16, width: '100%',
          padding: '12px 0', borderRadius: 10,
          background: loading ? 'rgba(0,200,150,0.15)' : C.green,
          border: `1px solid ${C.green}`,
          color: loading ? C.green : '#060810',
          fontFamily: "'DM Sans',sans-serif",
          fontSize: 13, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.15s',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <>
            <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
            Generating…
          </>
        ) : (
          <>
            <FileDown size={13} />
            Download {TYPE_LABELS[reportType]} {FORMAT_LABELS[format]} Report
          </>
        )}
      </button>
    </Card>
  );
};

/* ── Schedule Manager ──────────────────────────────────────────────── */
const ScheduleManager: React.FC = () => {
  const { data: schedules, loading, refetch } = useReportSchedules();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reportType: 'weekly', frequency: 'weekly', format: 'pdf', recipientEmail: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.recipientEmail.includes('@')) return;
    setSaving(true);
    try {
      await analyticsApi.createSchedule({
        report_type:     form.reportType as ReportSchedule['frequency'],
        frequency:       form.frequency  as ReportSchedule['frequency'],
        format:          form.format     as ReportSchedule['format'],
        recipient_email: form.recipientEmail,
        active:          true,
      });
      setShowForm(false);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    await analyticsApi.updateSchedule(id, { active: !active });
    refetch();
  };

  const handleDelete = async (id: number) => {
    await analyticsApi.deleteSchedule(id);
    refetch();
  };

  const FREQ_COLORS: Record<string, string> = {
    daily: C.blue, weekly: C.purple, monthly: C.green,
  };

  return (
    <Card accent={C.blue}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `${C.blue}18`, border: `1px solid ${C.blue}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Calendar size={16} color={C.blue} />
          </div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: C.text }}>
              Scheduled Reports
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.faint, letterSpacing: '0.05em' }}>
              AUTO-DELIVERY
            </div>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 8,
              background: `${C.green}15`, border: `1px solid ${C.green}30`,
              color: C.green, fontFamily: "'DM Sans',sans-serif",
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Add Schedule
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map(i => <Sk key={i} h={44} r={9} />)}
        </div>
      ) : (
        <>
          {(!schedules || schedules.length === 0) && !showForm && (
            <div style={{
              textAlign: 'center', padding: '28px 0',
              fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.faint,
            }}>
              No scheduled reports yet. Create one to auto-deliver reports.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {schedules?.map(s => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 9,
                  border: `1px solid ${C.border}`,
                  background: C.raised,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                  <Badge label={s.frequency}   color={FREQ_COLORS[s.frequency] || C.purple} />
                  <Badge label={s.format}      color={C.muted} />
                  <Badge label={s.report_type} color={C.faint} />
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.recipient_email}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 10 }}>
                  {s.last_run_at && (
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.faint }}>
                      {new Date(s.last_run_at).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    onClick={() => handleToggle(s.id, s.active)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 100,
                      border: `1px solid ${s.active ? C.green + '40' : C.border}`,
                      background: s.active ? `${C.green}12` : C.raised,
                      color: s.active ? C.green : C.faint,
                      fontFamily: "'DM Mono',monospace", fontSize: 9,
                      fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em',
                    }}
                  >
                    {s.active
                      ? <><CheckCircle2 size={10} /> ACTIVE</>
                      : <><PauseCircle size={10} /> PAUSED</>
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    style={{
                      background: 'none', border: 'none',
                      color: C.faint, cursor: 'pointer',
                      display: 'flex', alignItems: 'center',
                      padding: 4, borderRadius: 6,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.red}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = C.faint}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* New schedule form */}
          {showForm && (
            <div style={{
              marginTop: 12, padding: 16, borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.raised,
            }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12 }}>
                New Schedule
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.faint, letterSpacing: '0.07em', marginBottom: 6, textTransform: 'uppercase' }}>
                    Report Type
                  </div>
                  <select
                    value={form.reportType}
                    onChange={e => setForm(f => ({ ...f, reportType: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.faint, letterSpacing: '0.07em', marginBottom: 6, textTransform: 'uppercase' }}>
                    Frequency
                  </div>
                  <select
                    value={form.frequency}
                    onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.faint, letterSpacing: '0.07em', marginBottom: 6, textTransform: 'uppercase' }}>
                    Format
                  </div>
                  <select
                    value={form.format}
                    onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: C.faint, letterSpacing: '0.07em', marginBottom: 6, textTransform: 'uppercase' }}>
                    Recipient Email
                  </div>
                  <input
                    type="email"
                    value={form.recipientEmail}
                    onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))}
                    placeholder="admin@company.com"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.recipientEmail.includes('@')}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: C.green, border: `1px solid ${C.green}`,
                    color: '#060810', fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12, fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving || !form.recipientEmail.includes('@') ? 0.5 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Create Schedule'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: '8px 14px', borderRadius: 8,
                    background: 'none', border: `1px solid ${C.border}`,
                    color: C.muted, fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

/* ── Report History ────────────────────────────────────────────────── */
const ReportHistoryPanel: React.FC = () => {
  const { data: history, loading } = useReportHistory();

  const fmtSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes > 1_000)     return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const FORMAT_COLORS: Record<string, string> = {
    pdf:  C.red,
    csv:  C.green,
    json: C.blue,
  };

  const cols = ['Type', 'Period', 'Format', 'Size', 'Email Sent', 'Generated'];

  return (
    <Card accent={C.amber}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `${C.amber}18`, border: `1px solid ${C.amber}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Archive size={16} color={C.amber} />
        </div>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: C.text }}>
            Report Archive
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.faint, letterSpacing: '0.05em' }}>
            HISTORY &amp; DOWNLOADS
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => <Sk key={i} h={36} r={8} />)}
        </div>
      ) : (
        <>
          {(!history || history.length === 0) && (
            <div style={{
              textAlign: 'center', padding: '36px 0',
              fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.faint,
            }}>
              No reports generated yet.
            </div>
          )}
          {history && history.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {cols.map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '8px 12px 10px',
                        fontFamily: "'DM Mono',monospace", fontSize: 9,
                        fontWeight: 700, letterSpacing: '0.1em',
                        color: C.faint, textTransform: 'uppercase',
                        borderBottom: `1px solid ${C.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((r: GeneratedReport) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 12px', fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.text, textTransform: 'capitalize' }}>
                        {r.report_type}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.muted, textTransform: 'capitalize' }}>
                        {r.report_period}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge label={r.format.toUpperCase()} color={FORMAT_COLORS[r.format] || C.muted} />
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'DM Mono',monospace", fontSize: 11, color: C.muted }}>
                        {fmtSize(r.file_size_bytes)}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.faint, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.email_sent_to || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.faint, whiteSpace: 'nowrap' }}>
                        {new Date(r.generated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

/* ── Main ──────────────────────────────────────────────────────────── */
export default function ReportsCenter() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes af-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        select option { background: #0C0F1A; color: #E2E8FF; }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        background: 'rgba(6,8,16,0.85)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 20,
        padding: '18px 32px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <SectionLabel>INSIGHTS · REPORTS CENTER</SectionLabel>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>
              Reports Center
            </h1>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.muted, margin: '3px 0 0' }}>
              Executive Reporting — PDF, CSV, JSON export and scheduled delivery
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: `${C.green}10`, border: `1px solid ${C.green}25`,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: C.green, letterSpacing: '0.06em' }}>
              REPORTS READY
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px' }}>

        {/* ── Stat pills ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatPill label="REPORT TYPES" value="3"      color={C.purple} icon={FileText}  />
          <StatPill label="FORMATS"      value="PDF · CSV · JSON" color={C.blue}   icon={FileDown}  />
          <StatPill label="DELIVERY"     value="Email"  color={C.green}  icon={Mail}      />
          <StatPill label="COVERAGE"     value="30 days" color={C.amber} icon={Clock}     />
        </div>

        {/* ── Info banner ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 20, flexWrap: 'wrap',
          padding: '12px 16px', borderRadius: 10,
          background: C.surface, border: `1px solid ${C.border}`,
          marginBottom: 24,
        }}>
          {[
            { icon: '📊', label: 'Daily', desc: 'Last 24h of data', color: C.blue },
            { icon: '📈', label: 'Weekly', desc: 'Last 7 days', color: C.purple },
            { icon: '📋', label: 'Monthly', desc: 'Last 30 days + forecasts', color: C.green },
            { icon: '📧', label: 'Schedules', desc: 'Require SMTP config', color: C.amber },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: item.color, fontWeight: 600 }}>
                {item.label}
              </span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.faint }}>
                — {item.desc}
              </span>
            </div>
          ))}
        </div>

        {/* ── Two-column: Generate + Schedules ───────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <GenerateReportPanel />
          <ScheduleManager />
        </div>

        {/* ── Archive table ───────────────────────────────────────── */}
        <ReportHistoryPanel />
      </div>
    </div>
  );
}
