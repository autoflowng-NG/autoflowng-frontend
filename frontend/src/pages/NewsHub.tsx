import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { newsAPI } from "../lib/api";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";

const CATEGORY_LABELS: Record<string, string> = {
  top:           "Top Stories",
  world:         "World",
  politics:      "Politics",
  business:      "Business & Finance",
  technology:    "Technology",
  entertainment: "Entertainment",
  sports:        "Sports",
  health:        "Health",
  science:       "Science",
  crime:         "Crime",
};

const SENTIMENT_STYLE: Record<string, { color: string; Icon: any; label: string }> = {
  positive: { color: "#00C896", Icon: TrendingUp,   label: "Positive" },
  negative: { color: "#FB7185", Icon: TrendingDown, label: "Negative" },
  neutral:  { color: "rgba(232,238,255,0.4)", Icon: Minus, label: "Neutral" },
};

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Article {
  id?: number | string;
  article_id?: string;
  title: string;
  description?: string;
  url: string;
  image_url?: string;
  source_name?: string;
  category?: string;
  category_label?: string;
  sentiment?: string | null;
  published_at?: string;
}

export default function NewsHub() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const { data: catData } = useQuery({
    queryKey: ["news", "categories"],
    queryFn: () => newsAPI.categories(),
    staleTime: 5 * 60_000,
  });

  const { data: latestData, isLoading: latestLoading } = useQuery({
    queryKey: ["news", "latest"],
    queryFn: () => newsAPI.latest(40),
    enabled: category === "all" && !query.trim(),
    staleTime: 60_000,
  });

  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ["news", "category", category],
    queryFn: () => newsAPI.byCategory(category, 30),
    enabled: category !== "all" && !query.trim(),
    staleTime: 60_000,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["news", "search", query, category],
    queryFn: () => newsAPI.search(query.trim(), category !== "all" ? category : undefined, 30),
    enabled: !!query.trim(),
    staleTime: 60_000,
  });

  const isLoading = query.trim() ? searchLoading : (category === "all" ? latestLoading : categoryLoading);

  const articles: Article[] = useMemo(() => {
    const source: any = query.trim() ? searchData : (category === "all" ? latestData : categoryData);
    return source?.articles || [];
  }, [query, category, latestData, categoryData, searchData]);

  const categories: string[] = useMemo(() => {
    const list = (catData as any)?.categories || [];
    return list.map((c: any) => c.category).filter(Boolean);
  }, [catData]);

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1280, margin: "0 auto" }}>
        {/* Header */}
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>NEWS &amp; KNOWLEDGE HUB</div>
            <h1 style={{ fontSize: "clamp(2rem,3.5vw,2.8rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", margin: 0 }}>
              News &amp; Knowledge Hub
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.44)", marginTop: 8 }}>
              Live industry news and signals — pulled in real time, ready to power your automations.
            </p>
          </div>
        </Reveal>

        {/* Search + Filter */}
        <Reveal delay={40}>
          <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.3)" }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search news..."
                style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["all", ...categories].map(cat => {
                const active = category === cat;
                return (
                  <button key={cat} onClick={() => setCategory(cat)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", letterSpacing: "0.05em", cursor: "pointer", transition: "all 0.15s", border: active ? "1px solid #00C896" : "1px solid rgba(255,255,255,0.08)", background: active ? "rgba(0,200,150,0.1)" : "rgba(255,255,255,0.03)", color: active ? "#00C896" : "rgba(232,238,255,0.5)", textTransform: "uppercase" }}>
                    {cat === "all" ? "All" : (CATEGORY_LABELS[cat] || cat)}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Grid */}
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 16 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ height: 220, borderRadius: 16, background: "rgba(255,255,255,0.03)", animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : (
          <Stagger>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 16 }}>
              {articles.map((a, i) => {
                const sentiment = a.sentiment ? SENTIMENT_STYLE[a.sentiment.toLowerCase()] : null;
                return (
                  <StaggerItem key={a.article_id || a.id || i} index={i}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "flex", flexDirection: "column", gap: 12, textDecoration: "none", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px", height: "100%", boxSizing: "border-box", transition: "border-color 0.2s, transform 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,200,150,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
                    >
                      {a.image_url ? (
                        <div style={{ width: "100%", height: 140, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
                          <img src={a.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLElement).style.display = "none"; }} />
                        </div>
                      ) : (
                        <div style={{ width: "100%", height: 140, borderRadius: 10, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Newspaper size={28} color="rgba(232,238,255,0.2)" />
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#00C896", background: "rgba(0,200,150,0.12)", borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>
                          {a.category_label || CATEGORY_LABELS[a.category || ""] || a.category || "News"}
                        </span>
                        {sentiment && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700, color: sentiment.color, fontFamily: "'DM Mono',monospace" }}>
                            <sentiment.Icon size={10} /> {sentiment.label}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF", lineHeight: 1.4 }}>
                        {a.title}
                      </div>

                      {a.description && (
                        <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", lineHeight: 1.55, flex: 1 }}>
                          {a.description.length > 140 ? `${a.description.slice(0, 140)}…` : a.description}
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{a.source_name || "Unknown source"}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {a.published_at && (
                            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
                              <Clock size={10} /> {timeAgo(a.published_at)}
                            </span>
                          )}
                          <ExternalLink size={12} color="rgba(232,238,255,0.25)" />
                        </div>
                      </div>
                    </a>
                  </StaggerItem>
                );
              })}
            </div>
          </Stagger>
        )}

        {!isLoading && articles.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(232,238,255,0.3)" }}>
            <Newspaper size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontFamily: "'Syne',sans-serif" }}>No articles available yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>The news feed updates automatically — check back shortly.</div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
