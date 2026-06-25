/**
 * Explore (KnowledgeHub) — Enterprise Redesign
 *
 * All API calls, state, search logic, markdown renderer, and category
 * config preserved exactly. Visual layer upgraded:
 *   - Cinematic hero with gradient title
 *   - Glowing search bar with animated border on focus
 *   - Scrollable category pill row
 *   - Featured topics grid with hover glow
 *   - Result card with polished AI answer + source chips
 *   - Loading skeleton matching result layout
 */

import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search, Compass, Zap, Book, Briefcase, Music, Play,
  TrendingUp, GraduationCap, Utensils, Shield, MapPin,
  Loader2, ExternalLink, ChevronRight, Globe, Newspaper,
  Sparkles, AlertCircle, ArrowRight,
} from "lucide-react";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { aiAPI } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:      "#060810",
  surface: "#0C0F1A",
  border:  "rgba(255,255,255,0.06)",
  borderH: "rgba(255,255,255,0.12)",
  text:    "#E2E8FF",
  muted:   "rgba(226,232,255,0.45)",
  faint:   "rgba(226,232,255,0.2)",
  green:   "#00C896",
  blue:    "#38BDF8",
  purple:  "#A78BFA",
  amber:   "#FBBF24",
  red:     "#FB7185",
};

/* ── Categories (preserved exactly) ───────────────────────────────── */
const CATEGORIES = [
  { id: "all",       label: "All Topics",     icon: Compass,       color: C.green,  hint: "" },
  { id: "sports",    label: "Sports",         icon: Zap,           color: "#F59E0B", hint: "Focus on sports events, teams, athletes, and records." },
  { id: "food",      label: "Food & Cuisine", icon: Utensils,      color: C.red,    hint: "Focus on food, cuisine, recipes, and culinary culture." },
  { id: "jobs",      label: "Jobs & Careers", icon: Briefcase,     color: C.blue,   hint: "Focus on employment, career advice, job markets, and skills." },
  { id: "education", label: "Education",      icon: GraduationCap, color: C.purple, hint: "Focus on education, schools, learning, and academic topics." },
  { id: "tech",      label: "Technology",     icon: Zap,           color: C.green,  hint: "Focus on technology, software, AI, gadgets, and digital trends." },
  { id: "music",     label: "Music",          icon: Music,         color: "#F472B6", hint: "Focus on music, artists, genres, albums, and concerts." },
  { id: "videos",    label: "Film & Video",   icon: Play,          color: "#FF6B6B", hint: "Focus on film, cinema, TV shows, and video content." },
  { id: "business",  label: "Business",       icon: TrendingUp,    color: C.amber,  hint: "Focus on business, economics, markets, and entrepreneurship." },
  { id: "history",   label: "History",        icon: Shield,        color: "#94A3B8", hint: "Focus on history, historical events, wars, and civilizations." },
  { id: "countries", label: "Countries",      icon: MapPin,        color: "#34D399", hint: "Focus on countries, geography, cultures, and world affairs." },
];

const FEATURED = [
  { label: "Global Tech Startups",   cat: "tech",      q: "Global technology startups and innovation ecosystem 2024" },
  { label: "Artificial Intelligence",cat: "tech",      q: "Latest developments in artificial intelligence and machine learning" },
  { label: "Global Economy 2024",    cat: "business",  q: "Global economy outlook 2024 GDP growth inflation" },
  { label: "World Cuisine Culture",  cat: "food",      q: "World cuisine culture and food traditions" },
  { label: "Space Exploration",      cat: "tech",      q: "Space exploration missions discoveries 2024" },
  { label: "Music Streaming Trends", cat: "music",     q: "Music streaming platforms trends and artists 2024" },
  { label: "Countries & Cultures",   cat: "countries", q: "Countries cultures economic development demographics world" },
  { label: "Football World News",    cat: "sports",    q: "Football soccer world news latest results transfers" },
];

interface SearchResult {
  text: string;
  provider?: string;
  sources?: Array<{ uri: string; title: string }>;
  grounded?: boolean;
  duration_ms?: number;
}

