import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Zap, Plug, Globe, Database, MessageSquare, Star, CheckCircle2, ChevronRight, Filter } from "lucide-react";
import { api } from "../lib/api";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";

const CATEGORY_LABELS: Record<string, string> = {
  social:       "Social Media",
  messaging:    "Messaging",
  productivity: "Productivity",
  crm:          "CRM",
  database:     "Databases",
  developer:    "Developer",
  utility:      "Utility",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  social:       Star,
  messaging:    MessageSquare,
  productivity: Zap,
  crm:          Globe,
  database:     Database,
  developer:    Plug,
  utility:      Zap,
};

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  popular:    { label: "POPULAR",    color: "#00C896" },
  enterprise: { label: "ENTERPRISE", color: "#A78BFA" },
  new:        { label: "NEW",        color: "#FBBF24" },
};

export default function Marketplace() {
  const navigate = useNavigate();
  const [query,    setQuery]    = useState("");
  const [category, setCategory] = useState("all");

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ["integrations", "catalog"],
    queryFn: () => (api as any).get("/integrations"),
    staleTime: 5 * 60_000,
  });

  const { data: connsData } = useQuery({
    queryKey: ["connections"],
    queryFn: () => (api as any).get("/connect"),
  });

  const connected = useMemo(() => {
    const list = connsData?.connections || [];
    return new Set(list.map((c: any) => c.platform));
  }, [connsData]);

  const integrations: any[] = useMemo(() => {
    let list = catalogData?.integrations || [];
    if (category !== "all") list = list.filter((i: any) => i.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((i: any) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    return list;
  }, [catalogData, category, query]);

  const categories = useMemo(() => {
    const cats = new Set((catalogData?.integrations || []).map((i: any) => i.category));
    return Array.from(cats) as string[];
  }, [catalogData]);

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1280, margin: "0 auto" }}>
        {/* Header */}
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>PHASE 13 · INTEGRATION ECOSYSTEM</div>
            <h1 style={{ fontSize: "clamp(2rem,3.5vw,2.8rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", margin: 0 }}>
              Automation Marketplace
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.44)", marginTop: 8 }}>
              {catalogData?.total || 0} integrations · connect any API, database, or SaaS platform
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
                placeholder="Search integrations..."
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
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ height: 180, borderRadius: 16, background: "rgba(255,255,255,0.03)", animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : (
          <Stagger>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 16 }}>
              {integrations.map((integ: any, i: number) => {
                const isConnected = connected.has(integ.id);
                const tier = TIER_BADGE[integ.tier];
                return (
                  <StaggerItem key={integ.id} index={i}>
                    <button
                      onClick={() => navigate(`/integrations/${integ.id}`)}
                      style={{ width: "100%", textAlign: "left", background: "rgba(255,255,255,0.03)", border: `1px solid ${isConnected ? "rgba(0,200,150,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius: 16, padding: "20px", cursor: "pointer", position: "relative", overflow: "hidden", transition: "border-color 0.2s, transform 0.15s", display: "flex", flexDirection: "column", gap: 12 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = integ.iconColor + "40"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isConnected ? "rgba(0,200,150,0.2)" : "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
                    >
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${integ.iconColor}88, transparent)` }} />

                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: integ.iconColor + "22", border: `1px solid ${integ.iconColor}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                          <PlatformIcon name={integ.id} color={integ.iconColor} />
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {isConnected && (
                            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700, color: "#00C896", background: "rgba(0,200,150,0.12)", borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace" }}>
                              <CheckCircle2 size={8} /> CONNECTED
                            </span>
                          )}
                          {tier && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: tier.color, background: tier.color + "18", borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace" }}>
                              {tier.label}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF", marginBottom: 4 }}>{integ.name}</div>
                        <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", lineHeight: 1.55 }}>{integ.description}</div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(integ.triggers?.length > 0) && (
                            <span style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "3px 7px", fontFamily: "'DM Mono',monospace" }}>
                              {integ.triggers.length} trigger{integ.triggers.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          {(integ.actions?.length > 0) && (
                            <span style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "3px 7px", fontFamily: "'DM Mono',monospace" }}>
                              {integ.actions.length} action{integ.actions.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <ChevronRight size={14} color="rgba(232,238,255,0.25)" />
                      </div>
                    </button>
                  </StaggerItem>
                );
              })}
            </div>
          </Stagger>
        )}

        {!isLoading && integrations.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(232,238,255,0.3)" }}>
            <Plug size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontFamily: "'Syne',sans-serif" }}>No integrations match your search</div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function PlatformIcon({ name, color }: { name: string; color: string }) {
  const ICONS: Record<string, string> = {
    youtube: "YT", facebook: "FB", instagram: "IG", tiktok: "TK", whatsapp: "WA",
    telegram: "TG", discord: "DC", google_sheets: "GS", google_drive: "GD", gmail: "GM",
    salesforce: "SF", postgresql: "PG", mysql: "MY", mongodb: "MG", redis: "RD",
    webhook: "WH", http_request: "API",
  };
  return <span style={{ fontSize: 11, fontWeight: 900, color, fontFamily: "'DM Mono',monospace" }}>{ICONS[name] || name.slice(0, 2).toUpperCase()}</span>;
}
