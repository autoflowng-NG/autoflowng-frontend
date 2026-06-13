/**
 * AutoFlowNG — Phase 30: AnimationPanel Component
 *
 * Renders for image assets with status === 'complete'. Allows the user to
 * pick a provider, style, and duration, then enqueue and monitor an animation job.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { CheckCircle2, XCircle, Clock, RefreshCw, Film, Sparkles, AlertCircle } from 'lucide-react';

const API_BASE_30 = '/api/phase30';

interface MediaAsset {
  id: string;
  asset_type: string;
  status: string;
  storage_url?: string;
  animated_clip_url?: string;
  [key: string]: any;
}

interface AnimationPanelProps {
  projectId: string;
  asset: MediaAsset;
}

const STYLES = [
  { value: 'ken_burns',  label: 'Ken Burns',   requiresRunway: false },
  { value: 'zoom_in',   label: 'Zoom In',      requiresRunway: false },
  { value: 'zoom_out',  label: 'Zoom Out',     requiresRunway: false },
  { value: 'pan_left',  label: 'Pan Left',     requiresRunway: false },
  { value: 'pan_right', label: 'Pan Right',    requiresRunway: false },
  { value: 'lip_sync',  label: 'Lip Sync',     requiresRunway: true  },
  { value: 'facial',    label: 'Facial Anim.', requiresRunway: true  },
];

function AnimationStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'complete':
      return <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Complete</Badge>;
    case 'failed':
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
    case 'processing':
      return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
    case 'pending':
      return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AnimationPanel({ projectId, asset }: AnimationPanelProps) {
  const [providers, setProviders]       = useState<string[]>(['local']);
  const [provider,  setProvider]        = useState('local');
  const [style,     setStyle]           = useState('ken_burns');
  const [duration,  setDuration]        = useState(4);
  const [animJob,   setAnimJob]         = useState<any | null>(null);
  const [loading,   setLoading]         = useState(false);
  const [animating, setAnimating]       = useState(false);
  const [error,     setError]           = useState<string | null>(null);

  // Fetch available providers
  useEffect(() => {
    fetch(`${API_BASE_30}/animation-providers`)
      .then(r => r.json())
      .then(json => { if (json.providers) setProviders(json.providers); })
      .catch(() => {});
  }, []);

  // Fetch latest animation job for this asset
  const fetchAnimJob = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE_30}/projects/${projectId}/assets/${asset.id}/animate`);
      if (res.status === 404) { setAnimJob(null); return; }
      const json = await res.json();
      if (json.success) setAnimJob(json.data);
    } catch (_) {}
  }, [projectId, asset.id]);

  useEffect(() => { fetchAnimJob(); }, [fetchAnimJob]);

  // Polling while job is pending/processing
  useEffect(() => {
    if (!animJob || animJob.status === 'complete' || animJob.status === 'failed') return;
    const interval = setInterval(fetchAnimJob, 3000);
    return () => clearInterval(interval);
  }, [animJob, fetchAnimJob]);

  const handleAnimate = async () => {
    setAnimating(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE_30}/projects/${projectId}/assets/${asset.id}/animate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          style,
          provider,
          params: provider === 'local' ? { duration_seconds: duration } : {},
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Failed to start animation');
      } else {
        setAnimJob(json.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnimating(false);
    }
  };

  const isRunning = animJob?.status === 'pending' || animJob?.status === 'processing';
  const selectedStyleInfo = STYLES.find(s => s.value === style);
  const streamUrl = animJob?.id ? `${API_BASE_30}/animations/${animJob.id}/stream` : null;
  const downloadUrl = animJob?.id ? `${API_BASE_30}/animations/${animJob.id}/download` : null;

  return (
    <Card className="bg-slate-950 border-violet-500/20 mt-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-2 text-violet-300">
          <Film className="w-3.5 h-3.5" />
          Animate Image
          {asset.animated_clip_url && (
            <Badge className="ml-auto bg-violet-500/10 text-violet-300 border-violet-500/20 text-[10px]">
              <Sparkles className="w-2.5 h-2.5 mr-1" /> Animated
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Controls */}
        <div className="grid grid-cols-2 gap-2">
          {/* Provider selector */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Provider</label>
            <Select value={provider} onValueChange={setProvider} disabled={isRunning}>
              <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {providers.map(p => (
                  <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Style selector */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Style</label>
            <Select value={style} onValueChange={setStyle} disabled={isRunning}>
              <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {STYLES.map(s => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">
                    {s.label}
                    {s.requiresRunway && (
                      <span className="ml-1 text-[10px] text-amber-400" title="Requires Runway provider">★ Runway</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Duration slider (local provider only) */}
        {provider === 'local' && (
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
              Duration: <span className="text-slate-300">{duration}s</span>
            </label>
            <Slider
              min={2} max={10} step={0.5}
              value={[duration]}
              onValueChange={([v]) => setDuration(v)}
              disabled={isRunning}
              className="w-full"
            />
          </div>
        )}

        {/* Runway warning for unsupported styles */}
        {selectedStyleInfo?.requiresRunway && provider !== 'runway' && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {style === 'lip_sync' || style === 'facial' ? 'Lip Sync and Facial styles require the Runway provider.' : ''}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-xs h-7"
            disabled={isRunning || animating}
            onClick={handleAnimate}
          >
            {animating
              ? <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> Queuing…</>
              : <><Film className="w-3 h-3 mr-1.5" /> Animate</>}
          </Button>

          {(animJob?.status === 'complete' || animJob?.status === 'failed') && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
              disabled={animating}
              onClick={handleAnimate}
            >
              Re-animate
            </Button>
          )}
        </div>

        {/* Status indicator */}
        {animJob && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                {animJob.style} · {animJob.provider}
                {animJob.duration_ms ? ` · ${(animJob.duration_ms / 1000).toFixed(1)}s` : ''}
              </span>
              <AnimationStatusBadge status={animJob.status} />
            </div>

            {animJob.status === 'failed' && animJob.error_text && (
              <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                {animJob.error_text}
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
            {error}
          </p>
        )}

        {/* Preview player */}
        {animJob?.status === 'complete' && streamUrl && (
          <div className="space-y-1.5">
            <video
              controls
              autoPlay
              loop
              muted
              className="w-full rounded border border-slate-800 bg-black max-h-36"
              src={streamUrl}
              onError={e => { (e.target as HTMLVideoElement).style.display = 'none'; }}
            />
            <a href={downloadUrl!} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="w-full text-[10px] h-6 border-violet-500/30 text-violet-300 hover:bg-violet-500/10">
                Download Animated Clip
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
