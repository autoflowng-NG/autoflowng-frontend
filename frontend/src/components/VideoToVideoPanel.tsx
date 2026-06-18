/**
 * AutoFlowNG — Phase 34: Video-to-Video Transformation Panel
 * Self-contained panel for selecting a style and submitting a V2V transformation job.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
  import { useWebSocketContext } from '../contexts/WebSocketContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Wand2, RefreshCw, Download, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';

const API_BASE_34 = '/api/phase34';

interface VideoToVideoPanelProps {
  projectId: string;
  asset:     any;
}

interface V2VProvider {
  id:         string;
  configured: boolean;
  styles:     string[];
}

interface V2VJob {
  id:               string;
  status:           string;
  stage:            string;
  progress:         number;
  poll_count:       number;
  poll_max:         number;
  provider:         string;
  style_target:     string;
  error_text:       string | null;
  output_video_url: string | null;
  output_asset_id:  string | null;
  updated_at:       string;
  created_at?:      string;
}

const STYLE_CARDS = [
  { id: 'anime',       emoji: '🎌', label: 'Anime',       desc: 'Cel-shaded anime, vivid colour' },
  { id: 'pixar',       emoji: '🎬', label: 'Pixar',       desc: 'Pixar 3D, smooth rounded forms' },
  { id: 'comic',       emoji: '💥', label: 'Comic',       desc: 'Comic book halftone, ink lines' },
  { id: 'cyberpunk',   emoji: '🌆', label: 'Cyberpunk',   desc: 'Neon-lit dystopia, glowing edges' },
  { id: 'watercolour', emoji: '🎨', label: 'Watercolour', desc: 'Soft washes, brushstroke texture' },
];

const STAGE_LABELS: Record<string, string> = {
  queued:      'Queued',
  submitting:  'Submitting',
  polling:     'Polling',
  downloading: 'Downloading',
  complete:    'Complete',
  failed:      'Failed',
};

// ── V2VStatusBadge export ──────────────────────────────────────────────────────
export function V2VStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string; pulse?: boolean }> = {
    pending:    { className: 'bg-amber-500/20 text-amber-300 border-amber-500/30',   label: 'Pending' },
    processing: { className: 'bg-blue-500/20 text-blue-300 border-blue-500/30',     label: 'Processing', pulse: true },
    polling:    { className: 'bg-blue-500/20 text-blue-300 border-blue-500/30',     label: 'Polling',    pulse: true },
    complete:   { className: 'bg-green-500/20 text-green-300 border-green-500/30',  label: 'V2V ✓' },
    failed:     { className: 'bg-red-500/20 text-red-300 border-red-500/30',        label: 'V2V Failed' },
  };
  const c = config[status] || config['pending'];
  return (
    <Badge className={`text-[9px] px-1.5 py-0 ${c.className} ${c.pulse ? 'animate-pulse' : ''}`}>
      {c.label}
    </Badge>
  );
}

// ── Main VideoToVideoPanel ─────────────────────────────────────────────────────
export default function VideoToVideoPanel({ projectId, asset }: VideoToVideoPanelProps) {
  const [providers, setProviders]             = useState<V2VProvider[]>([]);
  const [selectedStyle, setSelectedStyle]     = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [styleStrength, setStyleStrength]     = useState<number>(0.75);
  const [styleNotes, setStyleNotes]           = useState<string>('');
  const [previewPrompt, setPreviewPrompt]     = useState<string>('');
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [activeJob, setActiveJob]             = useState<V2VJob | null>(null);
  const [elapsedSec, setElapsedSec]           = useState(0);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const { subscribe } = useWebSocketContext();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load providers on mount

    // WebSocket: primary update path — cancel HTTP poll when terminal event arrives
    useEffect(() => {
      const activeJobId = (activeJob as any)?.id;
      if (!activeJobId) return;

      const unsubV2V = subscribe('v2v:complete', (event: any) => {
        if (event.jobId !== activeJobId) return;
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setActiveJob((prev: any) => ({ ...prev, status: 'complete', output_url: event.outputUrl }));
        unsubV2V();
      });

      return () => unsubV2V();
    }, [(activeJob as any)?.id]);

    useEffect(() => {
    fetch(`${API_BASE_34}/v2v-providers`)
      .then(r => r.json())
      .then(data => setProviders(data.providers || []))
      .catch(() => {});
  }, []);

  // Debounced prompt preview
  useEffect(() => {
    if (!selectedStyle) { setPreviewPrompt(''); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewLoading(true);
      fetch(`${API_BASE_34}/v2v-preview-prompt`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ style_target: selectedStyle, user_prompt: styleNotes }),
      })
        .then(r => r.json())
        .then(data => { setPreviewPrompt(data.stylePrompt || ''); })
        .catch(() => {})
        .finally(() => setPreviewLoading(false));
    }, 400);
  }, [selectedStyle, styleNotes]);

  // Polling active job
  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE_34}/v2v/${jobId}/progress`);
        if (!r.ok) return;
        const job: V2VJob = await r.json();
        setActiveJob(job);

        if (job.status === 'complete' || job.status === 'failed') {
          clearInterval(pollRef.current!);
          clearInterval(timerRef.current!);
        }
      } catch {}
    }, 3000);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const configuredProviders = providers.filter(p => p.configured);
  const isJobRunning = activeJob && (activeJob.status === 'processing' || activeJob.status === 'polling');

  async function handleSubmit() {
    if (!selectedStyle || submitting || isJobRunning) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE_34}/v2v`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          asset_id:       asset.id,
          project_id:     projectId,
          style_target:   selectedStyle,
          provider:       selectedProvider,
          style_strength: styleStrength,
          style_prompt:   styleNotes || undefined,
        }),
      });
      const job = await r.json();
      if (!r.ok) {
        alert(job.message || job.error || 'Failed to submit V2V job');
        return;
      }
      setActiveJob(job);
      setElapsedSec(0);
      startPolling(job.id);
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 border border-indigo-500/20 rounded-xl bg-slate-950/80 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold text-indigo-300">Video-to-Video Transform</span>
        <span className="text-[9px] text-slate-600 ml-auto">Phase 34</span>
      </div>

      {/* ── A: Style cards ──────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STYLE_CARDS.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedStyle(s.id === selectedStyle ? '' : s.id)}
            className={`
              flex-shrink-0 flex flex-col items-center gap-0.5 rounded-lg border px-2.5 py-2 text-center
              transition-colors cursor-pointer
              ${selectedStyle === s.id
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
              }
            `}
          >
            <span className="text-base leading-none">{s.emoji}</span>
            <span className="text-[9px] font-semibold mt-0.5">{s.label}</span>
            <span className="text-[8px] text-slate-500 max-w-[64px] leading-tight">{s.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Provider + strength ──────────────────────────────────────────── */}
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <p className="text-[9px] text-slate-500 mb-1">Provider</p>
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger className="h-7 text-[11px] bg-slate-900 border-slate-700">
              <SelectValue placeholder="auto" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              <SelectItem value="auto" className="text-[11px]">auto</SelectItem>
              {providers.map(p => (
                <SelectItem
                  key={p.id}
                  value={p.id}
                  disabled={!p.configured}
                  className="text-[11px]"
                >
                  {p.id}
                  {!p.configured && <span className="text-slate-600 ml-1">🔑 No API key</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <p className="text-[9px] text-slate-500 mb-1">Style Strength <span className="text-slate-400">{styleStrength.toFixed(2)}</span></p>
          <Slider
            min={0} max={1} step={0.05}
            value={[styleStrength]}
            onValueChange={([v]) => setStyleStrength(v)}
            className="h-4"
          />
        </div>
      </div>

      {/* ── Enrichment prompt ────────────────────────────────────────────── */}
      <div>
        <p className="text-[9px] text-slate-500 mb-1">Style notes (optional)</p>
        <Input
          value={styleNotes}
          onChange={e => setStyleNotes(e.target.value)}
          placeholder='e.g. "rainy night, intense atmosphere"'
          className="h-7 text-[11px] bg-slate-900 border-slate-700 placeholder:text-slate-600"
        />
      </div>

      {/* ── B: Style prompt preview ──────────────────────────────────────── */}
      {selectedStyle && (
        <div>
          <p className="text-[9px] text-slate-500 mb-1 flex items-center gap-1">
            Prompt preview
            {previewLoading && <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-600" />}
          </p>
          <pre className="text-[9px] text-slate-400 bg-slate-900 border border-slate-800 rounded p-2 whitespace-pre-wrap leading-relaxed overflow-hidden">
            {previewPrompt || '…'}
          </pre>
        </div>
      )}

      {/* ── C: Submit button ─────────────────────────────────────────────── */}
      <Button
        size="sm"
        className="w-full h-7 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white"
        disabled={!selectedStyle || submitting || !!isJobRunning || configuredProviders.length === 0}
        onClick={handleSubmit}
      >
        {submitting ? (
          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Submitting…</>
        ) : isJobRunning ? (
          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Transforming…</>
        ) : (
          <><Wand2 className="w-3 h-3 mr-1" /> Transform Video</>
        )}
      </Button>

      {configuredProviders.length === 0 && (
        <p className="text-[9px] text-amber-500/80 text-center">No V2V providers configured. Set a provider API key.</p>
      )}

      {/* ── D: Progress display ──────────────────────────────────────────── */}
      {activeJob && (
        <div className="space-y-2 border border-slate-800 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className="text-[9px] px-1.5 py-0 bg-slate-800 text-slate-300 border-slate-700">
              {activeJob.provider}
            </Badge>
            <Badge className="text-[9px] px-1.5 py-0 bg-slate-800 text-slate-300 border-slate-700">
              {activeJob.style_target}
            </Badge>
            <Badge className={`text-[9px] px-1.5 py-0 ${
              activeJob.stage === 'complete'   ? 'bg-green-500/20 text-green-300 border-green-500/30' :
              activeJob.stage === 'failed'     ? 'bg-red-500/20 text-red-300 border-red-500/30' :
              'bg-blue-500/20 text-blue-300 border-blue-500/30'
            }`}>
              {STAGE_LABELS[activeJob.stage] || activeJob.stage}
            </Badge>
            <span className="text-[9px] text-slate-600 ml-auto">{elapsedSec}s elapsed</span>
          </div>

          <Progress value={activeJob.progress} className="h-1.5" />

          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500">
              Poll {activeJob.poll_count} / {activeJob.poll_max}
            </span>
            <span className="text-[9px] text-slate-500">{activeJob.progress}%</span>
          </div>

          {activeJob.status === 'failed' && activeJob.error_text && (
            <div className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/20 rounded p-2">
              <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-400">{activeJob.error_text}</p>
            </div>
          )}
        </div>
      )}

      {/* ── E: Output video preview ──────────────────────────────────────── */}
      {activeJob?.status === 'complete' && activeJob.output_video_url && (
        <div className="space-y-2 border border-emerald-500/20 rounded-lg p-2.5 bg-emerald-500/5">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-300">Transform complete</span>
          </div>
          <video
            controls
            className="w-full rounded border border-slate-800 bg-black max-h-36"
            src={activeJob.output_video_url}
            onError={e => { (e.target as HTMLVideoElement).style.display = 'none'; }}
          />
          <div className="flex gap-2">
            <a
              href={activeJob.output_video_url}
              download
              className="flex-1"
            >
              <Button size="sm" variant="outline" className="w-full h-6 text-[10px] border-slate-700">
                <Download className="w-3 h-3 mr-1" /> Download
              </Button>
            </a>
            <Button size="sm" variant="outline" disabled className="flex-1 h-6 text-[10px] border-slate-700 text-slate-500">
              Use as Asset (coming soon)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
