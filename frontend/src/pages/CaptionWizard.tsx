/**
 * AutoFlowNG — Caption/Copy Engine Wizard (Phase 47B)
 *
 * A 5-field input wizard (product, offer, audience, tone, brand) that generates
 * ad copy for Meta, Google Search, TikTok, and LinkedIn in one call, then presents
 * a multi-channel workspace where each field can be individually regenerated.
 *
 * Design tokens/fonts copied verbatim from CampaignAgentsPage.tsx to stay visually
 * consistent with the rest of the campaign-agent surface.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Wand2, Loader2, RefreshCw, Copy, Check, ChevronLeft,
  Megaphone, Search, Music2, Linkedin, Building2,
} from 'lucide-react';
import { captionEngine, brandAPI, campaignAgents, type CaptionTone, type CaptionEngineOutput } from '../lib/api';
import { PageTransition } from '../components/PageTransition';
import { useToast } from '@/hooks/use-toast';

/* ── Design tokens (copied from CampaignAgentsPage.tsx for visual consistency) ── */
const C = {
  bg:      "#060810",
  surface: "#0C0F1A",
  raised:  "#111520",
  border:  "rgba(255,255,255,0.06)",
  borderH: "rgba(255,255,255,0.11)",
  text:    "#E2E8FF",
  muted:   "rgba(226,232,255,0.45)",
  faint:   "rgba(226,232,255,0.22)",
  green:   "#00C896",
  blue:    "#38BDF8",
  purple:  "#A78BFA",
  amber:   "#FBBF24",
  red:     "#FB7185",
};
const FONT_HEAD = "'Syne',sans-serif";
const FONT_BODY = "'DM Sans',sans-serif";
const FONT_MONO = "'DM Mono',monospace";

type Channel = 'meta_ads' | 'google_search' | 'tiktok_ads' | 'linkedin_ads';

const CHANNELS: { key: Channel; label: string; icon: any; color: string }[] = [
  { key: 'meta_ads',      label: 'Meta Ads',      icon: Megaphone, color: C.blue },
  { key: 'google_search', label: 'Google Search', icon: Search,    color: C.amber },
  { key: 'tiktok_ads',    label: 'TikTok Ads',    icon: Music2,    color: C.purple },
  { key: 'linkedin_ads',  label: 'LinkedIn Ads',  icon: Linkedin,  color: C.green },
];

const TONES: { value: CaptionTone; label: string; hint: string }[] = [
  { value: 'professional', label: 'Professional', hint: 'Clean, formal, corporate' },
  { value: 'gen_z',        label: 'Trendy Gen-Z',  hint: 'Internet culture, punchy hooks' },
  { value: 'naija',        label: 'Naija Street-Smart', hint: 'Localized Nigerian Pidgin flavor' },
];