/* ── Source card (preserved, restyled) ────────────────────────────── */
function SourceCard({ source, color }: { source: { uri: string; title: string }; color: string }) {
  let hostname = "";
  try { hostname = new URL(source.uri).hostname.replace(/^www\./, ""); } catch {}
  return (
    <a
      href={source.uri}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 11px",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}20`,
        borderRadius: 8,
        textDecoration: "none",
        fontSize: 11, color: C.muted,
        fontFamily: "'DM Sans',sans-serif",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
        overflow: "hidden",
        maxWidth: 220,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color = color;
        (e.currentTarget as HTMLElement).style.borderColor = `${color}45`;
        (e.currentTarget as HTMLElement).style.background = `${color}08`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = C.muted;
        (e.currentTarget as HTMLElement).style.borderColor = `${color}20`;
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
      }}
    >
      <Globe size={10} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {source.title || hostname || "Source"}
      </span>
      <ExternalLink size={9} style={{ flexShrink: 0, opacity: 0.4 }} />
    </a>
  );
}

/* ── Markdown renderer (preserved exactly) ─────────────────────────── */
function MarkdownText({ text, color }: { text: string; color: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: "rgba(226,232,255,0.82)", fontSize: 14, lineHeight: 1.75 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        if (line.startsWith("## "))
          return <h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif", margin: "18px 0 6px" }}>{line.slice(3)}</h2>;
        if (line.startsWith("### "))
          return <h3 key={i} style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "'Syne',sans-serif", margin: "12px 0 4px" }}>{line.slice(4)}</h3>;
        if (line.startsWith("#### "))
          return <h4 key={i} style={{ fontSize: 12, fontWeight: 700, color: C.muted, fontFamily: "'DM Mono',monospace", margin: "10px 0 3px", letterSpacing: "0.04em", textTransform: "uppercase" }}>{line.slice(5)}</h4>;
        if (line.startsWith("---"))
          return <hr key={i} style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "14px 0" }} />;
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <span style={{ color, flexShrink: 0, marginTop: 3 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2), color) }} />
            </div>
          );
        const numMatch = line.match(/^(\d+)\. (.+)/);
        if (numMatch)
          return (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 4 }}>
              <span style={{ color, fontWeight: 700, flexShrink: 0, minWidth: 20 }}>{numMatch[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(numMatch[2], color) }} />
            </div>
          );
        return <p key={i} style={{ margin: "0 0 6px" }} dangerouslySetInnerHTML={{ __html: formatInline(line, color) }} />;
      })}
    </div>
  );
}

function formatInline(text: string, color: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:#E2E8FF">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em>$1</em>`)
    .replace(/\`(.+?)\`/g, `<code style="background:rgba(255,255,255,0.07);padding:1px 6px;border-radius:4px;font-family:'DM Mono',monospace;font-size:12px;color:${color}">$1</code>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      `<a href="$2" target="_blank" rel="noopener noreferrer" style="color:${color};text-decoration:underline;opacity:0.85">$1</a>`);
}

