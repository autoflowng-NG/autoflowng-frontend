/**
 * AutoFlowNG — Phase 33: Character Registry Panel
 * Full character management panel with list, form, injection preview,
 * memory timeline, asset links, and consistency application.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';
import {
  Users, Plus, Search, Archive, Trash2, ChevronDown, ChevronUp,
  RefreshCw, Wand2, AlertTriangle, CheckCircle2, XCircle, Clock,
  FileImage, Mic, Tag, Sparkles, BookOpen, Eye,
} from 'lucide-react';

const API_BASE_33 = '/api/phase33';

const CHARACTER_TYPES = ['anime', 'cartoon', 'realistic', 'mascot', 'custom'] as const;
type CharacterType = typeof CHARACTER_TYPES[number];

const TYPE_COLORS: Record<CharacterType, string> = {
  anime:     'bg-purple-500/20 text-purple-300 border-purple-500/30',
  cartoon:   'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  realistic: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  mascot:    'bg-green-500/20 text-green-300 border-green-500/30',
  custom:    'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const MEMORY_COLORS: Record<string, string> = {
  appearance_approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  appearance_rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  outfit_change:       'bg-amber-500/20 text-amber-300 border-amber-500/30',
  voice_sample:        'bg-blue-500/20 text-blue-300 border-blue-500/30',
  prompt_injection:    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  drift_detected:      'bg-red-500/20 text-red-300 border-red-500/30',
};

// ── CharacterDriftBadge (named export) ────────────────────────────────────────
export function CharacterDriftBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <Badge className="text-[9px] px-1.5 py-0 bg-red-500/20 text-red-300 border-red-500/30 border">
      <AlertTriangle className="w-2.5 h-2.5 mr-1 inline" />
      {count} drift
    </Badge>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface CharacterRegistryPanelProps {
  orgId: string;
  projectId?: string;
  selectedProject?: any;
}

const EMPTY_FORM = {
  name: '', slug: '', type: 'anime' as CharacterType,
  appearance_prompt: '', negative_appearance: '', outfit_description: '',
  outfit_locked: true, personality_notes: '', tags: '',
  voice_provider: '', voice_id: '', voice_locked: false,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CharacterRegistryPanel({ orgId, projectId, selectedProject }: CharacterRegistryPanelProps) {
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Injection preview
  const [testPrompt, setTestPrompt] = useState('');
  const [injectionResult, setInjectionResult] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Memory
  const [memory, setMemory] = useState<any[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [newMemoryType, setNewMemoryType] = useState('outfit_change');
  const [newMemorySummary, setNewMemorySummary] = useState('');

  // Asset links
  const [assetLinks, setAssetLinks] = useState<any[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  // Apply result
  const [applyResult, setApplyResult] = useState<{ processed: number; failed: number; skipped: number } | null>(null);
  const [applying, setApplying] = useState(false);

  // ── Fetch characters ───────────────────────────────────────────────────────
  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ org_id: orgId });
      if (projectId) params.set('project_id', projectId);
      if (typeFilter) params.set('type', typeFilter);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`${API_BASE_33}/characters?${params}`);
      const json = await res.json();
      if (json.success) setCharacters(json.data || []);
      else setError(json.error || 'Failed to load characters');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [orgId, projectId, typeFilter, searchText]);

  useEffect(() => { fetchCharacters(); }, [fetchCharacters]);

  // ── Select character → load memory ────────────────────────────────────────
  const selectCharacter = async (char: any) => {
    setSelected(char);
    setShowForm(false);
    setInjectionResult(null);
    loadMemory(char.id);
    if (projectId) loadAssetLinks(char.id);
  };

  const loadMemory = async (characterId: string) => {
    setMemoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_33}/characters/${characterId}/memory?limit=20`);
      const json = await res.json();
      if (json.success) setMemory(json.data || []);
    } catch { /* ignore */ }
    finally { setMemoryLoading(false); }
  };

  const loadAssetLinks = async (characterId: string) => {
    setLinksLoading(true);
    try {
      const { rows } = await (async () => {
        // We get links from the character detail endpoint
        const res = await fetch(`${API_BASE_33}/characters/${characterId}?org_id=${orgId}`);
        const json = await res.json();
        return { rows: json.data?.assetLinks || [] };
      })();
      setAssetLinks(rows);
    } catch { /* ignore */ }
    finally { setLinksLoading(false); }
  };

  // ── Slug auto-generation ───────────────────────────────────────────────────
  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-{2,}/g, '-');

  // ── Form submission ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        org_id: orgId,
        project_id: projectId || null,
        tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      };
      const url = editingId
        ? `${API_BASE_33}/characters/${editingId}`
        : `${API_BASE_33}/characters`;
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      await fetchCharacters();
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      if (json.data) setSelected(json.data);
    } catch (e: any) { setFormError(e.message); }
    finally { setSubmitting(false); }
  };

  // ── Archive / Delete ───────────────────────────────────────────────────────
  const handleArchive = async (charId: string) => {
    await fetch(`${API_BASE_33}/characters/${charId}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    fetchCharacters();
    if (selected?.id === charId) setSelected(null);
  };

  const handleDelete = async (charId: string) => {
    if (!confirm('Delete this character? This cannot be undone.')) return;
    const res = await fetch(`${API_BASE_33}/characters/${charId}?org_id=${orgId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    fetchCharacters();
    if (selected?.id === charId) setSelected(null);
  };

  // ── Injection preview ──────────────────────────────────────────────────────
  const handlePreviewInjection = async () => {
    if (!selected || !testPrompt.trim()) return;
    setPreviewing(true);
    setInjectionResult(null);
    try {
      const res = await fetch(`${API_BASE_33}/preview-injection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testPrompt, character_ids: [selected.id] }),
      });
      const json = await res.json();
      if (json.success) setInjectionResult(json);
    } catch { /* ignore */ }
    finally { setPreviewing(false); }
  };

  // ── Record manual memory ───────────────────────────────────────────────────
  const handleRecordMemory = async () => {
    if (!selected || !newMemorySummary.trim()) return;
    await fetch(`${API_BASE_33}/characters/${selected.id}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, type: newMemoryType, summary: newMemorySummary }),
    });
    setShowMemoryForm(false);
    setNewMemorySummary('');
    loadMemory(selected.id);
  };

  // ── Apply consistency to project ───────────────────────────────────────────
  const handleApplyAll = async () => {
    if (!projectId) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch(`${API_BASE_33}/projects/${projectId}/apply-all-characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await res.json();
      if (json.success) setApplyResult(json.data);
    } catch { /* ignore */ }
    finally { setApplying(false); }
  };

  // ── Approve / flag drift on asset links ───────────────────────────────────
  const handleApproveLink = async (assetId: string) => {
    if (!selected) return;
    await fetch(`${API_BASE_33}/assets/${assetId}/characters/${selected.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    loadAssetLinks(selected.id);
  };

  const handleFlagDriftLink = async (assetId: string) => {
    if (!selected) return;
    await fetch(`${API_BASE_33}/assets/${assetId}/characters/${selected.id}/flag-drift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drift_score: 0.8 }),
    });
    loadAssetLinks(selected.id);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const openCreateForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
    setSelected(null);
  };

  const openEditForm = (char: any) => {
    setForm({
      name: char.name || '',
      slug: char.slug || '',
      type: char.type || 'anime',
      appearance_prompt: char.appearance_prompt || '',
      negative_appearance: char.negative_appearance || '',
      outfit_description: char.outfit_description || '',
      outfit_locked: char.outfit_locked ?? true,
      personality_notes: char.personality_notes || '',
      tags: (char.tags || []).join(', '),
      voice_provider: char.voice_provider || '',
      voice_id: char.voice_id || '',
      voice_locked: char.voice_locked ?? false,
    });
    setEditingId(char.id);
    setShowForm(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── A: Character list ──────────────────────────────────────────────── */}
      <div className="lg:col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-400" />
            Characters
            <Badge className="text-[9px] px-1.5 py-0 bg-slate-800 text-slate-400">{characters.length}</Badge>
          </h3>
          <Button
            size="sm"
            onClick={openCreateForm}
            className="text-[10px] h-6 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-3 h-3 mr-1" />New
          </Button>
        </div>

        {/* Filter bar */}
        <div className="space-y-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input
              className="w-full bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 pl-6 pr-2 py-1.5 focus:outline-none focus:border-emerald-500/50"
              placeholder="Search characters…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setTypeFilter('')}
              className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${!typeFilter ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}
            >
              All
            </button>
            {CHARACTER_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                className={`text-[9px] px-2 py-0.5 rounded border capitalize transition-colors ${typeFilter === t ? `${TYPE_COLORS[t]}` : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full bg-slate-900 rounded-lg" />)}
          </div>
        ) : error ? (
          <p className="text-[11px] text-red-400">{error}</p>
        ) : characters.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-[11px]">No characters yet</p>
            <p className="text-[10px] mt-1">Create one to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {characters.map(char => (
              <div
                key={char.id}
                onClick={() => selectCharacter(char)}
                className={`rounded-lg border p-3 cursor-pointer transition-all ${
                  selected?.id === char.id
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-200 truncate">{char.name}</span>
                      <Badge className={`text-[8px] px-1 py-0 border capitalize ${TYPE_COLORS[char.type as CharacterType] || TYPE_COLORS.custom}`}>
                        {char.type}
                      </Badge>
                      {char.status === 'archived' && (
                        <Badge className="text-[8px] px-1 py-0 bg-slate-700/40 text-slate-500 border-slate-700">Archived</Badge>
                      )}
                      {char.drift_warning_count > 0 && <CharacterDriftBadge count={char.drift_warning_count} />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {char.appearance_prompt?.slice(0, 80)}{char.appearance_prompt?.length > 80 ? '…' : ''}
                    </p>
                    <p className="text-[9px] text-slate-600 mt-1">
                      {char.asset_count} assets · {char.scene_count} scenes · {char.drift_warning_count} ⚠ drifts
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right panel: Form or Detail ────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">

        {/* ── B: Character Form ────────────────────────────────────────────── */}
        {showForm && (
          <Card className="bg-slate-950 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-200">
                {editingId ? 'Edit Character' : 'New Character'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                {formError && <p className="text-[11px] text-red-400">{formError}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Name *</label>
                    <input
                      required
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-emerald-500/50"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
                      placeholder="Hero Fox"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Slug</label>
                    <input
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-400 px-2 py-1.5 focus:outline-none focus:border-emerald-500/50"
                      value={form.slug}
                      onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                      placeholder="hero-fox"
                    />
                  </div>
                </div>

                {/* Type picker */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">Type *</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {CHARACTER_TYPES.map(t => (
                      <button
                        key={t} type="button"
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`text-[10px] px-3 py-1 rounded border capitalize transition-colors ${form.type === t ? `${TYPE_COLORS[t]}` : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Appearance prompt */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">Locked Appearance Description *</label>
                  <p className="text-[9px] text-slate-600 mt-0.5">Be specific: colours, features, markings. This is injected into every scene.</p>
                  <textarea
                    required
                    rows={4}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 px-2 py-1.5 resize-none focus:outline-none focus:border-emerald-500/50"
                    value={form.appearance_prompt}
                    onChange={e => setForm(f => ({ ...f, appearance_prompt: e.target.value }))}
                    placeholder="Fox with orange fur, white chest, green eyes, wearing blue hoodie"
                  />
                </div>

                {/* Negative appearance */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">Exclude from Generations</label>
                  <textarea
                    rows={2}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 px-2 py-1.5 resize-none focus:outline-none focus:border-emerald-500/50"
                    value={form.negative_appearance}
                    onChange={e => setForm(f => ({ ...f, negative_appearance: e.target.value }))}
                    placeholder="Wrong colour fur, realistic photo style, human proportions"
                  />
                </div>

                {/* Outfit */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Outfit Description</label>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.outfit_locked}
                        onChange={e => setForm(f => ({ ...f, outfit_locked: e.target.checked }))}
                      />
                      Lock outfit
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 px-2 py-1.5 resize-none focus:outline-none focus:border-emerald-500/50"
                    value={form.outfit_description}
                    onChange={e => setForm(f => ({ ...f, outfit_description: e.target.value }))}
                    placeholder="Blue zip-up hoodie, white sneakers, dark jeans"
                  />
                </div>

                {/* Personality */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">Personality Notes</label>
                  <textarea
                    rows={2}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 px-2 py-1.5 resize-none focus:outline-none focus:border-emerald-500/50"
                    value={form.personality_notes}
                    onChange={e => setForm(f => ({ ...f, personality_notes: e.target.value }))}
                    placeholder="Brave, curious, protective of friends"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3" />Tags (comma-separated)
                  </label>
                  <input
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-emerald-500/50"
                    value={form.tags}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                    placeholder="protagonist, hero, series-1"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-8"
                  >
                    {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create Character'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowForm(false); setEditingId(null); }}
                    className="text-[11px] h-8 border-slate-700 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Character detail (selected) ────────────────────────────────── */}
        {selected && !showForm && (
          <div className="space-y-4">
            {/* Header card */}
            <Card className="bg-slate-950 border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                      {selected.name}
                      <Badge className={`text-[9px] px-1.5 py-0 border capitalize ${TYPE_COLORS[selected.type as CharacterType] || TYPE_COLORS.custom}`}>
                        {selected.type}
                      </Badge>
                      {selected.status === 'archived' && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-slate-700/40 text-slate-500 border-slate-700">Archived</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-[10px] mt-1">
                      <code className="text-slate-500 bg-slate-900 px-1 rounded">{selected.slug}</code>
                    </CardDescription>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditForm(selected)}
                      className="text-[10px] h-6 border-slate-700 hover:bg-slate-800"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleArchive(selected.id)}
                      className="text-[10px] h-6 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                      <Archive className="w-3 h-3" />
                    </Button>
                    {selected.asset_count === 0 && selected.scene_count === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(selected.id)}
                        className="text-[10px] h-6 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Appearance</p>
                  <p className="text-[11px] text-slate-300 bg-slate-900 rounded p-2">{selected.appearance_prompt}</p>
                </div>
                {selected.negative_appearance && (
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Negative</p>
                    <p className="text-[10px] text-slate-400">{selected.negative_appearance}</p>
                  </div>
                )}
                {selected.outfit_description && (
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">
                      Outfit {selected.outfit_locked ? '🔒' : '🔓'}
                    </p>
                    <p className="text-[10px] text-slate-400">{selected.outfit_description}</p>
                  </div>
                )}
                <div className="flex gap-4 pt-1">
                  <span className="text-[10px] text-slate-500">{selected.asset_count} assets</span>
                  <span className="text-[10px] text-slate-500">{selected.scene_count} scenes</span>
                  {selected.drift_warning_count > 0 && (
                    <span className="text-[10px] text-red-400">⚠ {selected.drift_warning_count} drifts</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── C: Injection preview ──────────────────────────────────── */}
            <Card className="bg-slate-950 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-300 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                  Injection Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-indigo-500/50"
                    placeholder="A hero walks into a darkened room…"
                    value={testPrompt}
                    onChange={e => setTestPrompt(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={handlePreviewInjection}
                    disabled={previewing || !testPrompt.trim()}
                    className="text-[10px] h-8 bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
                  >
                    {previewing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3 mr-1" />}
                    Preview
                  </Button>
                </div>
                {injectionResult && (
                  <div className="space-y-2">
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Injected Prompt</p>
                      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded p-2">
                        <p className="text-[10px] text-indigo-200 leading-relaxed">{injectionResult.injectedPrompt}</p>
                      </div>
                    </div>
                    {injectionResult.negativePrompt && (
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Negative Prompt</p>
                        <p className="text-[10px] text-red-300 bg-red-950/20 rounded p-2">{injectionResult.negativePrompt}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── D: Memory timeline ────────────────────────────────────── */}
            <Card className="bg-slate-950 border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs text-slate-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    Memory Timeline
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowMemoryForm(m => !m)}
                    className="text-[10px] h-6 border-slate-700 hover:bg-slate-800"
                  >
                    <Plus className="w-3 h-3 mr-1" />Record Note
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {showMemoryForm && (
                  <div className="bg-slate-900 rounded p-2 space-y-2 border border-slate-800">
                    <select
                      className="w-full bg-slate-950 border border-slate-700 rounded text-[11px] text-slate-300 px-2 py-1.5 focus:outline-none"
                      value={newMemoryType}
                      onChange={e => setNewMemoryType(e.target.value)}
                    >
                      <option value="outfit_change">Outfit Change</option>
                      <option value="appearance_approved">Appearance Approved</option>
                      <option value="appearance_rejected">Appearance Rejected</option>
                      <option value="voice_sample">Voice Sample</option>
                    </select>
                    <input
                      className="w-full bg-slate-950 border border-slate-700 rounded text-[11px] text-slate-300 px-2 py-1.5 focus:outline-none"
                      placeholder="Brief summary of what changed…"
                      value={newMemorySummary}
                      onChange={e => setNewMemorySummary(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={handleRecordMemory}
                      disabled={!newMemorySummary.trim()}
                      className="text-[10px] h-6 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Save Note
                    </Button>
                  </div>
                )}
                {memoryLoading ? (
                  <Skeleton className="h-16 w-full bg-slate-900 rounded" />
                ) : memory.length === 0 ? (
                  <p className="text-[10px] text-slate-600 text-center py-4">No memory entries yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {memory.map(entry => (
                      <div key={entry.id} className="flex items-start gap-2">
                        <Badge className={`text-[8px] px-1 py-0 border whitespace-nowrap flex-shrink-0 ${MEMORY_COLORS[entry.memory_type] || 'bg-slate-700/40 text-slate-400 border-slate-700'}`}>
                          {entry.memory_type.replace('_', ' ')}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-300 truncate">{entry.summary}</p>
                          <p className="text-[9px] text-slate-600">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── E: Asset links (if projectId) ─────────────────────────── */}
            {projectId && (
              <Card className="bg-slate-950 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-slate-300 flex items-center gap-1.5">
                    <FileImage className="w-3.5 h-3.5 text-pink-400" />
                    Asset Links
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linksLoading ? (
                    <Skeleton className="h-16 w-full bg-slate-900 rounded" />
                  ) : assetLinks.length === 0 ? (
                    <p className="text-[10px] text-slate-600 text-center py-4">No asset links for this project</p>
                  ) : (
                    <div className="space-y-2">
                      {assetLinks.map((link: any) => (
                        <div key={link.id} className="flex items-center gap-2 bg-slate-900 rounded p-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-slate-300 truncate">{link.asset_id}</p>
                            {link.drift_score != null && (
                              <div className="mt-1">
                                <Progress value={(1 - link.drift_score) * 100} className="h-1" />
                                <p className="text-[9px] text-slate-500 mt-0.5">
                                  Consistency: {Math.round((1 - link.drift_score) * 100)}%
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {link.approved && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            {link.drift_flagged && <AlertTriangle className="w-3 h-3 text-red-400" />}
                            {!link.approved && (
                              <button
                                onClick={() => handleApproveLink(link.asset_id)}
                                className="text-[9px] text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            {!link.drift_flagged && (
                              <button
                                onClick={() => handleFlagDriftLink(link.asset_id)}
                                className="text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
                              >
                                Flag
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── F: Apply consistency (if projectId) ───────────────────── */}
            {projectId && (
              <Card className="bg-slate-950 border-emerald-500/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-slate-300 font-medium">Apply Character Consistency</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Inject locked appearance into all pending assets in this project
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleApplyAll}
                      disabled={applying}
                      className="text-[10px] h-8 bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                    >
                      {applying ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                      Apply to All
                    </Button>
                  </div>
                  {applyResult && (
                    <div className="mt-3 bg-slate-900 rounded p-2 text-[10px]">
                      <span className="text-emerald-400">✅ {applyResult.processed} updated</span>
                      {applyResult.failed > 0 && <span className="text-red-400 ml-2">❌ {applyResult.failed} failed</span>}
                      {applyResult.skipped > 0 && <span className="text-slate-500 ml-2">{applyResult.skipped} skipped (no characters)</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty state */}
        {!selected && !showForm && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <Users className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Select a character to view details</p>
            <p className="text-[11px] mt-1">or create a new one to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
