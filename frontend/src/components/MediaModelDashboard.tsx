import React, { useState, useEffect } from 'react';
import StyleTransformPanel from './StyleTransformPanel';
import VideoGenerationPanel, { AiVideoStatusBadge } from './VideoGenerationPanel';
import AnimationPanel from './AnimationPanel';
import CharacterRegistryPanel, { CharacterDriftBadge } from './CharacterRegistryPanel';
import VideoToVideoPanel, { V2VStatusBadge } from './VideoToVideoPanel';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "./ui/card";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "./ui/tabs";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger 
} from "./ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "./ui/select";
import { 
  Video, Image as ImageIcon, Music, Cpu, Database, Activity, Clapperboard, 
  CheckCircle2, XCircle, Clock, Search, ExternalLink, Info,
  PlayCircle, Layers, FileText, RefreshCw, AlertCircle, Film, Sparkles, Wand2, Users
} from "lucide-react";

const API_BASE    = "/api/phase26";
const API_BASE_27 = "/api/phase27";
const API_BASE_28 = "/api/phase28";
const API_BASE_29 = "/api/phase29";
const API_BASE_30 = "/api/phase30";
const API_BASE_31 = "/api/phase31";
const API_BASE_32 = "/api/phase32";
const API_BASE_33 = "/api/phase33";

const VIDEO_PROVIDER_LABELS: Record<string, string> = {
  veo: "Google Veo", kling: "Kling", pixverse: "PixVerse", pika: "Pika",
  runway_gen4: "Runway Gen-4", hailuo: "Hailuo (MiniMax)", luma: "Luma Dream Machine",
};

export default function MediaModelDashboard() {
  const [activeTab, setActiveTab] = useState("models");
  const [models, setModels] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [architectures, setArchitectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Architecture Advisor State
  const [advisorInput, setAdvisorInput] = useState({
    use_case: "",
    duration_sec: 10,
    resolution: "1080p",
    vram_gb: 24,
    latency_budget_ms: 10000
  });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recommending, setRecommending] = useState(false);

  // Runtime (Phase 27) State
  const [projects, setProjects]           = useState<any[]>([]);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeError, setRuntimeError]   = useState<string | null>(null);
  const [newPrompt, setNewPrompt]         = useState("");
  const [newTitle, setNewTitle]           = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [projectDetail, setProjectDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orgId, setOrgId]                = useState("demo-org");

  // Phase 28 — Asset Generation Engine state
  const [providers, setProviders]            = useState<Record<string, {provider: string; configured: boolean}>>({});
  
  // ── Phase 30 — Image Animation ──────────────────────────────────────────────
  const [animationJobs, setAnimationJobs] = useState<any[]>([]);

  // ── Phase 31 — Video Style Transform ─────────────────────────────────────────
  const [styleJobs, setStyleJobs] = useState<any[]>([]);
  const [animationsLoading, setAnimationsLoading] = useState(false);
  const [stylesLoading, setStylesLoading] = useState(false);

  // ── Phase 32 — AI Video Generation ───────────────────────────────────────────
    const [aiVideos, setAiVideos] = useState<any[]>([]);
    const [aiVideosLoading, setAiVideosLoading] = useState(false);

    // ── Phase 33 — Character Consistency Engine ───────────────────────────────
    const [characters,        setCharacters]        = useState<any[]>([]);
    const [charactersLoading, setCharactersLoading] = useState(false);

  // ── Phase 29 — Video Assembly Engine ────────────────────────────────────────
  const [videoRecord,   setVideoRecord]   = useState<any | null>(null);
  const [videoLoading,  setVideoLoading]  = useState(false);
  const [videoError,    setVideoError]    = useState<string | null>(null);
  const [assembling,    setAssembling]    = useState(false);
  const [ffmpegStatus,  setFfmpegStatus]  = useState<any | null>(null);
  const [deletingVideo, setDeletingVideo] = useState(false);
  const [previewAsset, setPreviewAsset]      = useState<any | null>(null);
  const [regenerating, setRegenerating]      = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "models") {
        const res = await fetch(`${API_BASE}/models`);
        const json = await res.json();
        if (json.success) setModels(json.data);
      } else if (activeTab === "jobs") {
        const res = await fetch(`${API_BASE}/jobs`);
        const json = await res.json();
        if (json.success) setJobs(json.data);
      } else if (activeTab === "datasets") {
        const res = await fetch(`${API_BASE}/datasets/readiness`);
        const json = await res.json();
        if (json.success) setDatasets(json.data);
      } else if (activeTab === "architecture") {
        const res = await fetch(`${API_BASE}/architectures`);
        const json = await res.json();
        if (json.success) setArchitectures(json.data);
      } else if (activeTab === "runtime") {
        fetchProjects();
        fetchProviders();
      } else if (activeTab === "video") {
        fetchProjects();
        fetchFfmpegStatus();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    setRuntimeLoading(true);
    setRuntimeError(null);
    try {
      const res  = await fetch(`${API_BASE_27}/pipeline?org_id=${encodeURIComponent(orgId)}`);
      const json = await res.json();
      if (json.success) setProjects(json.data);
      else setRuntimeError(json.error || "Failed to fetch projects");
    } catch (err: any) {
      setRuntimeError(err.message);
    } finally {
      setRuntimeLoading(false);
    }
  };

    // ── Phase 33: fetch characters for selected project ─────────────────────
    const fetchCharacters = async (projectId: string) => {
      setCharactersLoading(true);
      try {
        const res = await fetch(`${API_BASE_33}/characters?org_id=${selectedProject?.org_id || 'default'}&project_id=${projectId}`);
        const json = await res.json();
        if (json.success) setCharacters(json.data || []);
      } catch { /* ignore */ }
      finally { setCharactersLoading(false); }
    };

    const fetchAnimations = async (projectId: string) => {
    setAnimationsLoading(true);
    try {
      const res  = await fetch(`${API_BASE_30}/projects/${projectId}/animations`);
      const json = await res.json();
      if (json.success) setAnimationJobs(json.data);
    } catch (_) {}
    finally { setAnimationsLoading(false); }
  };

    const fetchStyles = async (projectId: string) => {
    setStylesLoading(true);
    try {
      const res  = await fetch(API_BASE_31 + '/projects/' + projectId + '/styles');
      const json = await res.json();
      if (json.success) setStyleJobs(json.data ?? []);
    } catch { /* ignore */ } finally { setStylesLoading(false); }
  };

  const fetchAiVideos = async (projectId: string) => {
    setAiVideosLoading(true);
    try {
      const res  = await fetch(API_BASE_32 + '/projects/' + projectId + '/ai-videos');
      const json = await res.json();
      if (json.success) setAiVideos(json.data ?? []);
    } catch { /* ignore */ } finally { setAiVideosLoading(false); }
  };

