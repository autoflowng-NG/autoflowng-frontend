import React, { useState, useEffect, useRef } from 'react';
  import { useWebSocketContext } from '../contexts/WebSocketContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import {
  Clapperboard, ChevronDown, ChevronUp, RefreshCw, Download, Play,
  AlertCircle, CheckCircle2, Clock, Loader2, Camera, ZapOff,
} from 'lucide-react';

const API_BASE_32 = '/api/phase32';

interface MediaAsset {
  id: string;
  asset_type: string;
  status: string;
  ai_video_url?: string;
  ai_video_provider?: string;
  [key: string]: any;
}

interface VideoGenerationPanelProps {
  projectId: string;
  asset: MediaAsset;
}

interface Provider {
  key: string;
  label: string;
  configured: boolean;
  maxDuration: number;
  aspectRatios: string[];
  outputFormats: string[];
  supportsCamera: boolean;
}

interface CameraMotion {
  value: string;
  label: string;
  desc: string;
}

interface ShotSpec {
  index: number;
  description: string;
  cameraMotion: string | null;
  duration: number;
}

const ASPECT_LABELS: Record<string, string> = {
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '1:1': 'Square',
  '4:3': 'Standard',
  '3:4': 'Portrait Std',
};

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  building_prompt: 'Building Prompt',
  generating_shots: 'Generating Shots',
  submitting: 'Submitting to Provider',
  polling: 'Generating Video',
  downloading: 'Downloading',
  complete: 'Complete',
  failed: 'Failed',
};

const STAGE_ORDER = ['building_prompt', 'generating_shots', 'submitting', 'polling', 'downloading'];

export function AiVideoStatusBadge({ status, stage }: { status: string; stage: string }) {
  const colors: Record<string, string> = {
    pending:    'bg-slate-700/40 text-slate-400 border-slate-600/30',
    queued:     'bg-slate-700/40 text-slate-400 border-slate-600/30',
    processing: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    polling:    'bg-amber-500/20 text-amber-300 border-amber-500/30',
    complete:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    failed:     'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return (
    <Badge className={`text-[9px] px-1.5 py-0 border ${colors[status] || colors.queued} capitalize`}>
      {status === 'polling' || status === 'processing' ? (
        <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin inline" />
      ) : null}
      {STAGE_LABELS[stage] || stage}
    </Badge>
  );
}

