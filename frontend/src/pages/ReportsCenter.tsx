/**
 * AutoFlowNG — Phase 14 Reports Center
 * Executive Reporting Center — generate, download, schedule, and archive reports.
 *
 * Route: /reports
 */

import React, { useState } from 'react';
import {
  useReportHistory,
  useReportSchedules,
  analyticsApi,
  type ReportSchedule,
  type GeneratedReport,
} from '../api/analyticsApi';

// ── Layout primitives ─────────────────────────────────────────────────────────
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({
  title, children, className = '',
}) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
    {title && <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>}
    {children}
  </div>
);

const Skeleton: React.FC<{ h?: string }> = ({ h = 'h-24' }) => (
  <div className={`${h} bg-slate-800 rounded-lg animate-pulse`} />
);

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${color}`}>
    {label}
  </span>
);

// ── Generate Report Panel ─────────────────────────────────────────────────────
const GenerateReportPanel: React.FC = () => {
  const [reportType, setReportType] = useState<'daily'|'weekly'|'monthly'>('weekly');
  const [format,     setFormat]     = useState<'pdf'|'csv'|'json'>('pdf');
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
  const FORMAT_LABELS = { pdf: 'PDF', csv: 'CSV', json: 'JSON' };
  const FORMAT_DESCS  = {
    pdf:  'Formatted report with charts and branding',
    csv:  'Raw data export for spreadsheets',
    json: 'Structured data for API consumers',
  };

  return (
    <Card title="Generate Report">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Report type */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider block mb-3">Report Period</label>
          <div className="space-y-2">
            {(['daily','weekly','monthly'] as const).map(t => (
              <button
                key={t}
                onClick={() => setReportType(t)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                  reportType === t
                    ? 'border-indigo-600 bg-indigo-950/50 text-indigo-300'
                    : 'border-slate-800 bg-slate-800/30 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-sm font-medium">{TYPE_LABELS[t]}</span>
                <span className="text-xs text-slate-600">
                  {t === 'daily' && 'Last 24h'}
                  {t === 'weekly' && 'Last 7 days'}
                  {t === 'monthly' && 'Last 30 days'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider block mb-3">Export Format</label>
          <div className="space-y-2">
            {(['pdf','csv','json'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                  format === f
                    ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
                    : 'border-slate-800 bg-slate-800/30 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-sm font-semibold">{FORMAT_LABELS[f]}</span>
                <span className="text-xs text-slate-600">{FORMAT_DESCS[f]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-950/30 border border-red-900 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-6 w-full py-3 rounded-xl font-semibold text-sm
                   bg-gradient-to-r from-indigo-600 to-violet-600
                   hover:from-indigo-500 hover:to-violet-500
                   disabled:opacity-50 disabled:cursor-not-allowed
                   text-white transition-all shadow-lg shadow-indigo-500/20"
      >
        {loading ? 'Generating…' : `Download ${TYPE_LABELS[reportType]} ${FORMAT_LABELS[format]} Report`}
      </button>
    </Card>
  );
};

// ── Schedule Manager ──────────────────────────────────────────────────────────
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
    daily:   'text-blue-400   bg-blue-950   border-blue-800',
    weekly:  'text-indigo-400 bg-indigo-950 border-indigo-800',
    monthly: 'text-violet-400 bg-violet-950 border-violet-800',
  };

  return (
    <Card title="Scheduled Reports">
      {loading ? <Skeleton /> : (
        <>
          {(!schedules || schedules.length === 0) && !showForm && (
            <p className="text-slate-600 text-sm text-center py-4">No scheduled reports. Create one below.</p>
          )}

          {schedules?.map(s => (
            <div key={s.id}
                 className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-800/30 mb-2">
              <div className="flex items-center gap-3 min-w-0">
                <Badge label={s.frequency}   color={FREQ_COLORS[s.frequency] || FREQ_COLORS.weekly} />
                <Badge label={s.format}      color="text-slate-300 bg-slate-800 border-slate-700" />
                <Badge label={s.report_type} color="text-slate-400 bg-slate-900 border-slate-800" />
                <span className="text-xs text-slate-400 truncate">{s.recipient_email}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {s.last_run_at && (
                  <span className="text-[10px] text-slate-600">
                    Last: {new Date(s.last_run_at).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => handleToggle(s.id, s.active)}
                  className={`text-xs px-2 py-1 rounded-md border transition-all ${
                    s.active
                      ? 'text-emerald-400 border-emerald-800 bg-emerald-950/50 hover:bg-emerald-950'
                      : 'text-slate-500 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {s.active ? 'Active' : 'Paused'}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          {/* New schedule form */}
          {showForm ? (
            <div className="mt-3 p-4 rounded-lg border border-slate-700 bg-slate-800/50 space-y-3">
              <h4 className="text-xs font-semibold text-slate-300">New Schedule</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Report Type</label>
                  <select value={form.reportType}
                          onChange={e => setForm(f => ({ ...f, reportType: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Frequency</label>
                  <select value={form.frequency}
                          onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Format</label>
                  <select value={form.format}
                          onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200">
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Recipient Email</label>
                  <input
                    type="email"
                    value={form.recipientEmail}
                    onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))}
                    placeholder="admin@company.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200
                               focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.recipientEmail.includes('@')}
                  className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                             text-white rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Create Schedule'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 w-full py-2.5 text-xs font-medium text-indigo-400
                         border border-dashed border-slate-700 rounded-lg
                         hover:border-indigo-600 hover:bg-indigo-950/30 transition-all"
            >
              + Add Report Schedule
            </button>
          )}
        </>
      )}
    </Card>
  );
};

