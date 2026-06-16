/**
 * AutoFlowNG — Knowledge Hub
 * Global search across Sports, Food, Jobs, Schools, Education, Tech,
 * Music, Videos, Business, Wars, and Country Information.
 * Uses the Wikipedia REST API (free, no key required).
 */

import { useState, useCallback } from "react";
import { Search, Globe, Zap, Book, Briefcase, Music, Play, TrendingUp, GraduationCap, Utensils, Shield, MapPin, Loader2, ExternalLink, ChevronRight } from "lucide-react";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";

// ── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",       label: "All Topics",  icon: Globe,        color: "#00C896", query: "" },
  { id: "sports",    label: "Sports",      icon: Zap,          color: "#F59E0B", query: "sport" },
  { id: "food",      label: "Food",        icon: Utensils,     color: "#FB7185", query: "food cuisine" },
  { id: "jobs",      label: "Jobs",        icon: Briefcase,    color: "#38BDF8", query: "employment career" },
  { id: "education", label: "Education",   icon: GraduationCap,color: "#A78BFA", query: "education school" },
  { id: "tech",      label: "Technology",  icon: Zap,          color: "#00C896", query: "technology software" },
  { id: "music",     label: "Music",       icon: Music,        color: "#F472B6", query: "music" },
  { id: "videos",    label: "Videos",      icon: Play,         color: "#FF6B6B", query: "film cinema video" },
  { id: "business",  label: "Business",    icon: TrendingUp,   color: "#FBBF24", query: "business economics" },
  { id: "wars",      label: "History & Wars", icon: Shield,    color: "#94A3B8", query: "war history conflict" },
  { id: "countries", label: "Countries",   icon: MapPin,       color: "#34D399", query: "country nation" },
];

interface WikiResult {
  pageid:    number;
  title:     string;
  snippet:   string;
  wordcount: number;
}

interface FullResult extends WikiResult {
  thumbnail?: string;
  description?: string;
}

// ── Fetch from Wikipedia API ─────────────────────────────────────────────────
async function searchWikipedia(query: string): Promise<FullResult[]> {
  if (!query.trim()) return [];
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=20&srinfo=totalhits&srprop=snippet|wordcount`;
  const res = await fetch(url);
  const json = await res.json();
  const results: WikiResult[] = json?.query?.search || [];

  // Fetch thumbnails for top 8
  const top = results.slice(0, 8);
  const thumbUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${top.map(r => r.pageid).join("|")}&prop=pageimages|description&pithumbsize=120&format=json&origin=*`;
  const thumbRes = await fetch(thumbUrl);
  const thumbJson = await thumbRes.json();
  const pages = thumbJson?.query?.pages || {};

  return results.map(r => {
    const page = pages[r.pageid];
    return {
      ...r,
      thumbnail:   page?.thumbnail?.source,
      description: page?.description,
    };
  });
}

// ── Strip HTML tags from snippet ─────────────────────────────────────────────
function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "");
}

// ── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({ result, color }: { result: FullResult; color: string }) {
  const wikiLink = `https://en.wikipedia.org/?curid=${result.pageid}`;
  return (
    <a
      href={wikiLink}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex", gap: 14, padding: "16px 18px",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, textDecoration: "none", transition: "all 0.16s",
        cursor: "pointer", alignItems: "flex-start",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = `${color}33`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
    >
      {result.thumbnail ? (
        <img src={result.thumbnail} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
      ) : (
        <div style={{ width: 72, height: 72, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Globe size={24} color={color} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", lineHeight: 1.3 }}>{result.title}</span>
          <ExternalLink size={13} color="rgba(232,238,255,0.3)" style={{ flexShrink: 0, marginTop: 2 }} />
        </div>
        {result.description && (
          <p style={{ fontSize: 11, color: color, fontFamily: "'DM Mono',monospace", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{result.description}</p>
        )}
        <p style={{ fontSize: 13, color: "rgba(232,238,255,0.5)", lineHeight: 1.55, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any }}>
          {stripHtml(result.snippet)}
        </p>
      </div>
    </a>
  );
}

// ── Category Pill ────────────────────────────────────────────────────────────
function CategoryPill({ cat, active, onClick }: { cat: typeof CATEGORIES[0]; active: boolean; onClick: () => void }) {
  const Icon = cat.icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 14px", borderRadius: 100,
        border: active ? `1px solid ${cat.color}` : "1px solid rgba(255,255,255,0.09)",
        background: active ? `${cat.color}18` : "rgba(255,255,255,0.03)",
        color: active ? cat.color : "rgba(232,238,255,0.55)",
        fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace",
        cursor: "pointer", transition: "all 0.15s", textTransform: "uppercase", letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={13} />
      {cat.label}
    </button>
  );
}

// ── Featured Topics ──────────────────────────────────────────────────────────
const FEATURED = [
  { label: "2024 Olympics",     cat: "sports",    q: "2024 Summer Olympics Paris" },
  { label: "Artificial Intelligence", cat: "tech", q: "Artificial intelligence" },
  { label: "World Economies",   cat: "business",  q: "World economy GDP countries" },
  { label: "Food Culture",      cat: "food",      q: "World cuisine culture" },
  { label: "Space Exploration", cat: "tech",      q: "Space exploration NASA" },
  { label: "Music Genres",      cat: "music",     q: "Music genres history" },
  { label: "African Countries", cat: "countries", q: "Africa countries nations" },
  { label: "World Wars History",cat: "wars",      q: "World War history" },
];

// ── Main Page ────────────────────────────────────────────────────────────────
export default function KnowledgeHub() {
  const [query,       setQuery]       = useState("");
  const [activeCategory, setCategory] = useState("all");
  const [results,     setResults]     = useState<FullResult[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [searched,    setSearched]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const activeCat = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];

  const doSearch = useCallback(async (q: string) => {
    const combined = activeCat.query ? `${q} ${activeCat.query}`.trim() : q;
    if (!combined.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await searchWikipedia(combined);
      setResults(data);
    } catch {
      setError("Search failed. Please check your connection and try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [activeCat]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const handleFeatured = (item: typeof FEATURED[0]) => {
    setQuery(item.label);
    const cat = CATEGORIES.find(c => c.id === item.cat);
    if (cat) setCategory(cat.id);
    doSearch(item.q);
  };

  const handleCategoryChange = (id: string) => {
    setCategory(id);
    if (query.trim() || searched) {
      const cat = CATEGORIES.find(c => c.id === id)!;
      const combined = cat.query ? `${query} ${cat.query}`.trim() : query || cat.label;
      setLoading(true);
      setError(null);
      searchWikipedia(combined).then(setResults).catch(() => setError("Search failed.")).finally(() => setLoading(false));
    }
  };

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>KNOWLEDGE HUB</div>
            <h1 style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", margin: 0, lineHeight: 1.1 }}>
              Search the World's<br />
              <span style={{ background: "linear-gradient(135deg,#00C896,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Knowledge</span>
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.45)", marginTop: 10 }}>
              Search globally about sports, food, jobs, education, tech, music, business, history, and countries.
            </p>
          </div>
        </Reveal>

        {/* Search bar */}
        <Reveal delay={40}>
          <form onSubmit={handleSubmit} style={{ marginBottom: 20, position: "relative" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.35)", pointerEvents: "none" }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search anything — 'Premier League', 'Nigerian cuisine', 'AI startups'…"
                  style={{ width: "100%", padding: "14px 14px 14px 42px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                  onFocus={e => (e.target.style.borderColor = "#00C896")}
                  onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: "14px 24px", background: "#00C896", border: "none", borderRadius: 12, color: "#04060F", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}
              >
                {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Searching…</> : <><Search size={15} /> Search</>}
              </button>
            </div>
          </form>
        </Reveal>

        {/* Category pills */}
        <Reveal delay={60}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            {CATEGORIES.map(cat => (
              <CategoryPill key={cat.id} cat={cat} active={activeCategory === cat.id} onClick={() => handleCategoryChange(cat.id)} />
            ))}
          </div>
        </Reveal>

        {/* Featured topics (shown when no search) */}
        {!searched && (
          <Reveal delay={80}>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 14, textTransform: "uppercase" }}>Featured Topics</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
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
          </Reveal>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "14px 18px", background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.25)", borderRadius: 10, color: "#FB7185", fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 106, borderRadius: 14, background: "rgba(255,255,255,0.03)", animation: "af-skeleton-pulse 1.8s ease-in-out infinite" }} />
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && searched && results.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 14, textTransform: "uppercase" }}>
              {results.length} results · Wikipedia
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map(r => (
                <ResultCard key={r.pageid} result={r} color={activeCat.color} />
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(232,238,255,0.3)" }}>
            <Globe size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontFamily: "'Syne',sans-serif" }}>No results found</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Try different keywords or select a category</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes af-skeleton-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
    </PageTransition>
  );
}