const fetchProjectDetail = async (projectId: string) => {
    setDetailLoading(true);
    try {
      const res  = await fetch(`${API_BASE_27}/pipeline/${projectId}`);
      const json = await res.json();
      if (json.success) setProjectDetail(json.data);
    } catch (_) {}
    finally { setDetailLoading(false); }
  };

  const handleStartPipeline = async () => {
    if (!newPrompt.trim() || newPrompt.trim().length < 20) {
      alert("Prompt must be at least 20 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_27}/pipeline/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: newPrompt, title: newTitle || undefined, org_id: orgId }),
      });
      const json = await res.json();
      if (json.success) {
        setNewPrompt("");
        setNewTitle("");
        await fetchProjects();
      } else {
        alert(json.error || "Failed to start pipeline");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const res  = await fetch(`${API_BASE_28}/providers`);
      const json = await res.json();
      if (json.success) setProviders(json.data);
    } catch (_) {}
  };

  const handleRegenerateAsset = async (assetId: string) => {
    setRegenerating(assetId);
    try {
      const res  = await fetch(`${API_BASE_28}/assets/${assetId}/regenerate`, { method: "POST" });
      const json = await res.json();
      if (!json.success) alert(json.error || "Regeneration failed");
      else if (selectedProject) await fetchProjectDetail(selectedProject.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRegenerating(null);
    }
  };


  // ── Phase 29 — Video Assembly API functions ──────────────────────────────────
  const fetchFfmpegStatus = async () => {
    try {
      const res  = await fetch(`${API_BASE_29}/ffmpeg/health`);
      const json = await res.json();
      if (json.success) setFfmpegStatus(json.data);
    } catch (_) {}
  };

  const fetchVideoRecord = async (projectId: string) => {
    setVideoLoading(true);
    setVideoError(null);
    try {
      const res  = await fetch(`${API_BASE_29}/projects/${projectId}/video`);
      const json = await res.json();
      if (json.success) setVideoRecord(json.data);
      else if (res.status !== 404) setVideoError(json.error || 'Failed to load video');
      else setVideoRecord(null);
    } catch (err: any) {
      setVideoError(err.message);
    } finally {
      setVideoLoading(false);
    }
  };

  const handleAssemble = async (projectId: string) => {
    setAssembling(true);
    try {
      const res  = await fetch(`${API_BASE_29}/projects/${projectId}/assemble`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) alert(json.error || 'Assembly failed to queue');
      else { await fetchVideoRecord(projectId); await fetchProjects(); }
    } catch (err: any) { alert(err.message); }
    finally { setAssembling(false); }
  };

  const handleDeleteVideo = async (projectId: string) => {
    if (!confirm('Delete the assembled video and re-assemble this project?')) return;
    setDeletingVideo(true);
    setVideoError(null);
    try {
      const delRes  = await fetch(`${API_BASE_29}/projects/${projectId}/video`, { method: 'DELETE' });
      const delJson = await delRes.json();
      if (!delJson.success) { alert(delJson.error || 'Delete failed'); return; }
      setVideoRecord(null);
      // Fix 5: chain POST /assemble after successful DELETE
      const asmRes  = await fetch(`${API_BASE_29}/projects/${projectId}/assemble`, { method: 'POST' });
      const asmJson = await asmRes.json();
      if (!asmJson.success) setVideoError(asmJson.error || 'Re-assemble failed to queue');
      await fetchProjects();
    } catch (err: any) { alert(err.message); }
    finally { setDeletingVideo(false); }
  };

  const handleRetryFailed = async (projectId: string) => {
    try {
      const res  = await fetch(`${API_BASE_27}/pipeline/${projectId}/retry`, { method: "POST" });
      const json = await res.json();
      if (json.success) await fetchProjects();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRecommend = async () => {
    setRecommending(true);
    try {
      const res = await fetch(`${API_BASE}/architectures/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(advisorInput)
      });
      const json = await res.json();
      if (json.success) setRecommendations(json.data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRecommending(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
      case 'ready':
      case 'complete':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'queued':
      case 'running':
      case 'curating':
      case 'generating':
      case 'compiling':
      case 'scenes_pending':
      case 'assets_pending':
      case 'retrying':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse"><Clock className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'assembling':
        return <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 animate-pulse"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> assembling</Badge>;
      case 'video_complete':
        return <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20"><Film className="w-3 h-3 mr-1" /> video_complete</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'image':     return <ImageIcon className="w-3 h-3" />;
      case 'audio':     return <Music className="w-3 h-3" />;
      case 'music':     return <Music className="w-3 h-3" />;
      case 'caption':   return <FileText className="w-3 h-3" />;
      case 'subtitle':  return <FileText className="w-3 h-3" />;
      case 'overlay':   return <Layers className="w-3 h-3" />;
      case 'thumbnail': return <Film className="w-3 h-3" />;
      default:          return <Activity className="w-3 h-3" />;
    }
  };

  // Phase 28 — Provider Status Widget
  const ProviderStatusWidget = () => {
    if (Object.keys(providers).length === 0) return null;
    const labels: Record<string, string> = { image: 'Image', voice: 'Voice', music: 'Music', subtitles: 'Subtitles' };
    return (
      <Card className="bg-slate-900 border-slate-800 mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Generator Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(providers).map(([key, info]) => (
              <div key={key} className="flex items-center gap-2 bg-slate-950 rounded-lg px-3 py-2 border border-slate-800">
                <span className={`w-2 h-2 rounded-full shrink-0 ${info.configured ? 'bg-green-400' : 'bg-slate-600'}`} />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold truncate">{labels[key] || key}</p>
                  <p className="text-xs text-slate-300 truncate">{info.provider}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Phase 28 — Asset Preview Panel
  const AssetPreviewPanel = ({ asset }: { asset: any }) => {
    if (!asset) return null;
    const isComplete = asset.status === 'complete';
    const isStub = !asset.storage_url || asset.storage_url.startsWith('stub://');
    const downloadUrl = isComplete && !isStub ? `${API_BASE_28}/assets/${asset.id}/download` : null;
    return (
      <div className="mt-2 rounded-lg border border-indigo-500/20 bg-slate-950 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            {getAssetTypeIcon(asset.asset_type)}
            <span className="capitalize">{asset.asset_type}</span>
            {getStatusBadge(asset.status)}
            {asset.animated_clip_url && (
              <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-[9px] px-1.5 py-0">Animated ✓</Badge>
            )}
            {asset.styled_video_url && (
              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[9px] px-1.5 py-0">Styled ✓</Badge>
            )}
            {asset.character_ids?.length > 0 && (
              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                {asset.character_ids.length} Char{asset.character_ids.length > 1 ? 's' : ''}
              </Badge>
            )}
            {asset.v2v_job_id && <V2VStatusBadge status={asset.v2v_status || 'pending'} />}
          </div>
          <div className="flex gap-1.5">
            {downloadUrl && (
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="text-[10px] h-6 border-slate-700 hover:bg-slate-800">
                  <ExternalLink className="w-3 h-3 mr-1" /> Open
                </Button>
              </a>
            )}
            {(isComplete || asset.status === 'failed') && (
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-6 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                disabled={regenerating === asset.id}
                onClick={() => handleRegenerateAsset(asset.id)}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${regenerating === asset.id ? 'animate-spin' : ''}`} />
                {regenerating === asset.id ? 'Queued…' : '↺ Regen'}
              </Button>
            )}
          </div>
        </div>

        {/* Inline Preview */}
        {isComplete && !isStub && (
          <div className="mt-1">
            {(asset.asset_type === 'image' || asset.asset_type === 'thumbnail') && (
              <>
                <img
                  src={downloadUrl!}
                  alt={asset.asset_type}
                  className="rounded max-h-40 w-full object-cover border border-slate-800"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {/* Phase 30 Fix 1 — AnimationPanel below complete image assets */}
                <AnimationPanel projectId={selectedProject?.id ?? asset.project_id} asset={asset} />
              </>
            )}
            {(asset.asset_type === 'audio' || asset.asset_type === 'music') && (
              <audio controls className="w-full h-8" src={downloadUrl!} />
            )}
            {asset.asset_type === 'video' && (
              <>
                <video controls className="w-full rounded border border-slate-800 bg-black max-h-40"
                  src={downloadUrl!} onError={e=>{(e.target as HTMLVideoElement).style.display='none';}}/>
                {/* Phase 31 — StyleTransformPanel below complete video assets */}
                <StyleTransformPanel projectId={selectedProject?.id ?? asset.project_id} asset={asset} />
                </>
            )}
            {/* Phase 32 Fix 1 — AI Video Generation (all complete assets) */}
            {asset.status === 'complete' && selectedProject && (
              <VideoGenerationPanel
                projectId={selectedProject.id}
                asset={asset}
              />
            )}
            {/* Phase 34 — Video-to-Video Transformation */}
            {asset.status === 'complete' && selectedProject && (
              <VideoToVideoPanel
                projectId={selectedProject.id}
                asset={asset}
              />
            )}
            {(asset.asset_type === 'caption' || asset.asset_type === 'subtitle') && (
              <div className="bg-slate-900 rounded p-2 text-[11px] text-slate-400 italic max-h-16 overflow-y-auto">
                {asset.prompt?.slice(0, 200) || '(caption text)'}
              </div>
            )}
          </div>
        )}
        {(!isComplete || isStub) && asset.status !== 'failed' && (
          <div className="h-8 bg-slate-900 rounded animate-pulse" />
        )}
        {asset.status === 'failed' && (
          <p className="text-[11px] text-red-400">{asset.error_text || 'Generation failed'}</p>
        )}
        {asset.generation_metadata?.provider && (
          <p className="text-[10px] text-slate-600">
            provider: {asset.generation_metadata.provider}
            {asset.generation_metadata.duration_ms ? ` · ${Math.round(asset.generation_metadata.duration_ms / 100) / 10}s` : ''}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-slate-950 text-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generative Media Hub</h1>
          <p className="text-slate-400">Manage models, datasets, generation objectives, and media pipelines.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1 border-slate-800 bg-slate-900/50">Phase 32</Badge>
          <Badge className="px-3 py-1 bg-amber-600 hover:bg-amber-700">v34.0.0</Badge>
        </div>
      </div>

      <Tabs defaultValue="models" className="w-full" onValueChange={(val) => {
          setActiveTab(val);
          if (val === 'animations' && selectedProject) fetchAnimations(selectedProject.id);
          if (val === 'styles'     && selectedProject) fetchStyles(selectedProject.id);
          if (val === 'ai_videos'  && selectedProject) fetchAiVideos(selectedProject.id);
          if (val === 'characters' && selectedProject) fetchCharacters(selectedProject.id);
          if (val === 'video'      && selectedProject) { fetchVideoRecord(selectedProject.id); fetchFfmpegStatus(); }
        }}>
        <TabsList className="bg-slate-900 border border-slate-800 p-1">
          <TabsTrigger value="models" className="data-[state=active]:bg-slate-800">Models</TabsTrigger>
          <TabsTrigger value="jobs" className="data-[state=active]:bg-slate-800">Jobs Queue</TabsTrigger>
          <TabsTrigger value="datasets" className="data-[state=active]:bg-slate-800">Datasets</TabsTrigger>
          <TabsTrigger value="architecture" className="data-[state=active]:bg-slate-800">Architecture Advisor</TabsTrigger>
          <TabsTrigger value="runtime" className="data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-400">
            <PlayCircle className="w-3.5 h-3.5 mr-1.5" />Runtime
          </TabsTrigger>
          <TabsTrigger value="video" className="data-[state=active]:bg-slate-800 data-[state=active]:text-violet-400">
            <Film className="w-3.5 h-3.5 mr-1.5" />Video Assembly
          </TabsTrigger>
          <TabsTrigger value="animations" className="data-[state=active]:bg-slate-800 data-[state=active]:text-pink-400">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />Animations
          </TabsTrigger>
          <TabsTrigger value="styles" className="data-[state=active]:bg-slate-800 data-[state=active]:text-violet-400">
            <Wand2 className="w-3.5 h-3.5 mr-1.5" />Styles
          </TabsTrigger>
        <TabsTrigger value="ai_videos" className="data-[state=active]:bg-slate-800 data-[state=active]:text-amber-400">
            <Clapperboard className="w-3.5 h-3.5 mr-1.5" />AI Videos
          </TabsTrigger>
          <TabsTrigger value="characters" className="data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-400">
            <Users className="w-3.5 h-3.5 mr-1.5" />Characters
          </TabsTrigger>
          </TabsList>

        {/* ── Models tab ─────────────────────────────────────────────────── */}
        <TabsContent value="models" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-slate-900 rounded-xl" />)
            ) : models.length === 0 ? (
              <Card className="col-span-full bg-slate-900 border-slate-800 text-center py-12">
                <Cpu className="w-12 h-12 mx-auto text-slate-700 mb-4" />
                <p className="text-slate-400">No generative models registered yet.</p>
              </Card>
            ) : models.map(model => (
              <Card key={model.model_id} className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                      {getTypeIcon(model.type)}
                    </div>
                    {getStatusBadge(model.status)}
                  </div>
                  <CardTitle className="mt-4">{model.name}</CardTitle>
                  <CardDescription className="text-slate-500">{model.architecture} by {model.provider}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-none capitalize">{model.quality_tier}</Badge>
                    <Badge variant="outline" className="border-slate-700 text-slate-500">{model.type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Jobs tab ───────────────────────────────────────────────────── */}
        <TabsContent value="jobs" className="mt-6">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-950/50">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Prompt Preview</TableHead>
                  <TableHead className="text-slate-400">Quality Score</TableHead>
                  <TableHead className="text-slate-400">Duration</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i} className="border-slate-800">
                      <TableCell colSpan={5}><Skeleton className="h-10 w-full bg-slate-800/50" /></TableCell>
                    </TableRow>
                  ))
                ) : jobs.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="text-center py-12 text-slate-500">No generation jobs found.</TableCell>
                  </TableRow>
                ) : jobs.map(job => (
                  <TableRow key={job.job_id} className="border-slate-800 hover:bg-slate-800/30">
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="max-w-md truncate font-medium">{job.prompt}</TableCell>
                    <TableCell>
                      {job.quality_score ? (
                        <div className="flex items-center gap-2">
                          <Progress value={job.quality_score * 100} className="w-16 h-1.5 bg-slate-800" />
                          <span className={job.quality_score > 0.7 ? "text-green-400" : "text-amber-400"}>
                            {(job.quality_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {job.duration_ms ? `${(job.duration_ms / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {new Date(job.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Datasets tab ───────────────────────────────────────────────── */}
        <TabsContent value="datasets" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading ? (
              Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full bg-slate-900 rounded-xl" />)
            ) : datasets.length === 0 ? (
              <Card className="col-span-full bg-slate-900 border-slate-800 text-center py-12">
                <Database className="w-12 h-12 mx-auto text-slate-700 mb-4" />
                <p className="text-slate-400">No media datasets registered.</p>
              </Card>
            ) : datasets.map(ds => (
              <Card key={ds.dataset_id} className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{ds.name}</CardTitle>
                    {getStatusBadge(ds.status)}
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-700 text-slate-400">{ds.license}</Badge>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500 capitalize">{ds.media_type}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Readiness Score</span>
                      <span className="text-indigo-400 font-bold">{(ds.readiness_score * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={ds.readiness_score * 100} className="h-2 bg-slate-800" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/50">
                      <p className="text-xs text-slate-500 uppercase font-bold">Total Samples</p>
                      <p className="text-xl font-mono text-slate-200">{ds.total_samples.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/50">
                      <p className="text-xs text-slate-500 uppercase font-bold">Curated</p>
                      <p className="text-xl font-mono text-slate-200">{ds.curated_samples.toLocaleString()}</p>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800">
                        <Info className="w-4 h-4 mr-2" /> View Curation Plan
                      </Button>
                    </DialogTrigger>
                    <CurationPlanDialog datasetId={ds.dataset_id} />
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Architecture Advisor tab ────────────────────────────────────── */}
        <TabsContent value="architecture" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-900 border-slate-800 h-fit">
              <CardHeader>
                <CardTitle>Architecture Advisor</CardTitle>
                <CardDescription>Get expert recommendations for your media use case.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Use Case</label>
                  <input 
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Cinematic marketing video"
                    value={advisorInput.use_case}
                    onChange={e => setAdvisorInput({...advisorInput, use_case: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Duration (sec)</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm outline-none"
                      value={advisorInput.duration_sec}
                      onChange={e => setAdvisorInput({...advisorInput, duration_sec: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">VRAM (GB)</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm outline-none"
                      value={advisorInput.vram_gb}
                      onChange={e => setAdvisorInput({...advisorInput, vram_gb: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2"
                  onClick={handleRecommend}
                  disabled={recommending}
                >
                  {recommending ? "Analyzing..." : "Get Recommendations"}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              {recommendations.length === 0 ? (
                <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-12 text-center">
                  <Search className="w-12 h-12 mx-auto text-slate-800 mb-4" />
                  <p className="text-slate-500">Run the advisor to see recommended architectures.</p>
                </div>
              ) : (
                recommendations.map((rec, i) => (
                  <Card key={rec.id} className={`bg-slate-900 border-slate-800 ${i === 0 ? 'ring-1 ring-indigo-500/50' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2">
                          {i === 0 && <Badge className="bg-indigo-600 text-[10px] uppercase px-1.5 py-0">Top Match</Badge>}
                          {rec.name}
                        </CardTitle>
                        <span className="text-2xl font-bold text-indigo-400">{(rec.match_score * 100).toFixed(0)}%</span>
                      </div>
                      <CardDescription>{rec.paradigm} paradigm • Requires {rec.min_vram_gb}GB VRAM</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-300 mb-4 italic">"{rec.rationale}"</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-bold text-slate-500">Strengths</p>
                          <ul className="text-xs space-y-1">
                            {rec.strengths.map((s: string, idx: number) => <li key={idx} className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {s}</li>)}
                          </ul>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-bold text-slate-500">Recommended For</p>
                          <ul className="text-xs space-y-1">
                            {rec.recommended_for.map((r: string, idx: number) => <li key={idx} className="flex items-center gap-1 text-slate-400">• {r}</li>)}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Runtime Orchestration tab (Phase 27 + 28) ──────────────────── */}
        <TabsContent value="runtime" className="mt-6">
          <ProviderStatusWidget />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Start New Pipeline ──────────────────────────────────────── */}
            <Card className="bg-slate-900 border-slate-800 h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-indigo-400" />
                  Start Pipeline
                </CardTitle>
                <CardDescription>Submit a prompt to create and orchestrate a full media project.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Org ID</label>
                  <input
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                    value={orgId}
                    onChange={e => setOrgId(e.target.value)}
                    placeholder="your-org-id"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Title <span className="text-slate-600">(optional)</span></label>
                  <input
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Q4 Product Launch Video"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Prompt <span className="text-red-400">*</span></label>
                  <textarea
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                    rows={4}
                    value={newPrompt}
                    onChange={e => setNewPrompt(e.target.value)}
                    placeholder="Describe the media project in detail (min 20 chars)..."
                  />
                  <p className="text-[11px] text-slate-600">{newPrompt.length} chars</p>
                </div>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleStartPipeline}
                  disabled={submitting || newPrompt.trim().length < 20}
                >
                  {submitting ? "Starting…" : "Start Pipeline"}
                </Button>
              </CardContent>
            </Card>

            {/* ── Projects List ───────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Projects</h3>
                <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800 text-xs" onClick={fetchProjects}>
                  <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
                </Button>
              </div>

              {runtimeError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {runtimeError}
                </div>
              )}

              {runtimeLoading ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-slate-900 rounded-lg" />)
              ) : projects.length === 0 ? (
                <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-12 text-center">
                  <Film className="w-12 h-12 mx-auto text-slate-800 mb-4" />
                  <p className="text-slate-500">No media projects yet. Start your first pipeline.</p>
                </div>
              ) : projects.map(proj => (
                <Card
                  key={proj.id}
                  className={`bg-slate-900 border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer ${selectedProject?.id === proj.id ? 'ring-1 ring-indigo-500/50' : ''}`}
                  onClick={() => {
                    setSelectedProject(proj);
                    fetchProjectDetail(proj.id);
                  }}
                >
                  <CardContent className="pt-4 pb-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-100 truncate">{proj.title || 'Untitled Project'}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{proj.raw_prompt?.slice(0, 80)}…</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                          <span>{proj.scene_count || 0} scenes</span>
                          <span>•</span>
                          <span>{proj.asset_count || 0} assets</span>
                          <span>•</span>
                          <span>{new Date(proj.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {getStatusBadge(proj.status)}
                        {proj.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[10px] h-6 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            onClick={e => { e.stopPropagation(); handleRetryFailed(proj.id); }}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" /> Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* ── Project detail panel ──────────────────────────────────── */}
              {selectedProject && (
                <Card className="bg-slate-900 border-indigo-500/30 mt-2">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">
                        {detailLoading ? <Skeleton className="h-5 w-40 bg-slate-800" /> : projectDetail?.title || selectedProject.title}
                      </CardTitle>
                      {projectDetail && (
                        <span className="text-indigo-400 font-bold text-sm">{projectDetail.completion_percent}% complete</span>
                      )}
                    </div>
                    {projectDetail && (
                      <Progress value={projectDetail.completion_percent} className="h-1.5 bg-slate-800 mt-2" />
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {detailLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full bg-slate-800" />
                        <Skeleton className="h-8 w-3/4 bg-slate-800" />
                      </div>
                    ) : projectDetail ? (
                      <>
                        {/* Scenes */}
                        {projectDetail.scenes?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Scenes ({projectDetail.scenes.length})</p>
                            <div className="space-y-1.5">
                              {projectDetail.scenes.map((scene: any) => (
                                <div key={scene.id} className="bg-slate-950 rounded-lg p-2.5 border border-slate-800/50">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-300">Scene {scene.scene_index + 1}: {scene.title}</span>
                                    {getStatusBadge(scene.status)}
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{scene.prompt_slice}</p>
                                  {/* Assets per scene — Phase 28 preview */}
                                  {scene.assets?.length > 0 && (
                                    <div className="mt-1.5 space-y-1">
                                      <div className="flex gap-1.5 flex-wrap">
                                        {scene.assets.map((asset: any) => (
                                          <button
                                            key={asset.id}
                                            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                              previewAsset?.id === asset.id
                                                ? 'border-indigo-500/60 text-indigo-300 bg-indigo-500/10'
                                                : asset.status === 'complete' ? 'border-green-500/20 text-green-400 bg-green-500/5 hover:border-green-500/40'
                                                : asset.status === 'failed'   ? 'border-red-500/20 text-red-400 bg-red-500/5 hover:border-red-500/40'
                                                                               : 'border-slate-700 text-slate-500 bg-slate-900 hover:border-slate-600'
                                            }`}
                                            onClick={() => setPreviewAsset(previewAsset?.id === asset.id ? null : asset)}
                                          >
                                            {getAssetTypeIcon(asset.asset_type)}
                                            <span>{asset.asset_type}</span>
                                            {asset.animated_clip_url && <span className="text-pink-400 ml-0.5" title="Animated">✦</span>}
                                            {asset.styled_video_url && <span className="text-violet-400 ml-0.5" title="Styled">✧</span>}
                                          </button>
                                        ))}
                                      </div>
                                      {previewAsset && scene.assets.some((a: any) => a.id === previewAsset.id) && (
                                        <AssetPreviewPanel asset={previewAsset} />
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Compiled prompt summary */}
                        {projectDetail.compiled_prompt && (
                          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800/50 space-y-2">
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Compiled Prompt</p>
                            <div className="flex flex-wrap gap-2 text-[11px]">
                              <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">
                                intent: {projectDetail.compiled_prompt.intent}
                              </span>
                              <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">
                                tone: {projectDetail.compiled_prompt.tone}
                              </span>
                              <span className="bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded">
                                lang: {projectDetail.compiled_prompt.language}
                              </span>
                              <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                                scenes: {projectDetail.compiled_prompt.estimated_scenes}
                              </span>
                            </div>
                            {projectDetail.compiled_prompt.keywords?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {projectDetail.compiled_prompt.keywords.map((kw: string, i: number) => (
                                  <span key={i} className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">{kw}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">No detail available.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Video Assembly tab (Phase 29) ──────────────────────────────────── */}
        <TabsContent value="video" className="mt-6">
          {/* FFmpeg health banner */}
          {ffmpegStatus && (
            <div className={`flex items-center gap-3 rounded-lg px-4 py-3 mb-4 border text-sm ${
              ffmpegStatus.available
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <Cpu className="w-4 h-4 shrink-0" />
              <span>{ffmpegStatus.available
                ? `FFmpeg ready — video assembly enabled (${ffmpegStatus.path})`
                : 'FFmpeg NOT found — install FFmpeg and set FFMPEG_PATH to enable assembly'}</span>
              {!ffmpegStatus.available && (
                <a href="https://ffmpeg.org/download.html" target="_blank" rel="noopener noreferrer"
                   className="ml-auto text-xs underline opacity-70 hover:opacity-100">Install guide</a>
              )}
              <Button variant="outline" size="sm"
                className="ml-auto border-slate-700 text-xs hover:bg-slate-800"
                onClick={fetchFfmpegStatus}>
                <RefreshCw className="w-3 h-3 mr-1" /> Recheck
              </Button>
            </div>
          )}
          {!ffmpegStatus && (
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3 mb-4">
              <Cpu className="w-4 h-4 shrink-0" />
              FFmpeg status unknown — switch to this tab to check availability.
              <Button variant="outline" size="sm" className="ml-auto border-slate-700 text-xs hover:bg-slate-800" onClick={fetchFfmpegStatus}>
                Check FFmpeg
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Project selector */}
            <Card className="bg-slate-900 border-slate-800 h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Film className="w-4 h-4 text-violet-400" /> Select Project
                </CardTitle>
                <CardDescription>Pick a project to assemble or inspect its video.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm"
                  className="w-full border-slate-700 hover:bg-slate-800 text-xs mb-1"
                  onClick={fetchProjects}>
                  <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh Projects
                </Button>
                {runtimeLoading ? (
                  Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-slate-800 rounded-lg" />)
                ) : projects.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No projects yet. Start one in the Runtime tab.</p>
                ) : projects.map(proj => (
                  <button key={proj.id}
                    className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all ${
                      selectedProject?.id === proj.id
                        ? 'border-violet-500/60 bg-violet-500/10'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-950'
                    }`}
                    onClick={() => { setSelectedProject(proj); setVideoRecord(null); fetchVideoRecord(proj.id); }}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm font-medium text-slate-200 truncate">{proj.title || 'Untitled'}</span>
                      {getStatusBadge(proj.status)}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{proj.scene_count || 0} scenes · {proj.asset_count || 0} assets</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Assembly panel */}
            <div className="lg:col-span-2 space-y-4">
              {!selectedProject ? (
                <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-16 text-center">
                  <Video className="w-14 h-14 mx-auto text-slate-800 mb-4" />
                  <p className="text-slate-500">Select a project to view its video assembly status.</p>
                </div>
              ) : (
                <>
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Video className="w-4 h-4 text-violet-400" />
                            {selectedProject.title || 'Untitled Project'}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {selectedProject.scene_count || 0} scenes · {selectedProject.asset_count || 0} assets
                          </CardDescription>
                        </div>
                        {getStatusBadge(selectedProject.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="bg-violet-600 hover:bg-violet-700 flex-1 sm:flex-none"
                          disabled={assembling || !ffmpegStatus?.available
                            || ['assembling', 'video_complete'].includes(selectedProject.status)
                            || !['ready', 'failed'].includes(selectedProject.status)}
                          onClick={() => handleAssemble(selectedProject.id)}>
                          {assembling
                            ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Queuing…</>
                            : <><Video className="w-4 h-4 mr-2" /> Assemble Video</>}
                        </Button>
                        <Button variant="outline" size="sm"
                          className="border-slate-700 hover:bg-slate-800 text-xs"
                          onClick={() => fetchVideoRecord(selectedProject.id)}>
                          <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
                        </Button>
                        {videoRecord && (
                          <Button variant="outline" size="sm" disabled={deletingVideo}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                            onClick={() => handleDeleteVideo(selectedProject.id)}>
                            {deletingVideo ? 'Re-assembling…' : 'Re-assemble'}
                          </Button>
                        )}
                      </div>
                      {selectedProject.status === 'assets_pending' && (
                        <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                          <Clock className="w-4 h-4 shrink-0" />
                          Assets still generating — assembly will auto-trigger when all assets complete.
                        </div>
                      )}
                      {selectedProject.status === 'assembling' && (
                        <div className="flex items-center gap-2 text-sm text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2 animate-pulse">
                          <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                          Video assembly running — this may take a few minutes.
                        </div>
                      )}
                      {selectedProject.status === 'video_complete' && !videoRecord && (
                        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          Assembly complete — click Refresh to load the video record.
                        </div>
                      )}
                      {!ffmpegStatus?.available && ffmpegStatus !== null && (
                        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          FFmpeg is required for video assembly. Install it and set FFMPEG_PATH.
                        </div>
                      )}
                      {videoError && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                          <XCircle className="w-4 h-4 shrink-0" /> {videoError}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {videoLoading ? (
                    <Skeleton className="h-48 w-full bg-slate-900 rounded-xl" />
                  ) : videoRecord ? (
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Film className="w-4 h-4 text-violet-400" /> Assembled Video
                          </CardTitle>
                          {getStatusBadge(videoRecord.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Duration', value: videoRecord.duration_seconds ? `${Math.round(videoRecord.duration_seconds)}s` : '—' },
                            { label: 'Resolution', value: videoRecord.resolution || '—' },
                            { label: 'FPS', value: videoRecord.fps ? String(videoRecord.fps) : '—' },
                            { label: 'File Size', value: videoRecord.file_size_bytes
                                ? videoRecord.file_size_bytes > 1_000_000
                                  ? `${(videoRecord.file_size_bytes / 1_000_000).toFixed(1)} MB`
                                  : `${Math.round(videoRecord.file_size_bytes / 1024)} KB`
                                : '—' },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-slate-950 rounded-lg p-3 border border-slate-800/60">
                              <p className="text-[10px] text-slate-500 uppercase font-bold">{label}</p>
                              <p className="text-sm font-mono text-slate-200 mt-0.5">{value}</p>
                            </div>
                          ))}
                        </div>

                        {videoRecord.status === 'complete' && videoRecord.storage_url && (
                          <div className="space-y-2">
                            <video controls className="w-full rounded-lg border border-slate-800 bg-black max-h-64"
                              src={`${API_BASE_29}/projects/${selectedProject.id}/video/stream`}
                              onError={e => { (e.target as HTMLVideoElement).style.display = 'none'; }} />
                            <a href={`${API_BASE_29}/projects/${selectedProject.id}/video/download`}
                               target="_blank" rel="noopener noreferrer" className="block">
                              <Button className="w-full bg-violet-600 hover:bg-violet-700" size="sm">
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Download MP4
                              </Button>
                            </a>
                          </div>
                        )}

                        {videoRecord.status === 'failed' && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                            <p className="font-semibold mb-1">Assembly failed</p>
                            <p className="text-xs font-mono">{videoRecord.error_text || 'Unknown error'}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{videoRecord.scene_count || 0} scenes assembled</span>
                          {videoRecord.assembly_metadata?.errors?.length > 0 && (
                            <span className="text-amber-400">{videoRecord.assembly_metadata.errors.length} scene error(s)</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-10 text-center">
                      <Video className="w-10 h-10 mx-auto text-slate-800 mb-3" />
                      <p className="text-slate-500 text-sm">No video assembled yet for this project.</p>
                      <p className="text-slate-600 text-xs mt-1">Assembly auto-triggers when all assets complete, or click Assemble Video above.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Animations tab (Phase 30 Fix 2) ──────────────────────────────── */}
        <TabsContent value="animations" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-400" /> Image Animation Jobs
              </h3>
              <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800 text-xs"
                onClick={() => selectedProject && fetchAnimations(selectedProject.id)}>
                <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
              </Button>
            </div>
            {!selectedProject ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-slate-800 mb-4" />
                <p className="text-slate-500 text-sm">Select a project in the Runtime tab first.</p>
              </div>
            ) : animationsLoading ? (
              Array(3).fill(0).map((_,i) => <div key={i} className="h-16 bg-slate-900 rounded-lg animate-pulse" />)
            ) : animationJobs.length === 0 ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-slate-800 mb-4" />
                <p className="text-slate-500 text-sm">No animation jobs for this project yet.</p>
                <p className="text-slate-600 text-xs mt-1">Open an image asset in the Runtime tab and click Animate.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {animationJobs.map((anim: any) => (
                  <Card key={anim.id} className="bg-slate-900 border-slate-800">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-pink-500/10 rounded text-pink-400">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-200">
                              {anim.animation_style || anim.style || 'Animation'} · {anim.provider}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(anim.created_at).toLocaleString()}
                              {anim.duration_ms ? ` · ${(anim.duration_ms/1000).toFixed(1)}s` : ''}
                            </p>
                          </div>
                        </div>
                        <AiVideoStatusBadge status={anim.status} stage={anim.stage ?? ""} />
                      </div>
                      {anim.status === 'complete' && anim.output_url && (
                        <video controls className="w-full rounded border border-pink-500/20 bg-black max-h-28 mt-2"
                          src={`${API_BASE_30}/animations/${anim.id}/stream`}
                          onError={e=>{(e.target as HTMLVideoElement).style.display='none';}} />
                      )}
                      {anim.status === 'failed' && anim.error_text && (
                        <p className="text-[10px] text-red-400 mt-1.5 font-mono">{anim.error_text}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Styles tab (Phase 31) ─────────────────────────────────────────── */}
        <TabsContent value="styles" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-violet-400" /> Video Style Transform Jobs
              </h3>
              <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800 text-xs"
                onClick={async () => {
                  if (!selectedProject) return;
                  const res  = await fetch(`${API_BASE_31}/projects/${selectedProject.id}/styles`);
                  const json = await res.json();
                  if (json.success) setStyleJobs(json.data);
                }}>
                <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
              </Button>
            </div>
            {!selectedProject ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-12 text-center">
                <Wand2 className="w-12 h-12 mx-auto text-slate-800 mb-4" />
                <p className="text-slate-500 text-sm">Select a project in the Runtime tab first.</p>
              </div>
            ) : styleJobs.length === 0 ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-12 text-center">
                <Wand2 className="w-12 h-12 mx-auto text-slate-800 mb-4" />
                <p className="text-slate-500 text-sm">No style transform jobs for this project yet.</p>
                <p className="text-slate-600 text-xs mt-1">Open a video asset in the Runtime tab and click Transform.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {styleJobs.map((sj: any) => (
                  <Card key={sj.id} className="bg-slate-900 border-slate-800">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-violet-500/10 rounded text-violet-400">
                            <Wand2 className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-200 capitalize">
                              {sj.style_target} · {sj.provider}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(sj.created_at).toLocaleString()}
                              {sj.duration_ms ? ` · ${(sj.duration_ms/1000).toFixed(1)}s` : ''}
                              {sj.frame_count ? ` · ${sj.frames_processed}/${sj.frame_count} frames` : ''}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(sj.status)}
                      </div>
                      {sj.status === 'complete' && sj.output_url && (
                        <div className="mt-2 space-y-1">
                          <video controls className="w-full rounded border border-violet-500/20 bg-black max-h-28"
                            src={`${API_BASE_31}/styles/${sj.id}/stream`}
                            onError={e=>{(e.target as HTMLVideoElement).style.display='none';}} />
                          <a href={`${API_BASE_31}/styles/${sj.id}/download`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm"
                              className="w-full text-[10px] h-6 border-violet-500/30 text-violet-300 hover:bg-violet-500/10 mt-1">
                              <ExternalLink className="w-3 h-3 mr-1" /> Download Styled Video
                            </Button>
                          </a>
                        </div>
                      )}
                      {sj.status === 'failed' && sj.error_text && (
                        <p className="text-[10px] text-red-400 mt-1.5 font-mono">{sj.error_text}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

      
        {/* ── AI Videos tab (Phase 32) ─────────────────────────────────── */}
        <TabsContent value="ai_videos" className="mt-6">
          {aiVideosLoading ? (
            <Skeleton className="h-48 w-full bg-slate-900 rounded-xl" />
          ) : aiVideos.length === 0 ? (
            <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-12 text-center">
              <Clapperboard className="w-12 h-12 mx-auto text-slate-800 mb-4" />
              <p className="text-slate-500 text-sm">No AI video jobs yet.</p>
              <p className="text-slate-600 text-xs mt-1">Open any complete asset in the Runtime tab and use the AI Video Generation panel.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {aiVideos.map((job: any) => (
                <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{job.raw_input}</p>
                    <p className="text-xs text-slate-500">
                      {VIDEO_PROVIDER_LABELS[job.provider] ?? job.provider} · {job.aspect_ratio} · {job.duration_sec}s · {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>
                  <AiVideoStatusBadge status={job.status} stage={job.stage} />
                  {job.output_url && job.status === 'complete' && (
                    <>
                      <a href={API_BASE_32 + '/ai-videos/' + job.id + '/stream'} target="_blank" rel="noreferrer"
                         className="text-xs text-amber-400 hover:text-amber-300 underline whitespace-nowrap">Stream ↗</a>
                      <a href={API_BASE_32 + '/ai-videos/' + job.id + '/download'} target="_blank" rel="noreferrer"
                         className="text-xs text-amber-400 hover:text-amber-300 underline whitespace-nowrap">Download ↓</a>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

          {/* ── Phase 33 — Character Consistency Engine ─────────────────────── */}
          <TabsContent value="characters" className="mt-0">
            {selectedProject ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-200">Character Registry</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Manage character appearances and inject consistency into every scene
                    </p>
                  </div>
                </div>
                <CharacterRegistryPanel
                  orgId={selectedProject.org_id || 'default'}
                  projectId={selectedProject.id}
                  selectedProject={selectedProject}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-slate-600">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a project to manage characters</p>
              </div>
            )}
          </TabsContent>

      </Tabs>
    </div>
  );
}

function CurationPlanDialog({ datasetId }: { datasetId: string }) {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/datasets/${datasetId}/curation-plan`)
      .then(res => res.json())
      .then(json => {
        if (json.success) setPlan(json.data);
        setLoading(false);
      });
  }, [datasetId]);

  if (loading) return <DialogContent className="bg-slate-900 border-slate-800"><Skeleton className="h-64 w-full bg-slate-800" /></DialogContent>;

  return (
    <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl">
      <DialogHeader>
        <DialogTitle>Curation Plan: {plan.name}</DialogTitle>
        <DialogDescription className="text-slate-400">Standardized pipeline for media quality assurance.</DialogDescription>
      </DialogHeader>
      <div className="space-y-6 py-4">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Deduplication</h4>
            <p className="text-sm text-slate-300">{plan.deduplication_strategy}</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Quality Thresholds</h4>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>Resolution: {plan.quality_filters.min_resolution}</li>
              <li>Bitrate: {plan.quality_filters.min_bitrate_kbps} kbps</li>
              <li>Blur: &lt; {plan.quality_filters.max_blur_score}</li>
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Diversity Targets</h4>
          <div className="flex flex-wrap gap-2">
            {plan.diversity_targets.map((t: string, i: number) => (
              <Badge key={i} variant="outline" className="bg-slate-950 border-slate-800 text-slate-400">{t}</Badge>
            ))}
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Split Recommendation</h4>
          <div className="flex h-4 w-full rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full" style={{ width: `${plan.split_recommendation.train * 100}%` }} title="Train" />
            <div className="bg-emerald-500 h-full" style={{ width: `${plan.split_recommendation.val * 100}%` }} title="Val" />
            <div className="bg-amber-500 h-full" style={{ width: `${plan.split_recommendation.test * 100}%` }} title="Test" />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono">
            <span>TRAIN: {plan.split_recommendation.train * 100}%</span>
            <span>VAL: {plan.split_recommendation.val * 100}%</span>
            <span>TEST: {plan.split_recommendation.test * 100}%</span>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}