// ── Report History ────────────────────────────────────────────────────────────
const ReportHistoryPanel: React.FC = () => {
  const { data: history, loading } = useReportHistory();

  const fmtSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes > 1_000)     return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const FORMAT_COLORS: Record<string, string> = {
    pdf:  'text-red-400   bg-red-950   border-red-800',
    csv:  'text-green-400 bg-green-950 border-green-800',
    json: 'text-blue-400  bg-blue-950  border-blue-800',
  };

  return (
    <Card title="Report Archive">
      {loading ? <Skeleton h="h-40" /> : (
        <>
          {(!history || history.length === 0) && (
            <p className="text-slate-600 text-sm text-center py-4">No reports generated yet.</p>
          )}
          {history && history.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Type','Period','Format','Size','Email Sent','Generated'].map(h => (
                      <th key={h} className="text-left text-slate-500 font-medium py-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => (
                    <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="py-2 pr-4 text-slate-200 capitalize">{r.report_type}</td>
                      <td className="py-2 pr-4 text-slate-400 capitalize">{r.report_period}</td>
                      <td className="py-2 pr-4">
                        <Badge label={r.format.toUpperCase()} color={FORMAT_COLORS[r.format] || 'text-slate-400 bg-slate-800 border-slate-700'} />
                      </td>
                      <td className="py-2 pr-4 text-slate-400 font-mono">{fmtSize(r.file_size_bytes)}</td>
                      <td className="py-2 pr-4 text-slate-500 truncate max-w-[120px]">{r.email_sent_to || '—'}</td>
                      <td className="py-2 pr-4 text-slate-500">
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReportsCenter() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-[1200px] mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-white tracking-tight">Reports Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Executive Reporting — PDF, CSV, JSON export and scheduled delivery
          </p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">

        {/* Quick info banner */}
        <div className="flex gap-6 p-4 bg-slate-900/50 border border-slate-800 rounded-xl text-xs text-slate-500">
          <span>📊 <span className="text-slate-300 font-medium">Daily</span> — last 24h of data</span>
          <span>📈 <span className="text-slate-300 font-medium">Weekly</span> — last 7 days</span>
          <span>📋 <span className="text-slate-300 font-medium">Monthly</span> — last 30 days with forecasts</span>
          <span>📧 Schedules require SMTP configuration</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GenerateReportPanel />
          <ScheduleManager />
        </div>

        <ReportHistoryPanel />
      </div>
    </div>
  );
}
