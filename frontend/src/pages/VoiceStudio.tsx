/**
 * AutoFlowNG — Phase 35: AI Voice Studio
 * Route: /dashboard/voice-studio
 *
 * Sections: Voice Library · Text-to-Speech · Voice Cloning · Multi-Speaker · Character Voices
 */

import React, { useState, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Voice {
  id: string;
  name: string;
  description?: string;
  voice_type: 'preset' | 'clone' | 'character';
  provider: string;
  provider_voice_id: string;
  language_code: string;
  gender?: string;
  is_public: boolean;
}

interface ProviderInfo {
  provider: string;
  active: boolean;
  key_configured: boolean;
  capabilities: { tts: boolean; cloning: boolean; emotion: boolean };
  note: string;
}

interface VoiceJob {
  id: string;
  status: string;
  output_audio_url?: string;
  duration_ms?: number;
  error_text?: string;
}

interface ScriptSegment {
  id: string;
  speaker_name: string;
  voice_library_id: string;
  text: string;
  emotion: string;
  speed: number;
  pause_after_ms: number;
}

const API = '/api/phase35';

const EMOTIONS = ['neutral','happy','sad','angry','fearful','surprised','disgusted','excited'];
const CONSENT_TEXT = `I confirm I have the legal right to clone this voice, that the voice owner has given explicit permission, and I agree to the provider's terms of service. I understand that misuse may result in account termination and legal liability.`;

const PROVIDER_TOS: Record<string, string> = {
  elevenlabs: 'https://elevenlabs.io/terms',
  playht:     'https://play.ht/terms',
  cartesia:   'https://cartesia.ai/terms',
};

// ── Utility ───────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('autoflowng_token') || '';
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...((opts.headers as Record<string, string>) || {}),
    },
  });
  return res.json();
}

// ── Provider Status Banner ────────────────────────────────────────────────────

