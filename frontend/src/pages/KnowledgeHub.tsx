/**
 * AutoFlowNG — Explore (formerly Knowledge Hub) — Task 1
 *
 * Global AI-powered search using AutoFlowNG's own AI engine with
 * Gemini grounded web-search. Replaces Wikipedia REST API.
 * Route: /knowledge-hub  (path unchanged for backward compat)
 * Label: "Explore" (renamed in AppShell + header)
 */

import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search, Compass, Zap, Book, Briefcase, Music, Play,
  TrendingUp, GraduationCap, Utensils, Shield, MapPin,
  Loader2, ExternalLink, ChevronRight, Globe, Newspaper,
  Sparkles, AlertCircle,
} from "lucide-react";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { aiAPI } from "../lib/api";

// ── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",       label: "All Topics",     icon: Compass,       color: "#00C896", hint: "" },
  { id: "sports",    label: "Sports",         icon: Zap,           color: "#F59E0B", hint: "Focus on sports events, teams, athletes, and records." },
  { id: "food",      label: "Food & Cuisine", icon: Utensils,      color: "#FB7185", hint: "Focus on food, cuisine, recipes, and culinary culture." },
  { id: "jobs",      label: "Jobs & Careers", icon: Briefcase,     color: "#38BDF8", hint: "Focus on employment, career advice, job markets, and skills." },
  { id: "education", label: "Education",      icon: GraduationCap, color: "#A78BFA", hint: "Focus on education, schools, learning, and academic topics." },
  { id: "tech",      label: "Technology",     icon: Zap,           color: "#00C896", hint: "Focus on technology, software, AI, gadgets, and digital trends." },
  { id: "music",     label: "Music",          icon: Music,         color: "#F472B6", hint: "Focus on music, artists, genres, albums, and concerts." },
  { id: "videos",    label: "Film & Video",   icon: Play,          color: "#FF6B6B", hint: "Focus on film, cinema, TV shows, and video content." },
  { id: "business",  label: "Business",       icon: TrendingUp,    color: "#FBBF24", hint: "Focus on business, economics, markets, and entrepreneurship." },
  { id: "history",   label: "History",        icon: Shield,        color: "#94A3B8", hint: "Focus on history, historical events, wars, and civilizations." },
  { id: "countries", label: "Countries",      icon: MapPin,        color: "#34D399", hint: "Focus on countries, geography, cultures, and world affairs." },
];

const FEATURED = [
  { label: "African Tech Startups", cat: "tech",      q: "African technology startups and innovation ecosystem 2024" },
  { label: "Artificial Intelligence", cat: "tech",    q: "Latest developments in artificial intelligence and machine learning" },
  { label: "Global Economy 2024",   cat: "business",  q: "Global economy outlook 2024 GDP growth inflation" },
  { label: "World Cuisine Culture", cat: "food",      q: "World cuisine culture and food traditions" },
  { label: "Space Exploration",     cat: "tech",      q: "Space exploration missions discoveries 2024" },
  { label: "Music Streaming Trends",cat: "music",     q: "Music streaming platforms trends and artists 2024" },
  { label: "African Countries",     cat: "countries", q: "Africa countries economic development demographics" },
  { label: "Football World News",   cat: "sports",    q: "Football soccer world news latest results transfers" },
];

interface SearchResult {
  text: string;
  provider: string;
  sources: Array<{ uri: string; title: string }>;
  grounded: boolean;
  duration_ms: number;
}