export default function VideoGenerationPanel({ projectId, asset }: VideoGenerationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [cameraMotions, setCameraMotions] = useState<CameraMotion[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Form state
  const [inputType, setInputType] = useState<'prompt' | 'storyboard' | 'scene_plan'>('prompt');
  const [rawInput, setRawInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [durationSec, setDurationSec] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [outputFormat, setOutputFormat] = useState<'mp4' | 'webm'>('mp4');
  const [cameraMotion, setCameraMotion] = useState('static');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState('');
  const [showNegative, setShowNegative] = useState(false);
  const [showSeed, setShowSeed] = useState(false);

  // Prompt builder
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builtPrompt, setBuiltPrompt] = useState('');
  const [buildingPrompt, setBuildingPrompt] = useState(false);

  // Job state
  const [activeJob, setActiveJob] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { subscribe } = useWebSocketContext();
    const [parsedShots, setParsedShots] = useState<ShotSpec[]>([]);

    // Fix 2 — Live shot preview: debounced parse when typing storyboard/scene_plan
    useEffect(() => {
      if (inputType === 'prompt' || !rawInput.trim()) {
        setParsedShots([]);
        return;
      }
      const t = setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE_32}/build-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawPrompt: rawInput, aspectRatio }),
          });
          const json = await res.json();
          if (json.shots) setParsedShots(json.shots);
        } catch { /* ignore */ }
      }, 600);
      return () => clearTimeout(t);
    }, [rawInput, inputType, aspectRatio]);

  useEffect(() => {
    if (expanded && providers.length === 0) loadMeta();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [expanded]);

    // WebSocket: primary update path for active job progress
    useEffect(() => {
      if (!activeJob?.id) return;
      const activeJobId = activeJob.id;

      const unsubProgress = subscribe('media:progress', (event: any) => {
        if (event.jobId !== activeJobId) return;
        setActiveJob((prev: any) => ({
          ...prev,
          stage:    event.stage   || prev?.stage,
          progress: event.percent ?? prev?.progress,
        }));
      });

      const unsubComplete = subscribe('media:complete', (event: any) => {
        if (event.jobId !== activeJobId) return;
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setActiveJob((prev: any) => ({ ...prev, status: 'complete', ...(event.result || {}) }));
        unsubProgress();
        unsubComplete();
      });

      if (['processing', 'polling', 'pending', 'queued'].includes(activeJob.status)) {
        startPolling(activeJobId);
      }

      return () => { unsubProgress(); unsubComplete(); };
    }, [activeJob?.id]);

  async function loadMeta() {
    setLoadingMeta(true);
    try {
      const [pRes, mRes] = await Promise.all([
        fetch(`${API_BASE_32}/video-providers`),
        fetch(`${API_BASE_32}/camera-motions`),
      ]);
      const pJson = await pRes.json();
      const mJson = await mRes.json();
      if (pJson.success) {
        setProviders(pJson.providers);
        const first = pJson.providers.find((p: Provider) => p.configured);
        if (first) setSelectedProvider(first.key);
      }
      if (mJson.success) setCameraMotions(mJson.motions);

      // Check for existing job
      const jRes = await fetch(`${API_BASE_32}/projects/${projectId}/assets/${asset.id}/generate-video`);
      if (jRes.ok) {
        const jJson = await jRes.json();
        if (jJson.success) {
          setActiveJob(jJson.data);
          if (['processing', 'polling'].includes(jJson.data.status)) startPolling(jJson.data.id);
        }
      }
    } catch (_) {}
    finally { setLoadingMeta(false); }
  }

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_32}/ai-videos/${jobId}/progress`);
        const json = await res.json();
        if (json.success) {
          setActiveJob((prev: any) => ({ ...prev, ...json.data }));
          if (!['processing', 'polling'].includes(json.data.status)) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
          }
        }
      } catch (_) {}
    }, 3000);
  }

  async function buildPrompt() {
    if (!rawInput.trim()) return;
    setBuildingPrompt(true);
    try {
      const res = await fetch(`${API_BASE_32}/build-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawPrompt: rawInput,
          cameraMotion: cameraMotion || undefined,
          aspectRatio: aspectRatio || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) setBuiltPrompt(json.builtPrompt);
    } catch (_) {}
    finally { setBuildingPrompt(false); }
  }

  async function handleGenerate() {
    if (!selectedProvider || !rawInput.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_32}/projects/${projectId}/assets/${asset.id}/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          input_type: inputType,
          raw_input: rawInput,
          duration_sec: durationSec,
          aspect_ratio: aspectRatio,
          output_format: outputFormat,
          camera_motion: cameraMotion || null,
          style_preset: null,
          negative_prompt: negativePrompt || null,
          seed: seed ? parseInt(seed, 10) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Generation failed');
      } else {
        setActiveJob(json.data);
        startPolling(json.data.id);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const providerMeta = providers.find(p => p.key === selectedProvider);
  const isActive = activeJob && ['pending', 'queued', 'processing', 'polling'].includes(activeJob.status);
  const isComplete = activeJob?.status === 'complete';
  const isFailed = activeJob?.status === 'failed';
  const shots: ShotSpec[] = activeJob?.shots?.length ? activeJob.shots : parsedShots;
  const currentStageIdx = activeJob ? STAGE_ORDER.indexOf(activeJob.stage) : -1;
  const elapsed = activeJob?.created_at
    ? Math.round((Date.now() - new Date(activeJob.created_at).getTime()) / 1000)
    : 0;

  // Validate aspect ratio for selected provider
  const validAspectRatios = providerMeta?.aspectRatios || ['16:9'];
  if (providerMeta && !validAspectRatios.includes(aspectRatio)) {
    // auto-correct to first valid
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors py-1 px-2 rounded hover:bg-amber-500/5"
      >
        <span className="flex items-center gap-1.5">
          <Clapperboard className="w-3 h-3" />
          AI Video Generation
          {asset.ai_video_url && (
            <Badge className="text-[9px] px-1 py-0 bg-amber-500/20 text-amber-300 border-amber-500/30 border ml-1">✓</Badge>
          )}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <Card className="mt-1 bg-slate-950 border-amber-500/20">
          <CardContent className="pt-3 pb-3 space-y-3">
            {loadingMeta ? (
              <Skeleton className="h-24 w-full bg-slate-900 rounded" />
            ) : (
              <>
                {/* A — Input type selector */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Input Type</p>
                  <div className="flex gap-1">
                    {(['prompt', 'storyboard', 'scene_plan'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setInputType(t)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors capitalize ${
                          inputType === t
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="mt-1.5 w-full bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 placeholder-slate-600 p-2 resize-none focus:outline-none focus:border-amber-500/50"
                    rows={inputType === 'prompt' ? 3 : 6}
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value)}
                    placeholder={
                      inputType === 'prompt'
                        ? 'A lone astronaut walks across a red desert at golden hour, dust swirling around each step'
                        : inputType === 'storyboard'
                        ? 'Shot 1: Aerial view of a city at night, slow pan left\nShot 2: Ground level — busy intersection, dolly in toward traffic light'
                        : 'Scene 1: Establishing shot — mountain valley at dawn\nScene 2: Close-up on dewdrops on grass, static\nScene 3: Time-lapse clouds moving, tilt up'
                    }
                  />
                </div>

                {/* B — Cinematic Prompt Builder */}
                <div className="border border-slate-800 rounded">
                  <button
                    onClick={() => setBuilderOpen(b => !b)}
                    className="w-full flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-300 px-2 py-1.5 transition-colors"
                  >
                    <span>✨ Cinematic Prompt Builder</span>
                    {builderOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {builderOpen && (
                    <div className="px-2 pb-2 space-y-2 border-t border-slate-800">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-[10px] h-6 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        onClick={buildPrompt}
                        disabled={buildingPrompt || !rawInput.trim()}
                      >
                        {buildingPrompt ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Build Cinematic Prompt
                      </Button>
                      {builtPrompt && (
                        <div className="bg-slate-900 rounded p-2">
                          <p className="text-[9px] text-slate-500 mb-1 uppercase tracking-wider">Enhanced prompt preview</p>
                          <p className="text-[10px] text-slate-300 leading-relaxed">{builtPrompt}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* C — Provider selector */}
                {providers.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Provider</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {providers.map(p => (
                        <button
                          key={p.key}
                          disabled={!p.configured}
                          onClick={() => {
                            setSelectedProvider(p.key);
                            // Reset aspect ratio if current not supported
                            if (!p.aspectRatios.includes(aspectRatio)) setAspectRatio(p.aspectRatios[0]);
                            if (durationSec > p.maxDuration) setDurationSec(p.maxDuration);
                          }}
                          className={`relative text-left rounded border p-2 transition-all text-[10px] ${
                            p.configured
                              ? selectedProvider === p.key
                                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                              : 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{p.label}</span>
                            {p.supportsCamera && p.configured && (
                              <Camera className="w-2.5 h-2.5 text-amber-400/60" />
                            )}
                          </div>
                          <p className="text-[9px] mt-0.5 opacity-70">Up to {p.maxDuration}s</p>
                          {!p.configured && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 rounded">
                              <span className="text-[9px] text-slate-500 flex items-center gap-1">
                                <ZapOff className="w-2.5 h-2.5" /> Not configured
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* D — Generation parameters */}
                {providerMeta && (
                  <div className="space-y-2">
                    {/* Duration */}
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">
                        Duration (seconds): <span className="text-amber-400">{durationSec}s</span>
                      </p>
                      <input
                        type="range"
                        min={1}
                        max={providerMeta.maxDuration}
                        step={1}
                        value={durationSec}
                        onChange={e => setDurationSec(parseInt(e.target.value, 10))}
                        className="w-full accent-amber-500 h-1"
                      />
                    </div>

                    {/* Aspect ratio */}
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Aspect Ratio</p>
                      <div className="flex flex-wrap gap-1">
                        {providerMeta.aspectRatios.map(ar => (
                          <button
                            key={ar}
                            onClick={() => setAspectRatio(ar)}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                              aspectRatio === ar
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'
                            }`}
                          >
                            {ar} <span className="opacity-60">{ASPECT_LABELS[ar]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Output format */}
                    {providerMeta.outputFormats.length > 1 && (
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1">Output Format</p>
                        <div className="flex gap-1">
                          {providerMeta.outputFormats.map(f => (
                            <button
                              key={f}
                              onClick={() => setOutputFormat(f as 'mp4' | 'webm')}
                              className={`text-[9px] px-2 py-0.5 rounded border transition-colors uppercase ${
                                outputFormat === f
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                  : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Camera motion */}
                    {providerMeta.supportsCamera && cameraMotions.length > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1">Camera Motion</p>
                        <select
                          value={cameraMotion}
                          onChange={e => setCameraMotion(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 px-2 py-1 focus:outline-none focus:border-amber-500/50"
                        >
                          {cameraMotions.map(m => (
                            <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Negative prompt */}
                    <div>
                      <button
                        onClick={() => setShowNegative(n => !n)}
                        className="text-[10px] text-slate-500 hover:text-slate-400 flex items-center gap-1"
                      >
                        {showNegative ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                        Negative Prompt
                      </button>
                      {showNegative && (
                        <input
                          type="text"
                          value={negativePrompt}
                          onChange={e => setNegativePrompt(e.target.value)}
                          placeholder="blurry, low quality, watermark, text overlay"
                          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 placeholder-slate-600 px-2 py-1 focus:outline-none focus:border-amber-500/50"
                        />
                      )}
                    </div>

                    {/* Seed */}
                    <div>
                      <button
                        onClick={() => setShowSeed(s => !s)}
                        className="text-[10px] text-slate-500 hover:text-slate-400 flex items-center gap-1"
                      >
                        {showSeed ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                        Seed
                      </button>
                      {showSeed && (
                        <input
                          type="number"
                          value={seed}
                          onChange={e => setSeed(e.target.value)}
                          placeholder="Leave blank for random"
                          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 placeholder-slate-600 px-2 py-1 focus:outline-none focus:border-amber-500/50"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* E — Shot preview */}
                {shots.length > 0 && (
                  <div className="bg-slate-900 rounded p-2 space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Shot Breakdown</p>
                    {shots.map(s => (
                      <div key={s.index} className="flex items-start gap-2 text-[10px]">
                        <span className="text-slate-600 w-10 shrink-0">Shot {s.index}</span>
                        {s.cameraMotion && (
                          <Badge className="text-[8px] px-1 py-0 bg-slate-800 text-slate-400 border-slate-700 border shrink-0">
                            {s.cameraMotion}
                          </Badge>
                        )}
                        <span className="text-slate-400 truncate">{s.description}</span>
                        <span className="text-slate-600 shrink-0 ml-auto">{s.duration}s</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2 flex items-start gap-2">
                    <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-red-300">{error}</p>
                  </div>
                )}

                {/* F — Generate button */}
                {!isActive && !isComplete && (
                  <Button
                    onClick={handleGenerate}
                    disabled={submitting || !selectedProvider || !rawInput.trim() || isActive}
                    className="w-full h-7 text-[11px] font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Clapperboard className="w-3 h-3 mr-1.5" />}
                    Generate Video
                  </Button>
                )}

                {/* G — Progress indicator */}
                {isActive && (
                  <div className="space-y-2">
                    {/* Stage steps */}
                    <div className="flex items-center gap-0.5">
                      {STAGE_ORDER.map((stage, idx) => (
                        <React.Fragment key={stage}>
                          <div className={`flex-1 h-1 rounded-full transition-colors ${
                            idx <= currentStageIdx ? 'bg-amber-500' : 'bg-slate-800'
                          }`} />
                          {idx < STAGE_ORDER.length - 1 && <div className="w-0.5" />}
                        </React.Fragment>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-400 text-center">
                      {STAGE_LABELS[activeJob.stage] || activeJob.stage}
                    </p>
                    {activeJob.poll_count > 0 && (
                      <>
                        <Progress
                          value={Math.round((activeJob.poll_count / activeJob.poll_max) * 100)}
                          className="h-1 bg-slate-800"
                        />
                        <p className="text-[9px] text-slate-500 text-center">
                          Polling: {activeJob.poll_count} / {activeJob.poll_max} · {elapsed}s elapsed
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* H — Output */}
                {isComplete && activeJob.output_url && (
                  <div className="space-y-2">
                    <video
                      controls
                      autoPlay
                      loop
                      muted
                      className="w-full rounded border border-amber-500/20 bg-black"
                      src={`${API_BASE_32}/ai-videos/${activeJob.id}/stream`}
                      onError={e => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-300 border-amber-500/30 border">
                        Generated by {providers.find(p => p.key === activeJob.provider)?.label || activeJob.provider}
                      </Badge>
                      <Badge className="text-[9px] px-1.5 py-0 bg-slate-800 text-slate-400 border-slate-700 border">
                        {activeJob.aspect_ratio}
                      </Badge>
                      {activeJob.output_duration_ms && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-slate-800 text-slate-400 border-slate-700 border">
                          {(activeJob.output_duration_ms / 1000).toFixed(1)}s
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <a
                        href={`${API_BASE_32}/ai-videos/${activeJob.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full text-[10px] h-6 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                          <Download className="w-3 h-3 mr-1" /> Download
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-[10px] h-6 border-slate-700 text-slate-400 hover:bg-slate-800"
                        onClick={() => { setActiveJob(null); setError(null); }}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Re-generate
                      </Button>
                    </div>
                  </div>
                )}

                {/* I — Error state */}
                {isFailed && (
                  <div className="space-y-2">
                    <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertCircle className="w-3 h-3 text-red-400" />
                        <p className="text-[10px] font-semibold text-red-300">Generation failed</p>
                        {activeJob.error_stage && (
                          <Badge className="text-[8px] px-1 py-0 bg-red-500/20 text-red-400 border-red-500/30 border ml-auto">
                            at {activeJob.error_stage}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-red-400 font-mono">{activeJob.error_text}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-[10px] h-6 border-slate-700 text-slate-400 hover:bg-slate-800"
                      onClick={() => { setActiveJob(null); setError(null); }}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Try Again
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