function ProviderBanner({ providers }: { providers: ProviderInfo[] }) {
  const internalActive = providers.find(p => p.provider === 'internal')?.active;
  const hasCloning = providers.some(p => p.capabilities.cloning && p.key_configured && p.active);

  if (hasCloning) return null;

  return (
    <div style={{
      background: '#1a2a3a', border: '1px solid #2a4a6a', borderRadius: 8,
      padding: '12px 16px', marginBottom: 20, color: '#90caf9', fontSize: 14,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>ℹ️</span>
      <div>
        <strong>Voice cloning and emotional speech</strong> require ElevenLabs, PlayHT, or Cartesia.
        <br />
        Currently using <strong>internal engine (Piper)</strong> — TTS and character voices are fully available.
        Set <code style={{ background: '#0d1b2a', padding: '1px 4px', borderRadius: 3 }}>ELEVENLABS_API_KEY</code> to unlock cloning.
      </div>
    </div>
  );
}

// ── Tab Navigation ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'library',    label: 'Voice Library' },
  { id: 'tts',        label: 'Text-to-Speech' },
  { id: 'cloning',    label: 'Voice Cloning' },
  { id: 'multi',      label: 'Multi-Speaker' },
  { id: 'characters', label: 'Character Voices' },
];

// ── Voice Library Tab ─────────────────────────────────────────────────────────

function VoiceLibraryTab({ providers }: { providers: ProviderInfo[] }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterProvider, setFilterProvider] = useState('');

  const hasCloning = providers.some(p => p.capabilities.cloning && p.key_configured);

  useEffect(() => {
    const params = new URLSearchParams({ include_system: 'true' });
    if (filterType)     params.set('type', filterType);
    if (filterProvider) params.set('provider', filterProvider);
    apiFetch(`/voices?${params}`).then(d => { setVoices(d.voices || []); setLoading(false); });
  }, [filterType, filterProvider]);

  const PROVIDER_COLORS: Record<string, string> = {
    internal: '#4caf50', elevenlabs: '#9c27b0', openai: '#2196f3',
    cartesia: '#ff9800', playht: '#e91e63', stub: '#607d8b',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {['', 'preset', 'clone', 'character'].map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: filterType === t ? '#1565c0' : '#1e2a3a', color: '#e3f2fd',
            fontWeight: filterType === t ? 600 : 400, fontSize: 13,
          }}>
            {t || 'All'}
          </button>
        ))}
        <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} style={{
          marginLeft: 'auto', padding: '6px 10px', borderRadius: 6, border: '1px solid #2a4a6a',
          background: '#1e2a3a', color: '#e3f2fd', fontSize: 13,
        }}>
          <option value="">All providers</option>
          {['internal','elevenlabs','openai','cartesia','playht'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: '#90a4ae' }}>Loading voices…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {voices.map(v => (
            <div key={v.id} style={{
              background: '#0d1b2a', border: '1px solid #1e3a5a', borderRadius: 10,
              padding: 16, position: 'relative',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 600, color: '#e3f2fd', fontSize: 15 }}>{v.name}</span>
                <span style={{
                  background: PROVIDER_COLORS[v.provider] || '#607d8b',
                  color: '#fff', fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700,
                }}>
                  {v.provider}
                </span>
              </div>
              {v.description && <p style={{ color: '#90a4ae', fontSize: 13, margin: '6px 0 0' }}>{v.description}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#78909c', background: '#1e2a3a', padding: '2px 6px', borderRadius: 4 }}>
                  {v.language_code}
                </span>
                {v.gender && (
                  <span style={{ fontSize: 11, color: '#78909c', background: '#1e2a3a', padding: '2px 6px', borderRadius: 4 }}>
                    {v.gender}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#78909c', background: '#1e2a3a', padding: '2px 6px', borderRadius: 4 }}>
                  {v.voice_type}
                </span>
                {v.voice_type === 'clone' && !hasCloning && (
                  <span style={{ fontSize: 11, color: '#ffa726' }}>🔒 Requires paid provider</span>
                )}
              </div>
            </div>
          ))}
          {voices.length === 0 && (
            <p style={{ color: '#78909c', gridColumn: '1/-1' }}>No voices found. Adjust filters.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Text-to-Speech Tab ────────────────────────────────────────────────────────

function TTSTab({ providers }: { providers: ProviderInfo[] }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [emotion, setEmotion] = useState('neutral');
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VoiceJob | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const activeProvider = resolveActiveProvider(providers);
  const isInternal = activeProvider === 'internal';
  const maxLen = 5000;

  useEffect(() => {
    apiFetch('/voices?include_system=true').then(d => {
      const vs = d.voices || [];
      setVoices(vs);
      if (vs.length > 0) setVoiceId(vs[0].id);
    });
  }, []);

  function resolveActiveProvider(ps: ProviderInfo[]) {
    const active = ps.find(p => p.active && p.provider !== 'stub');
    return active?.provider || 'internal';
  }

  async function synthesize() {
    if (!text.trim() || !voiceId) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch('/synthesize', {
        method: 'POST',
        body: JSON.stringify({ voice_library_id: voiceId, text, emotion, speed }),
      });
      setResult(data.job || data);
      if (data.output_audio_url && audioRef.current) {
        audioRef.current.src = data.output_audio_url;
        audioRef.current.play();
      }
    } catch (e: any) {
      setResult({ id: '', status: 'failed', error_text: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {isInternal && (
        <div style={{
          background: '#1a2a1a', border: '1px solid #2a5a2a', borderRadius: 6,
          padding: '8px 14px', marginBottom: 16, color: '#a5d6a7', fontSize: 13,
        }}>
          Using internal engine — generation may take 10–30 seconds on CPU.
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label style={{ color: '#90a4ae', fontSize: 13, display: 'block', marginBottom: 6 }}>Voice</label>
        <select value={voiceId} onChange={e => setVoiceId(e.target.value)} style={selectStyle}>
          {voices.map(v => <option key={v.id} value={v.id}>{v.name} ({v.provider})</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ color: '#90a4ae', fontSize: 13, display: 'block', marginBottom: 6 }}>
          Text <span style={{ color: '#546e7a' }}>({text.length}/{maxLen})</span>
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, maxLen))}
          rows={6}
          placeholder="Enter text to synthesize…"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={{ color: '#90a4ae', fontSize: 13, display: 'block', marginBottom: 6 }}>Emotion</label>
          <select value={emotion} onChange={e => setEmotion(e.target.value)} style={selectStyle}>
            {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ color: '#90a4ae', fontSize: 13, display: 'block', marginBottom: 6 }}>
            Speed: {speed.toFixed(1)}×
          </label>
          <input
            type="range" min={0.5} max={2.0} step={0.1}
            value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#1565c0' }}
          />
        </div>
      </div>

      <button onClick={synthesize} disabled={loading || !text.trim() || !voiceId} style={primaryBtn}>
        {loading ? 'Synthesizing…' : 'Synthesize'}
      </button>

      {result && (
        <div style={{
          marginTop: 20, background: '#0d1b2a', border: '1px solid #1e3a5a',
          borderRadius: 8, padding: 16,
        }}>
          <div style={{ marginBottom: 8, color: statusColor(result.status), fontWeight: 600, fontSize: 14 }}>
            Status: {result.status}
          </div>
          {result.output_audio_url && (
            <audio ref={audioRef} controls style={{ width: '100%', marginTop: 8 }}>
              <source src={result.output_audio_url} type="audio/mpeg" />
            </audio>
          )}
          {result.error_text && (
            <p style={{ color: '#ef9a9a', fontSize: 13, marginTop: 8 }}>{result.error_text}</p>
          )}
          {result.duration_ms && (
            <p style={{ color: '#78909c', fontSize: 12, marginTop: 6 }}>
              Duration: {(result.duration_ms / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Voice Cloning Tab ─────────────────────────────────────────────────────────

function CloningTab({ providers }: { providers: ProviderInfo[] }) {
  const cloneProv = providers.filter(p => p.capabilities.cloning && p.key_configured && p.active);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [provider, setProvider] = useState('elevenlabs');
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [consentChecked, setConsentChecked] = useState(false);
  const [cloneId, setCloneId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  if (cloneProv.length === 0) {
    return (
      <div style={{
        background: '#1a1a2a', border: '1px solid #2a2a5a', borderRadius: 10,
        padding: 32, textAlign: 'center', maxWidth: 480,
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <h3 style={{ color: '#e3f2fd', marginBottom: 8 }}>Voice Cloning — Upgrade Required</h3>
        <p style={{ color: '#90a4ae', fontSize: 14, marginBottom: 20 }}>
          Voice cloning requires ElevenLabs, PlayHT, or Cartesia.<br />
          The internal Piper engine supports TTS only.
        </p>
        <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" style={{ color: '#90caf9', fontSize: 14 }}>
          Learn how to add a provider key →
        </a>
      </div>
    );
  }

  async function submitStep1() {
    setLoading(true); setError('');
    try {
      const data = await apiFetch('/clones', {
        method: 'POST',
        body: JSON.stringify({ name, description: desc, provider, source_audio_urls: audioUrls }),
      });
      if (data.error) { setError(data.error); return; }
      setCloneId(data.id);
      setStep(2);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function confirmConsent() {
    if (!consentChecked) {
      setError('You must confirm consent. This is required by law and provider terms of service.');
      return;
    }
    setLoading(true); setError('');
    try {
      await apiFetch(`/clones/${cloneId}/consent`, {
        method: 'POST',
        body: JSON.stringify({ consent_confirmed: true }),
      });
      setStep(3);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function submitClone() {
    setLoading(true); setError(''); setStatus('');
    try {
      const data = await apiFetch(`/clones/${cloneId}/submit`, { method: 'POST' });
      if (data.error) { setError(data.message || data.error); }
      else { setStatus('Clone submitted successfully! Processing…'); setStep(4); }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {[1,2,3,4].map(s => (
          <div key={s} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: step >= s ? '#1565c0' : '#1e2a3a',
          }} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h3 style={{ color: '#e3f2fd', marginBottom: 16, fontWeight: 600 }}>Step 1: Voice Details</h3>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="My cloned voice" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Provider</label>
            <select value={provider} onChange={e => setProvider(e.target.value)} style={selectStyle}>
              {cloneProv.map(p => <option key={p.provider} value={p.provider}>{p.provider}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Audio Sample URLs (min 30s recommended)</label>
            <textarea
              rows={3}
              placeholder="One URL per line…"
              value={audioUrls.join('\n')}
              onChange={e => setAudioUrls(e.target.value.split('\n').filter(Boolean))}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
          {error && <p style={{ color: '#ef9a9a', fontSize: 13 }}>{error}</p>}
          <button onClick={submitStep1} disabled={loading || !name} style={primaryBtn}>
            {loading ? 'Creating…' : 'Next →'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 style={{ color: '#e3f2fd', marginBottom: 16, fontWeight: 600 }}>Step 3: Consent Required</h3>
          <div style={{
            background: '#0d1b2a', border: '1px solid #1e3a5a', borderRadius: 8,
            padding: 16, marginBottom: 20, color: '#cfd8dc', fontSize: 14, lineHeight: 1.6,
          }}>
            {CONSENT_TEXT}
          </div>
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input
              type="checkbox"
              id="consent"
              checked={consentChecked}
              onChange={e => setConsentChecked(e.target.checked)}
              style={{ marginTop: 3, cursor: 'pointer', accentColor: '#1565c0' }}
            />
            <label htmlFor="consent" style={{ color: '#e3f2fd', fontSize: 14, cursor: 'pointer' }}>
              I confirm the above consent statement.{' '}
              <a href={PROVIDER_TOS[provider]} target="_blank" rel="noreferrer" style={{ color: '#90caf9' }}>
                View {provider} Terms of Service
              </a>
            </label>
          </div>
          {error && <p style={{ color: '#ef9a9a', fontSize: 13, marginBottom: 12 }}>
            ⚠️ {error}
          </p>}
          <button onClick={confirmConsent} disabled={loading || !consentChecked} style={primaryBtn}>
            {loading ? 'Confirming…' : 'Confirm Consent & Continue →'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 style={{ color: '#e3f2fd', marginBottom: 16, fontWeight: 600 }}>Step 4: Submit to Provider</h3>
          <p style={{ color: '#90a4ae', fontSize: 14, marginBottom: 20 }}>
            Consent confirmed. Ready to submit to <strong style={{ color: '#e3f2fd' }}>{provider}</strong>.
          </p>
          {error && <p style={{ color: '#ef9a9a', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</p>}
          <button onClick={submitClone} disabled={loading} style={primaryBtn}>
            {loading ? 'Submitting…' : 'Submit Clone Request'}
          </button>
        </div>
      )}

      {step === 4 && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3 style={{ color: '#a5d6a7', marginBottom: 8 }}>Clone Submitted</h3>
          <p style={{ color: '#90a4ae', fontSize: 14 }}>{status}</p>
        </div>
      )}
    </div>
  );
}

// ── Multi-Speaker Tab ─────────────────────────────────────────────────────────

function MultiSpeakerTab() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [title, setTitle] = useState('My Script');
  const [segments, setSegments] = useState<ScriptSegment[]>([{
    id: '1', speaker_name: 'Speaker 1', voice_library_id: '',
    text: '', emotion: 'neutral', speed: 1.0, pause_after_ms: 500,
  }]);
  const [scriptId, setScriptId] = useState('');
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<any>(null);

  useEffect(() => {
    apiFetch('/voices?include_system=true').then(d => setVoices(d.voices || []));
  }, []);

  function addSegment() {
    setSegments(s => [...s, {
      id: Date.now().toString(), speaker_name: `Speaker ${s.length + 1}`,
      voice_library_id: voices[0]?.id || '', text: '',
      emotion: 'neutral', speed: 1.0, pause_after_ms: 500,
    }]);
  }

  function updateSeg(id: string, field: string, value: any) {
    setSegments(s => s.map(seg => seg.id === id ? { ...seg, [field]: value } : seg));
  }

  async function renderScript() {
    setRendering(true); setRenderResult(null);
    const data = await apiFetch('/scripts', {
      method: 'POST', body: JSON.stringify({ title, segments }),
    });
    const sid = data.id;
    setScriptId(sid);
    const result = await apiFetch(`/scripts/${sid}/render`, { method: 'POST' });
    setRenderResult(result);
    setRendering(false);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Script Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 16 }}>
        {segments.map((seg, i) => (
          <div key={seg.id} style={{
            background: '#0d1b2a', border: '1px solid #1e3a5a', borderRadius: 8,
            padding: 14, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Speaker</label>
                <input
                  value={seg.speaker_name}
                  onChange={e => updateSeg(seg.id, 'speaker_name', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Voice</label>
                <select
                  value={seg.voice_library_id}
                  onChange={e => updateSeg(seg.id, 'voice_library_id', e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Select voice…</option>
                  {voices.map(v => <option key={v.id} value={v.id}>{v.name} ({v.provider})</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Text</label>
              <textarea
                rows={2} value={seg.text}
                onChange={e => updateSeg(seg.id, 'text', e.target.value)}
                placeholder="What this speaker says…"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Emotion</label>
                <select value={seg.emotion} onChange={e => updateSeg(seg.id, 'emotion', e.target.value)} style={selectStyle}>
                  {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Speed ({seg.speed}×)</label>
                <input type="range" min={0.5} max={2.0} step={0.1} value={seg.speed}
                  onChange={e => updateSeg(seg.id, 'speed', parseFloat(e.target.value))}
                  style={{ width: '100%', marginTop: 8, accentColor: '#1565c0' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Pause after (ms)</label>
                <input type="number" value={seg.pause_after_ms} min={0} step={100}
                  onChange={e => updateSeg(seg.id, 'pause_after_ms', parseInt(e.target.value))}
                  style={inputStyle} />
              </div>
              <button onClick={() => setSegments(s => s.filter(x => x.id !== seg.id))}
                disabled={segments.length === 1}
                style={{ alignSelf: 'flex-end', padding: '7px 12px', background: '#1e2a3a',
                  border: '1px solid #2a4a6a', borderRadius: 6, color: '#ef9a9a', cursor: 'pointer', fontSize: 18 }}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button onClick={addSegment} style={{ ...primaryBtn, background: '#1e2a3a' }}>+ Add Speaker</button>
        <button onClick={renderScript} disabled={rendering} style={primaryBtn}>
          {rendering ? 'Rendering…' : '🎙 Render'}
        </button>
      </div>

      {renderResult && renderResult.output_audio_url && (
        <div style={{ background: '#0d1b2a', border: '1px solid #1e3a5a', borderRadius: 8, padding: 16 }}>
          <p style={{ color: '#a5d6a7', marginBottom: 10, fontWeight: 600 }}>✅ Render complete</p>
          <audio controls style={{ width: '100%' }}>
            <source src={renderResult.output_audio_url} type="audio/mpeg" />
          </audio>
          <p style={{ color: '#78909c', fontSize: 12, marginTop: 8 }}>
            {renderResult.segment_count} segments · {((renderResult.total_duration_ms || 0) / 1000).toFixed(1)}s
          </p>
          <a href={renderResult.output_audio_url} download="multi-speaker.mp3"
            style={{ color: '#90caf9', fontSize: 13 }}>Download MP3</a>
        </div>
      )}
    </div>
  );
}

// ── Character Voices Tab ──────────────────────────────────────────────────────

function CharacterVoicesTab() {
  const [characters, setCharacters] = useState<Voice[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    apiFetch('/characters').then(d => setCharacters(d.characters || []));
    apiFetch('/voices?include_system=true').then(d => { const vs = d.voices || []; setVoices(vs); if (vs.length) setVoiceId(vs[0].provider_voice_id); });
  }, []);

  async function createCharacter() {
    setCreating(true);
    const selectedVoice = voices.find(v => v.provider_voice_id === voiceId);
    await apiFetch('/characters', {
      method: 'POST',
      body: JSON.stringify({
        name, description: desc,
        provider_voice_id: voiceId,
        provider: selectedVoice?.provider || 'internal',
      }),
    });
    const data = await apiFetch('/characters');
    setCharacters(data.characters || []);
    setCreating(false); setShowForm(false); setName(''); setDesc('');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ color: '#90a4ae', fontSize: 14 }}>
          Character voices are named presets wrapping a voice with fixed defaults.
        </p>
        <button onClick={() => setShowForm(!showForm)} style={primaryBtn}>
          {showForm ? 'Cancel' : '+ New Character'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#0d1b2a', border: '1px solid #1e3a5a', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h4 style={{ color: '#e3f2fd', marginBottom: 14, fontWeight: 600 }}>Create Character Voice</h4>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Character Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Friendly Support Bot" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Base Voice</label>
            <select value={voiceId} onChange={e => setVoiceId(e.target.value)} style={selectStyle}>
              {voices.map(v => <option key={v.id} value={v.provider_voice_id}>{v.name} ({v.provider})</option>)}
            </select>
          </div>
          <button onClick={createCharacter} disabled={creating || !name} style={primaryBtn}>
            {creating ? 'Creating…' : 'Create Character'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {characters.map(c => (
          <div key={c.id} style={{
            background: '#0d1b2a', border: '1px solid #1e3a5a', borderRadius: 10, padding: 16,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎭</div>
            <div style={{ fontWeight: 600, color: '#e3f2fd', marginBottom: 4 }}>{c.name}</div>
            {c.description && <p style={{ color: '#78909c', fontSize: 13 }}>{c.description}</p>}
            <span style={{ fontSize: 11, color: '#546e7a', background: '#1e2a3a', padding: '2px 6px', borderRadius: 4 }}>
              {c.provider}
            </span>
          </div>
        ))}
        {characters.length === 0 && (
          <p style={{ color: '#78909c', gridColumn: '1/-1', fontSize: 14 }}>
            No character voices yet. Create one above.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: '#1e2a3a', border: '1px solid #2a4a6a', borderRadius: 6,
  color: '#e3f2fd', padding: '8px 12px', fontSize: 14, width: '100%',
  boxSizing: 'border-box', outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6,
  padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  color: '#90a4ae', fontSize: 13, display: 'block', marginBottom: 5,
};

function statusColor(status: string) {
  const map: Record<string, string> = {
    complete: '#a5d6a7', failed: '#ef9a9a', processing: '#ffa726', pending: '#90a4ae',
  };
  return map[status] || '#cfd8dc';
}

// ── Main VoiceStudio Page ─────────────────────────────────────────────────────

export default function VoiceStudio() {
  const [activeTab, setActiveTab] = useState('library');
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    apiFetch('/providers').then(d => {
      if (Array.isArray(d)) setProviders(d);
    }).catch(() => {});
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#060e18', color: '#cfd8dc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '32px 24px',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e3f2fd', margin: 0 }}>
            🎙 AI Voice Studio
          </h1>
          <p style={{ color: '#78909c', marginTop: 6, fontSize: 14 }}>
            Phase 35 — Powered by Piper (internal, free) · Optional: ElevenLabs, OpenAI, Cartesia, PlayHT
          </p>
        </div>

        {/* Provider banner */}
        {providers.length > 0 && <ProviderBanner providers={providers} />}

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid #1e2a3a' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              color: activeTab === t.id ? '#90caf9' : '#78909c', fontWeight: activeTab === t.id ? 700 : 400,
              fontSize: 14, borderBottom: activeTab === t.id ? '2px solid #1565c0' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.2s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'library'    && <VoiceLibraryTab    providers={providers} />}
        {activeTab === 'tts'        && <TTSTab              providers={providers} />}
        {activeTab === 'cloning'    && <CloningTab          providers={providers} />}
        {activeTab === 'multi'      && <MultiSpeakerTab />}
        {activeTab === 'characters' && <CharacterVoicesTab />}
      </div>
    </div>
  );
}