/* ── Loading skeleton ──────────────────────────────────────────────── */
function ResultSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <div style={{ height: 22, width: 160, borderRadius: 100, background: "rgba(255,255,255,0.05)", animation: "af-pulse 1.8s ease-in-out infinite" }} />
        <div style={{ height: 22, width: 60,  borderRadius: 100, background: "rgba(255,255,255,0.04)", animation: "af-pulse 1.8s ease-in-out infinite" }} />
      </div>
      <div style={{ padding: 24, background: "rgba(255,255,255,0.025)", border: `1px solid ${C.border}`, borderRadius: 14 }}>
        {[100, 95, 88, 82, 90, 78, 70, 85, 60].map((w, i) => (
          <div key={i} style={{
            height: 14, width: `${w}%`, borderRadius: 4,
            background: "rgba(255,255,255,0.04)",
            marginBottom: 10,
            animation: `af-pulse 1.8s ease-in-out ${i * 0.07}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function KnowledgeHub() {
  const [query,          setQuery]    = useState("");
  const [activeCategory, setCategory] = useState("all");
  const [result,         setResult]   = useState<SearchResult | null>(null);
  const [loading,        setLoading]  = useState(false);
  const [searched,       setSearched] = useState(false);
  const [error,          setError]    = useState<string | null>(null);
  const [focused,        setFocused]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCat = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];

  /* Search logic (preserved exactly) */
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

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doSearch(query); };

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
      <div style={{ padding: "clamp(20px,4vw,40px) clamp(16px,4vw,32px)", maxWidth: 880, margin: "0 auto" }}>

        {/* ── Hero header ── */}
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            {/* Icon */}
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 4, repeat: Infinity }}
              style={{
                width: 60, height: 60, borderRadius: 18, margin: "0 auto 18px",
                background: "rgba(0,200,150,0.08)",
                border: "1px solid rgba(0,200,150,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Compass size={26} color={C.green} />
            </motion.div>

            <div style={{
              fontSize: 10, fontWeight: 700, color: C.green,
              fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em",
              marginBottom: 10,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Sparkles size={11} /> AI-POWERED KNOWLEDGE ENGINE
            </div>

            <h1 style={{
              fontSize: "clamp(1.9rem,5vw,3rem)", fontWeight: 900,
              fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em",
              color: C.text, margin: "0 0 10px", lineHeight: 1.1,
            }}>
              Explore Anything.{" "}
              <span style={{
                background: `linear-gradient(135deg, ${C.green}, ${C.blue})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Powered by AutoFlowNG AI.
              </span>
            </h1>

            <p style={{
              fontSize: 14, color: C.muted, lineHeight: 1.65,
              maxWidth: 560, margin: "0 auto",
              fontFamily: "'DM Sans',sans-serif",
            }}>
              Ask anything — sports, food, jobs, education, tech, music, business, history, countries.
              Our AI engine searches the web and synthesises a grounded answer.
            </p>
          </div>
        </Reveal>

        {/* ── Search bar ── */}
        <Reveal delay={40}>
          <form onSubmit={handleSubmit} style={{ marginBottom: 18 }}>
            <div style={{
              display: "flex", gap: 0,
              background: "rgba(255,255,255,0.03)",
              border: `1.5px solid ${focused ? C.green : C.border}`,
              borderRadius: 14,
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: focused ? `0 0 0 3px ${C.green}18` : "none",
              overflow: "hidden",
            }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={16} style={{
                  position: "absolute", left: 16, top: "50%",
                  transform: "translateY(-50%)",
                  color: focused ? C.green : C.faint,
                  pointerEvents: "none", transition: "color 0.2s",
                }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Ask anything — 'Premier League 2024', 'AI transforming industries', 'Best cuisines in Asia'…"
                  style={{
                    width: "100%", padding: "15px 16px 15px 46px",
                    background: "transparent", border: "none",
                    color: C.text, fontSize: 14,
                    fontFamily: "'DM Sans',sans-serif",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                style={{
                  padding: "15px 24px",
                  background: query.trim() && !loading ? C.green : "rgba(255,255,255,0.05)",
                  border: "none", borderLeft: `1px solid ${C.border}`,
                  color: query.trim() && !loading ? "#04060F" : C.faint,
                  fontSize: 13, fontWeight: 700,
                  fontFamily: "'DM Sans',sans-serif",
                  cursor: (loading || !query.trim()) ? "not-allowed" : "pointer",
                  opacity: (loading || !query.trim()) ? 0.65 : 1,
                  whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 7,
                  transition: "all 0.18s",
                  flexShrink: 0,
                }}
              >
                {loading
                  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Thinking…</>
                  : <><Sparkles size={14} /> Explore</>
                }
              </button>
            </div>
          </form>
        </Reveal>

        {/* ── Category pills ── */}
        <Reveal delay={60}>
          <div style={{
            display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 28,
          }}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.id;
              const Icon   = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 12px", borderRadius: 100,
                    border: active ? `1px solid ${cat.color}55` : `1px solid ${C.border}`,
                    background: active ? `${cat.color}12` : "rgba(255,255,255,0.03)",
                    color: active ? cat.color : C.muted,
                    fontSize: 11, fontWeight: 700,
                    fontFamily: "'DM Mono',monospace",
                    cursor: "pointer", transition: "all 0.15s",
                    whiteSpace: "nowrap", letterSpacing: "0.03em",
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = `${cat.color}08`; (e.currentTarget as HTMLElement).style.color = cat.color; } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.color = C.muted; } }}
                >
                  <Icon size={11} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* ── Featured topics (no search yet) ── */}
        {!searched && (
          <Reveal delay={80}>
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.faint,
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em",
                marginBottom: 14, textTransform: "uppercase",
              }}>
                Featured Topics
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 9,
              }}>
                {FEATURED.map((item, i) => {
                  const cat  = CATEGORIES.find(c => c.id === item.cat)!;
                  const Icon = cat.icon;
                  return (
                    <motion.button
                      key={i}
                      whileHover={{ y: -2 }}
                      onClick={() => handleFeatured(item)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "12px 14px",
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${C.border}`,
                        borderRadius: 11, color: C.text,
                        fontSize: 12.5, fontWeight: 600,
                        fontFamily: "'DM Sans',sans-serif",
                        cursor: "pointer", textAlign: "left",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = `${cat.color}08`;
                        (e.currentTarget as HTMLElement).style.borderColor = `${cat.color}30`;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                        (e.currentTarget as HTMLElement).style.borderColor = C.border;
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: `${cat.color}10`,
                        border: `1px solid ${cat.color}22`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={12} color={cat.color} />
                      </div>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.label}
                      </span>
                      <ChevronRight size={12} color={C.faint} style={{ flexShrink: 0 }} />
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* News cross-link banner */}
            <div style={{
              padding: "14px 18px",
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.18)",
              borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(251,191,36,0.1)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Newspaper size={14} color={C.amber} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, fontFamily: "'Syne',sans-serif" }}>
                    Looking for live news?
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Sans',sans-serif" }}>
                    Check the News feed for real-time industry headlines.
                  </div>
                </div>
              </div>
              <Link
                to="/news"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: C.amber, color: "#0d0f1a",
                  padding: "7px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                Go to News <ArrowRight size={12} />
              </Link>
            </div>
          </Reveal>
        )}

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                padding: "13px 16px",
                background: "rgba(251,113,133,0.08)",
                border: "1px solid rgba(251,113,133,0.22)",
                borderRadius: 10, color: C.red,
                fontSize: 13, marginBottom: 20,
                display: "flex", alignItems: "flex-start", gap: 10,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading skeleton ── */}
        {loading && <ResultSkeleton />}

        {/* ── Result ── */}
        <AnimatePresence>
          {!loading && result && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              {/* Provider + timing badges */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 10px",
                  background: result.grounded ? "rgba(0,200,150,0.08)" : "rgba(56,189,248,0.08)",
                  border: `1px solid ${result.grounded ? "rgba(0,200,150,0.25)" : "rgba(56,189,248,0.25)"}`,
                  borderRadius: 100,
                }}>
                  <Sparkles size={10} color={result.grounded ? C.green : C.blue} />
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: result.grounded ? C.green : C.blue,
                    fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em",
                  }}>
                    {result.grounded ? "AI + LIVE WEB SEARCH" : `AI ENGINE · ${(result.provider || "AI").toUpperCase()}`}
                  </span>
                </div>
                {!!result.duration_ms && result.duration_ms > 0 && (
                  <span style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
                    {(result.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
                <span style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
                  · {activeCat.label.toUpperCase()}
                </span>
              </div>

              {/* AI answer card */}
              <div style={{
                padding: "24px 28px",
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 16, marginBottom: 16,
                position: "relative", overflow: "hidden",
              }}>
                {/* Top accent */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 1,
                  background: `linear-gradient(90deg, transparent, ${activeCat.color}50, transparent)`,
                }} />
                <MarkdownText text={result.text} color={activeCat.color} />
              </div>

              {/* Sources */}
              {result.sources && result.sources.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: C.faint,
                    fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em",
                    marginBottom: 10, textTransform: "uppercase",
                  }}>
                    Sources ({result.sources.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {result.sources.slice(0, 8).map((src, i) => (
                      <SourceCard key={i} source={src} color={activeCat.color} />
                    ))}
                  </div>
                </div>
              )}

              {/* News cross-link */}
              <div style={{
                padding: "12px 16px",
                background: "rgba(251,191,36,0.05)",
                border: "1px solid rgba(251,191,36,0.15)",
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              }}>
                <span style={{ fontSize: 12, color: C.faint, fontFamily: "'DM Sans',sans-serif" }}>
                  Want live news headlines on this topic?
                </span>
                <Link
                  to="/news"
                  style={{
                    fontSize: 12, color: C.amber, textDecoration: "none",
                    fontWeight: 700, display: "flex", alignItems: "center", gap: 5,
                    flexShrink: 0,
                  }}
                >
                  <Newspaper size={12} /> News Feed
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── No result ── */}
        {!loading && searched && !result && !error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: "center", padding: "60px 0" }}
          >
            <Compass size={40} color={C.faint} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontFamily: "'Syne',sans-serif", color: C.muted }}>No results returned</div>
            <div style={{ fontSize: 13, color: C.faint, marginTop: 6, fontFamily: "'DM Sans',sans-serif" }}>
              Try rephrasing your question or selecting a category
            </div>
          </motion.div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes af-pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 0.75; } }
      `}</style>
    </PageTransition>
  );
}