export default function CaptionWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [product, setProduct]   = useState('');
  const [offer, setOffer]       = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone]         = useState<CaptionTone>('professional');
  const [brandId, setBrandId]   = useState('');
  const [brands, setBrands]     = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [output, setOutput]   = useState<CaptionEngineOutput | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel>('meta_ads');
  const [rewritingField, setRewritingField] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    brandAPI.list?.()
      .then((res: any) => setBrands(res?.brands || res || []))
      .catch(() => {});
  }, []);

  const canGenerate = product.trim().length > 0 && !loading;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    try {
      const res = await captionEngine.generate({ product, offer, audience, tone, brandId: brandId || undefined });
      setOutput(res.output);
      setDraftId(res.draftId ?? null);
      setActiveChannel('meta_ads');
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async (field: string, currentText: string) => {
    setRewritingField(field);
    try {
      const res = await captionEngine.rewriteLine({
        platform: activeChannel, field, currentText, product, offer, audience, tone,
      });
      setOutput(prev => prev ? {
        ...prev,
        [activeChannel]: { ...(prev as any)[activeChannel], [field]: res.text },
      } : prev);
    } catch (err: any) {
      toast({ title: 'Rewrite failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setRewritingField(null);
    }
  };

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const handlePushToAdAccounts = async () => {
    setPushing(true);
    try {
      const launchPrompt = `Launch a campaign for ${product}${offer ? `, offer: ${offer}` : ''}${audience ? `, targeting ${audience}` : ''}`;
      const res = await campaignAgents.launch(launchPrompt);
      toast({ title: 'Campaign launched', description: `Campaign ${res.campaignId} is starting — redirecting to Campaign Agents.` });
      navigate('/campaign-agents');
    } catch (err: any) {
      toast({ title: 'Launch failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setPushing(false);
    }
  };

  const activeContent = output ? (output as any)[activeChannel] : null;

  return (
    <PageTransition>
      <div style={{ background: C.bg, minHeight: '100vh', fontFamily: FONT_BODY, color: C.text }} className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate('/campaign-agents')}
            className="flex items-center gap-1 text-sm mb-6 hover:opacity-80"
            style={{ color: C.muted }}
          >
            <ChevronLeft size={16} /> Back to Campaign Agents
          </button>

          <div className="flex items-center gap-3 mb-2">
            <Wand2 size={26} color={C.purple} />
            <h1 style={{ fontFamily: FONT_HEAD, fontSize: 28 }}>Caption / Copy Engine</h1>
          </div>
          <p style={{ color: C.muted }} className="mb-8 text-sm">
            Generate on-brand ad copy for Meta, Google, TikTok, and LinkedIn from a single brief.
          </p>

          {/* ── 5-field wizard ─────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-5"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <div className="md:col-span-2">
              <label className="text-xs uppercase tracking-wide mb-2 block" style={{ color: C.muted }}>
                1. Product / Service *
              </label>
              <input
                value={product}
                onChange={e => setProduct(e.target.value)}
                placeholder="e.g. A subscription meal-kit delivery service"
                className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.text }}
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide mb-2 block" style={{ color: C.muted }}>
                2. Special Offer / Hook
              </label>
              <input
                value={offer}
                onChange={e => setOffer(e.target.value)}
                placeholder="e.g. 50% off your first box"
                className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.text }}
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide mb-2 block" style={{ color: C.muted }}>
                3. Target Audience
              </label>
              <input
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="e.g. Busy urban professionals, 25-40"
                className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.text }}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs uppercase tracking-wide mb-3 block" style={{ color: C.muted }}>
                4. Tone of Voice
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TONES.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTone(opt.value)}
                    className="text-left rounded-lg px-4 py-3 transition"
                    style={{
                      background: tone === opt.value ? 'rgba(167,139,250,0.12)' : C.raised,
                      border: `1px solid ${tone === opt.value ? C.purple : C.border}`,
                    }}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs mt-1" style={{ color: C.muted }}>{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs uppercase tracking-wide mb-2 block" style={{ color: C.muted }}>
                5. Brand (optional — applies banned words &amp; audience presets)
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.faint }} />
                <select
                  value={brandId}
                  onChange={e => setBrandId(e.target.value)}
                  className="w-full rounded-lg pl-9 pr-4 py-3 text-sm outline-none appearance-none"
                  style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.text }}
                >
                  <option value="">No brand selected</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition disabled:opacity-40"
                style={{ background: C.purple, color: '#0A0A12' }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {loading ? 'Generating…' : 'Generate Ad Copy'}
              </button>
            </div>
          </div>

          {/* ── Multi-channel workspace ────────────────────────────────── */}
          {output && (
            <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex border-b" style={{ borderColor: C.border }}>
                {CHANNELS.map(ch => {
                  const Icon = ch.icon;
                  const isActive = activeChannel === ch.key;
                  return (
                    <button
                      key={ch.key}
                      onClick={() => setActiveChannel(ch.key)}
                      className="flex items-center gap-2 px-5 py-4 text-sm transition"
                      style={{
                        color: isActive ? ch.color : C.muted,
                        borderBottom: isActive ? `2px solid ${ch.color}` : '2px solid transparent',
                        background: isActive ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                    >
                      <Icon size={16} /> {ch.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-6 space-y-4">
                {activeContent && Object.entries(activeContent).map(([field, text]) => (
                  <div key={field} className="rounded-lg p-4" style={{ background: C.raised, border: `1px solid ${C.border}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-wide" style={{ color: C.muted }}>
                        {field.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(field, text as string)}
                          className="p-1.5 rounded hover:opacity-80"
                          style={{ color: C.faint }}
                          title="Copy"
                        >
                          {copiedField === field ? <Check size={14} color={C.green} /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => handleRewrite(field, text as string)}
                          disabled={rewritingField === field}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 disabled:opacity-40"
                          style={{ color: C.blue, border: `1px solid ${C.border}` }}
                        >
                          {rewritingField === field
                            ? <Loader2 size={12} className="animate-spin" />
                            : <RefreshCw size={12} />}
                          Rewrite This Line
                        </button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap" style={{ fontFamily: FONT_MONO }}>{text as string}</p>
                  </div>
                ))}
              </div>

              <div
                className="flex items-center justify-between px-6 py-4 border-t"
                style={{ borderColor: C.border, background: 'rgba(255,255,255,0.015)' }}
              >
                <p className="text-xs" style={{ color: C.muted }}>
                  Happy with the copy? Launch it as a live campaign.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toast({ title: 'Saved', description: 'This draft is already saved.' })}
                    className="text-xs px-3 py-2 rounded-lg hover:opacity-80"
                    style={{ color: C.muted, border: `1px solid ${C.border}` }}
                  >
                    Save as Draft Template
                  </button>
                  <button
                    onClick={handlePushToAdAccounts}
                    disabled={pushing}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-40"
                    style={{ background: C.green, color: '#0A0A12' }}
                  >
                    {pushing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {pushing ? 'Launching…' : 'Push Directly to Ad Accounts'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