// ── Source citation card ──────────────────────────────────────────────────────
function SourceCard({ source, color }: { source: { uri: string; title: string }; color: string }) {
  let hostname = "";
  try { hostname = new URL(source.uri).hostname.replace(/^www\./, ""); } catch {}
  return (
    <a
      href={source.uri}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}22`,
        borderRadius: 8,
        textDecoration: "none",
        fontSize: 11,
        color: "rgba(232,238,255,0.5)",
        fontFamily: "'DM Sans',sans-serif",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
        overflow: "hidden",
        maxWidth: 220,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = color; (e.currentTarget as HTMLElement).style.borderColor = `${color}55`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(232,238,255,0.5)"; (e.currentTarget as HTMLElement).style.borderColor = `${color}22`; }}
    >
      <Globe size={11} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {source.title || hostname || "Source"}
      </span>
      <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.5 }} />
    </a>
  );
}

// ── Markdown-ish text renderer (simple) ──────────────────────────────────────
function MarkdownText({ text, color }: { text: string; color: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: "rgba(232,238,255,0.8)", fontSize: 14, lineHeight: 1.7 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        // H2
        if (line.startsWith("## "))
          return <h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", margin: "18px 0 6px" }}>{line.slice(3)}</h2>;
        // H3
        if (line.startsWith("### "))
          return <h3 key={i} style={{ fontSize: 14, fontWeight: 700, color: color, fontFamily: "'Syne',sans-serif", margin: "12px 0 4px" }}>{line.slice(4)}</h3>;
        // Horizontal rule
        if (line.startsWith("---"))
          return <hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "14px 0" }} />;
        // Bullet
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <span style={{ color, flexShrink: 0, marginTop: 3 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2), color) }} />
            </div>
          );
        // Numbered list
        const numMatch = line.match(/^(\d+)\. (.+)/);
        if (numMatch)
          return (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 4 }}>
              <span style={{ color, fontWeight: 700, flexShrink: 0, minWidth: 20 }}>{numMatch[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(numMatch[2], color) }} />
            </div>
          );
        // Regular paragraph
        return <p key={i} style={{ margin: "0 0 6px" }} dangerouslySetInnerHTML={{ __html: formatInline(line, color) }} />;
      })}
    </div>
  );
}

function formatInline(text: string, color: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:#E8EEFF">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em>$1</em>`)
    .replace(/\`(.+?)\`/g, `<code style="background:rgba(255,255,255,0.07);padding:1px 6px;border-radius:4px;font-family:'DM Mono',monospace;font-size:12px;color:${color}">$1</code>`);
}

// ── Category Pill ─────────────────────────────────────────────────────────────
function CategoryPill({ cat, active, onClick }: { cat: typeof CATEGORIES[0]; active: boolean; onClick: () => void }) {
  const Icon = cat.icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 13px", borderRadius: 100,
        border: active ? `1px solid ${cat.color}` : "1px solid rgba(255,255,255,0.09)",
        background: active ? `${cat.color}18` : "rgba(255,255,255,0.03)",
        color: active ? cat.color : "rgba(232,238,255,0.55)",
        fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace",
        cursor: "pointer", transition: "all 0.15s", textTransform: "uppercase" as const, letterSpacing: "0.04em",
        whiteSpace: "nowrap" as const,
      }}
    >
      <Icon size={12} />
      {cat.label}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KnowledgeHub() {
  const [query,        setQuery]        = useState("");
  const [activeCategory, setCategory]  = useState("all");
  const [result,       setResult]       = useState<SearchResult | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [searched,     setSearched]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCat = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];

  const doSearch = useCallback(async (q: string, catId?: string) => {
    const resolvedCat = catId ?? activeCategory;
    const cat         = CATEGORIES.find(c => c.id === resolvedCat) || CATEGORIES[0];
    const combined    = q.trim();
    if (!combined) return;

    setLoading(true);
    setError(null);
    setSearched(true);
    setResult(null);

    try {
      const data = await aiAPI.globalKnowledge({
        query:    cat.hint ? `${combined} (${cat.hint.toLowerCase().replace(/focus on /, "")})` : combined,
        category: resolvedCat !== "all" ? resolvedCat : undefined,
      });

      setResult({
        text:        data.content?.[0]?.text || data.text || "",
        provider:    data.engine || "ai",
        sources:     data.sources || [],
        grounded:    data.grounded || false,
        duration_ms: data.duration_ms || 0,
      });
    } catch (err: any) {
      setError(err?.message || "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const handleFeatured = (item: typeof FEATURED[0]) => {
    setQuery(item.label);
    const cat = CATEGORIES.find(c => c.id === item.cat);
    if (cat) setCategory(cat.id);
    doSearch(item.q, item.cat);
  };

  const handleCategoryChange = (id: string) => {
    setCategory(id);
    if (query.trim()) doSearch(query, id);
  };

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px 24px", maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={12} />
              EXPLORE — AI-POWERED KNOWLEDGE
            </div>
            <h1 style={{ fontSize: "clamp(1.9rem,4vw,2.8rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", margin: 0, lineHeight: 1.1 }}>
              Explore Anything.<br />
              <span style={{ background: "linear-gradient(135deg,#00C896,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Powered by AutoFlowNG AI.</span>
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.45)", marginTop: 10, lineHeight: 1.6 }}>
              Ask anything — sports, food, jobs, education, tech, music, business, history, countries. AutoFlowNG's AI engine searches the web and synthesises an answer for you.
            </p>
          </div>
        </Reveal>

        {/* Search bar */}
        <Reveal delay={40}>
          <form onSubmit={handleSubmit} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.35)", pointerEvents: "none" }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Ask anything — 'Premier League 2024', 'Nigerian tech hubs', 'AI in Africa'…"
                  style={{ width: "100%", padding: "14px 14px 14px 44px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                  onFocus={e => (e.target.style.borderColor = "#00C896")}
                  onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                style={{ padding: "14px 24px", background: "#00C896", border: "none", borderRadius: 12, color: "#04060F", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", cursor: (loading || !query.trim()) ? "not-allowed" : "pointer", opacity: (loading || !query.trim()) ? 0.6 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}
              >
                {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Thinking…</> : <><Sparkles size={15} /> Explore</>}
              </button>
            </div>
          </form>
        </Reveal>

        {/* Category pills */}
        <Reveal delay={60}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 28 }}>
            {CATEGORIES.map(cat => (
              <CategoryPill key={cat.id} cat={cat} active={activeCategory === cat.id} onClick={() => handleCategoryChange(cat.id)} />
            ))}
          </div>
        </Reveal>

        {/* Featured topics (no search yet) */}
        {!searched && (
          <Reveal delay={80}>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 14, textTransform: "uppercase" as const }}>
                Featured Topics
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
                {FEATURED.map((item, i) => {
                  const cat = CATEGORIES.find(c => c.id === item.cat)!;
                  const Icon = cat.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleFeatured(item)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, color: "#E8EEFF", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${cat.color}10`; (e.currentTarget as HTMLElement).style.borderColor = `${cat.color}33`; (e.currentTarget as HTMLElement).style.color = cat.color; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "#E8EEFF"; }}
                    >
                      <Icon size={15} color={cat.color} style={{ flexShrink: 0 }} />
                      <span>{item.label}</span>
                      <ChevronRight size={13} style={{ marginLeft: "auto", opacity: 0.4 }} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cross-link to News */}
            <div style={{ padding: "16px 20px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#FBBF24", fontFamily: "'Syne',sans-serif", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                  <Newspaper size={14} />
                  Looking for live news?
                </div>
                <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Sans',sans-serif" }}>
                  Check the News feed for real-time industry headlines and stories.
                </div>
              </div>
              <Link to="/news" style={{ background: "#FBBF24", color: "#0d0f1a", padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Go to News
              </Link>
            </div>
          </Reveal>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "14px 18px", background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.25)", borderRadius: 10, color: "#FB7185", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ height: 24, width: "60%", borderRadius: 8, background: "rgba(255,255,255,0.04)", animation: "af-pulse 1.8s ease-in-out infinite" }} />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 16, width: `${90 - i * 5}%`, borderRadius: 6, background: "rgba(255,255,255,0.03)", animation: "af-pulse 1.8s ease-in-out infinite", animationDelay: `${i * 0.08}s` }} />
            ))}
            <div style={{ height: 16, width: "75%", borderRadius: 6, background: "rgba(255,255,255,0.03)", animation: "af-pulse 1.8s ease-in-out infinite" }} />
          </div>
        )}

        {/* Result */}
        {!loading && result && (
          <div>
            {/* Provider badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: result.grounded ? "rgba(0,200,150,0.1)" : "rgba(56,189,248,0.1)", border: `1px solid ${result.grounded ? "rgba(0,200,150,0.3)" : "rgba(56,189,248,0.3)"}`, borderRadius: 100 }}>
                <Sparkles size={10} color={result.grounded ? "#00C896" : "#38BDF8"} />
                <span style={{ fontSize: 10, fontWeight: 700, color: result.grounded ? "#00C896" : "#38BDF8", fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>
                  {result.grounded ? "AI + LIVE WEB SEARCH" : `AI ENGINE · ${result.provider.toUpperCase()}`}
                </span>
              </div>
              {result.duration_ms > 0 && (
                <span style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>
                  {(result.duration_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            {/* Answer */}
            <div style={{ padding: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, marginBottom: 20 }}>
              <MarkdownText text={result.text} color={activeCat.color} />
            </div>

            {/* Sources */}
            {result.sources.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 10, textTransform: "uppercase" as const }}>
                  Sources ({result.sources.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {result.sources.slice(0, 8).map((src, i) => (
                    <SourceCard key={i} source={src} color={activeCat.color} />
                  ))}
                </div>
              </div>
            )}

            {/* Cross-link to News */}
            <div style={{ marginTop: 24, padding: "14px 18px", background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Sans',sans-serif" }}>
                Want live news headlines on this topic?
              </span>
              <Link to="/news" style={{ fontSize: 12, color: "#FBBF24", textDecoration: "none", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <Newspaper size={13} /> News Feed
              </Link>
            </div>
          </div>
        )}

        {/* No result */}
        {!loading && searched && !result && !error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(232,238,255,0.3)" }}>
            <Compass size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontFamily: "'Syne',sans-serif" }}>No results returned</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Try rephrasing your question or selecting a category</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes af-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.9; } }
      `}</style>
    </PageTransition>
  );
}
