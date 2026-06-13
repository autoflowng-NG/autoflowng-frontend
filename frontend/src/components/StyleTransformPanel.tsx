/**
 * AutoFlowNG — Phase 31: StyleTransformPanel Component
 * 5-card style selector, provider/fps/strength controls, live progress, inline video preview.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
  import { useWebSocketContext } from '../contexts/WebSocketContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Wand2, CheckCircle2, XCircle, Clock, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';

const API_BASE_31 = '/api/phase31';

const STYLE_CARDS = [
  { value: 'anime',     label: 'Anime',                  desc: 'Cel-shaded animation style' },
  { value: 'cartoon',   label: 'Cartoon',                desc: 'Bold outlines, flat vibrant colours' },
  { value: 'comic',     label: 'Comic Book',             desc: 'Halftone dots, ink lines, dramatic contrast' },
  { value: 'cinematic', label: 'Cinematic Illustration', desc: 'Painterly with filmic colour grading' },
  { value: 'storybook', label: 'Storybook',              desc: 'Warm pastels, hand-drawn softness' },
];

const STAGES = ['queued','extracting_frames','converting_frames','reassembling','syncing_audio','complete'];
const STAGE_LABELS: Record<string,string> = {
  queued:'Queued', extracting_frames:'Extracting', converting_frames:'Converting',
  reassembling:'Reassembling', syncing_audio:'Syncing Audio', complete:'Complete',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'complete') return <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1"/>Complete</Badge>;
  if (status === 'failed')  return <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><XCircle className="w-3 h-3 mr-1"/>Failed</Badge>;
  if (status === 'processing') return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/>Processing</Badge>;
  if (status === 'pending') return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"><Clock className="w-3 h-3 mr-1"/>Pending</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

interface StyleTransformPanelProps { projectId: string; asset: any; }

export default function StyleTransformPanel({ projectId, asset }: StyleTransformPanelProps) {
  const [providers,   setProviders]   = useState<string[]>(['local']);
  const [provider,    setProvider]    = useState('local');
  const [styleTarget, setStyleTarget] = useState('anime');
  const [fps,         setFps]         = useState(8);
  const [maxFrames,   setMaxFrames]   = useState(200);
  const [strength,    setStrength]    = useState(0.65);
  const [styleJob,    setStyleJob]    = useState<any|null>(null);
  const [progress,    setProgress]    = useState<any|null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string|null>(null);
  const [elapsed,     setElapsed]     = useState(0);

  useEffect(() => {
    fetch(`${API_BASE_31}/style-providers`).then(r=>r.json()).then(j=>{
      if (j.providers) { setProviders(j.providers); setProvider(j.providers.includes('replicate')?'replicate':'local'); }
    }).catch(()=>{});
  }, []);

  const fetchStyleJob = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE_31}/projects/${projectId}/assets/${asset.id}/style`);
      if (res.status===404) { setStyleJob(null); return; }
      const json = await res.json();
      if (json.success) setStyleJob(json.data);
    } catch (_) {}
  }, [projectId, asset.id]);

  useEffect(() => { fetchStyleJob(); }, [fetchStyleJob]);

  useEffect(() => {
    if (!styleJob || styleJob.status==='complete' || styleJob.status==='failed') return;
    const iv = setInterval(fetchStyleJob, 3000);
      const { subscribe } = useWebSocketContext();
      const unsub = subscribe('v2v:complete', (event: any) => {
        if (!styleJob?.id || event.jobId !== styleJob.id) return;
        clearInterval(iv);
        setStyleJob((prev: any) => ({ ...prev, status: 'complete', outputUrl: event.outputUrl }));
        unsub();
      });
      return () => { clearInterval(iv); unsub(); };
  }, [styleJob, fetchStyleJob]);

  const fetchProgress = useCallback(async () => {
    if (!styleJob?.id) return;
    try {
      const res  = await fetch(`${API_BASE_31}/styles/${styleJob.id}/progress`);
      const json = await res.json();
      if (json.success) setProgress(json);
    } catch (_) {}
  }, [styleJob?.id]);

  useEffect(() => {
    if (styleJob?.status !== 'processing') return;
    const iv = setInterval(fetchProgress, 2000);
    return () => clearInterval(iv);
  }, [styleJob?.status, fetchProgress]);

  useEffect(() => {
    if (styleJob?.status!=='processing' && styleJob?.status!=='pending') { setElapsed(0); return; }
    const started = styleJob?.created_at ? new Date(styleJob.created_at).getTime() : Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now()-started)/1000)), 1000);
    return () => clearInterval(iv);
  }, [styleJob?.status, styleJob?.created_at]);

  const handleTransform = async () => {
    setSubmitting(true); setError(null);
    try {
      const res  = await fetch(`${API_BASE_31}/projects/${projectId}/assets/${asset.id}/style`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ style_target:styleTarget, provider, params:{fps,max_frames:maxFrames,strength} }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error||'Failed to start style transform');
      else { setStyleJob(json.data); setProgress(null); }
    } catch (err:any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const isRunning  = styleJob?.status==='pending'||styleJob?.status==='processing';
  const isComplete = styleJob?.status==='complete';
  const isFailed   = styleJob?.status==='failed';
  const streamUrl  = styleJob?.id ? `${API_BASE_31}/styles/${styleJob.id}/stream`   : null;
  const dlUrl      = styleJob?.id ? `${API_BASE_31}/styles/${styleJob.id}/download` : null;
  const currentStageIdx = STAGES.indexOf(progress?.stage||styleJob?.stage||'queued');
  const progressPercent = progress?.percent ?? 0;

  return (
    <Card className="bg-slate-950 border-violet-500/20 mt-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-2 text-violet-300">
          <Wand2 className="w-3.5 h-3.5"/>
          Video Style Transform
          {asset.styled_video_url && <Badge className="ml-auto bg-violet-500/10 text-violet-300 border-violet-500/20 text-[10px]">Styled ✓</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Provider */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Provider</label>
          <Select value={provider} onValueChange={setProvider} disabled={isRunning}>
            <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {providers.map(p=><SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Style cards */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1.5">Style</label>
          <div className="grid grid-cols-1 gap-1.5">
            {STYLE_CARDS.map(s=>(
              <button key={s.value} disabled={isRunning} onClick={()=>setStyleTarget(s.value)}
                className={`text-left rounded-lg border px-3 py-2 transition-all ${
                  styleTarget===s.value
                    ?'border-violet-500/60 bg-violet-500/10 text-violet-200'
                    :'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'}`}>
                <span className="text-xs font-semibold">{s.label}</span>
                <span className="text-[10px] text-slate-500 block">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* FPS */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Frame Rate</label>
          <Select value={String(fps)} onValueChange={v=>setFps(Number(v))} disabled={isRunning}>
            <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {[4,6,8,12].map(f=><SelectItem key={f} value={String(f)} className="text-xs">{f} fps</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Max frames */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
            Max Frames: <span className="text-slate-300">{maxFrames}</span>
          </label>
          <input type="number" min={50} max={500} value={maxFrames} disabled={isRunning}
            onChange={e=>setMaxFrames(Math.min(500,Math.max(50,Number(e.target.value))))}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none"/>
        </div>

        {/* Strength (replicate only) */}
        {provider==='replicate'&&(
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
              Style Strength: <span className="text-slate-300">{strength.toFixed(2)}</span>
            </label>
            <input type="range" min={0.3} max={0.9} step={0.05} value={strength}
              onChange={e=>setStrength(Number(e.target.value))} disabled={isRunning}
              className="w-full accent-violet-500"/>
          </div>
        )}

        {/* Action */}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 bg-violet-600 hover:bg-violet-700 text-xs h-7"
            disabled={isRunning||submitting} onClick={handleTransform}>
            {submitting?<><RefreshCw className="w-3 h-3 mr-1.5 animate-spin"/>Queuing…</>
              :<><Wand2 className="w-3 h-3 mr-1.5"/>Transform</>}
          </Button>
          {(isComplete||isFailed)&&(
            <Button size="sm" variant="outline" disabled={submitting} onClick={handleTransform}
              className="text-xs h-7 border-violet-500/30 text-violet-300 hover:bg-violet-500/10">
              Re-transform
            </Button>
          )}
        </div>

        {error&&<p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
          <AlertCircle className="w-3 h-3 inline mr-1"/>{error}</p>}

        {/* Progress while running */}
        {styleJob&&isRunning&&(
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <StatusBadge status={styleJob.status}/>
              {elapsed>0&&<span className="text-[10px] text-slate-500">{elapsed}s elapsed</span>}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {STAGES.slice(0,-1).map((stage,idx)=>(
                <React.Fragment key={stage}>
                  <div className={`flex flex-col items-center ${idx<=currentStageIdx?'text-violet-400':'text-slate-700'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${idx<=currentStageIdx?'bg-violet-400':'bg-slate-700'}`}/>
                    <span className="text-[9px] mt-0.5 whitespace-nowrap">{STAGE_LABELS[stage]}</span>
                  </div>
                  {idx<STAGES.length-2&&<div className={`flex-1 h-px ${idx<currentStageIdx?'bg-violet-400':'bg-slate-800'}`}/>}
                </React.Fragment>
              ))}
            </div>
            {styleJob.status==='processing'&&(progress?.frame_count||0)>0&&(
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Frames: {progress?.frames_processed??0}/{progress?.frame_count??0}</span>
                  <span>{progressPercent.toFixed(1)}%</span>
                </div>
                <Progress value={progressPercent} className="h-1.5 bg-slate-800"/>
              </div>
            )}
          </div>
        )}

        {/* Non-running status */}
        {styleJob&&!isRunning&&(
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              {styleJob.style_target}·{styleJob.provider}
              {styleJob.duration_ms?` · ${(styleJob.duration_ms/1000).toFixed(1)}s`:''}
            </span>
            <StatusBadge status={styleJob.status}/>
          </div>
        )}

        {isFailed&&styleJob?.error_text&&(
          <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
            <p className="font-semibold">Stage: {styleJob.error_stage||'—'}</p>
            <p className="font-mono">{styleJob.error_text}</p>
          </div>
        )}

        {isComplete&&streamUrl&&(
          <div className="space-y-1.5">
            <video controls autoPlay loop muted
              className="w-full rounded border border-slate-800 bg-black max-h-40"
              src={streamUrl}
              onError={e=>{(e.target as HTMLVideoElement).style.display='none';}}/>
            <a href={dlUrl!} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"
                className="w-full text-[10px] h-6 border-violet-500/30 text-violet-300 hover:bg-violet-500/10">
                <ExternalLink className="w-3 h-3 mr-1"/>Download Styled Video
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
