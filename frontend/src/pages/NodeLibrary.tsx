/**
 * NodeLibrary — Enterprise Redesign
 *
 * All hooks, API calls, mutations, imports, and logic preserved exactly.
 * Visual layer only: design tokens, card wrappers, stat pills, accent lines,
 * grouped integration sections, node rows with hover tint, skeleton loaders.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Zap, MousePointerClick, Copy, Check, Lock } from "lucide-react";
import api from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:      "#060810",
  surface: "#0C0F1A",
  raised:  "#111520",
  border:  "rgba(255,255,255,0.06)",
  text:    "#E2E8FF",
  muted:   "rgba(226,232,255,0.45)",
  faint:   "rgba(226,232,255,0.22)",
  green:   "#00C896",
  blue:    "#38BDF8",
  purple:  "#A78BFA",
  amber:   "#FBBF24",
  red:     "#FB7185",
};

/* ── Skeleton ──────────────────────────────────────────────────────── */
function Sk({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "rgba(255,255,255,0.05)",
      animation: "af-skeleton-pulse 1.8s ease-in-out infinite",
    }} />
  );
}

/* ── Stat pill ─────────────────────────────────────────────────────── */
function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: `${color}10`,
      border: `1px solid ${color}25`,
      borderRadius: 10, padding: "10px 16px",
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}80`, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 2, letterSpacing: "0.04em" }}>{label}</div>
      </div>
    </div>
  );
}

export default function NodeLibrary() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "trigger" | "action">("all");
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["integrations", "nodes"],
    queryFn:  () => (api as any).get("/integrations/nodes"),
    staleTime: 10 * 60_000,
  });

  const nodes: any[] = useMemo(() => {
    let list = data?.nodes || [];
    if (filter !== "all") list = list.filter((n: any) => n.kind === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n: any) =>
        n.label.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        n.integration?.name.toLowerCase().includes(q) ||
        n.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, search, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const n of nodes) {
      const key = n.integration?.name || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [nodes]);

  const copyNodeId = (nodeId: string) => {
    navigator.clipboard.writeText(nodeId).catch(() => {});
    setCopied(nodeId);
    setTimeout(() => setCopied(null), 2000);
  };

  const totalTriggers = (data?.nodes || []).filter((n: any) => n.kind === "trigger").length;
  const totalActions  = (data?.nodes || []).filter((n: any) => n.kind === "action").length;
  const totalIntegrations = new Set((data?.nodes || []).map((n: any) => n.integration?.name)).size;

  const FILTER_TABS = [
    { id: "all",     label: "All Nodes", color: C.purple },
    { id: "trigger", label: "Triggers",  color: C.amber },
    { id: "action",  label: "Actions",   color: C.green },
  ] as const;

  return (
    <PageTransition variant="slide">
      <style>{`
        @keyframes af-skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
      `}</style>

      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto", background: C.bg, minHeight: "100vh" }}>

        {/* ── Page header ── */}
        <Reveal>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>DEVELOPER</div>
            <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: C.text, margin: 0 }}>Node Library</h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Browse triggers, actions, and connectors available across all integrations.</p>
          </div>
        </Reveal>

        {/* ── Stat pills ── */}
        <Reveal delay={40}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
            {isLoading ? (
              <>
                <Sk w={120} h={54} r={10} />
                <Sk w={120} h={54} r={10} />
                <Sk w={120} h={54} r={10} />
              </>
            ) : (
              <>
                <StatPill label="TOTAL NODES"    value={data?.total || 0}   color={C.purple} />
                <StatPill label="TRIGGERS"        value={totalTriggers}      color={C.amber} />
                <StatPill label="ACTIONS"         value={totalActions}       color={C.green} />
                <StatPill label="INTEGRATIONS"    value={totalIntegrations}  color={C.blue} />
              </>
            )}
          </div>
        </Reveal>

        {/* ── Search + filter bar ── */}
        <Reveal delay={60}>
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 24,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.faint }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search nodes, integrations…"
                style={{
                  width: "100%", paddingLeft: 34, paddingRight: 12,
                  paddingTop: 9, paddingBottom: 9,
                  background: C.raised,
                  border: `1px solid ${C.border}`,
                  borderRadius: 9, color: C.text,
                  fontSize: 13, fontFamily: "'DM Sans',sans-serif",
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.18s",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(167,139,250,0.4)"}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 6, background: C.raised, borderRadius: 9, padding: 4 }}>
              {FILTER_TABS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 7,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "'DM Mono',monospace",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    border: "none",
                    background: filter === f.id ? `${f.color}18` : "transparent",
                    color: filter === f.id ? f.color : C.muted,
                    transition: "all 0.15s",
                    letterSpacing: "0.04em",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── Loading skeletons ── */}
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {Array.from({ length: 4 }).map((_, gi) => (
              <div key={gi} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <Sk w={28} h={28} r={8} />
                  <Sk w={100} h={14} r={6} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Array.from({ length: 3 }).map((_, ni) => <Sk key={ni} h={48} r={10} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Grouped node list ── */}
        {!isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {grouped.map(([integName, groupNodes]) => {
              const accentColor = groupNodes[0]?.integration?.iconColor || C.green;
              return (
                <Reveal key={integName}>
                  <div style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 14,
                    overflow: "hidden",
                  }}>
                    {/* Top accent line */}
                    <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}55, transparent)` }} />

                    <div style={{ padding: "16px 18px" }}>
                      {/* Integration header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: `${accentColor}22`,
                          border: `1px solid ${accentColor}33`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 9, fontWeight: 900, color: accentColor, fontFamily: "'DM Mono',monospace" }}>
                            {integName.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif" }}>{integName}</span>
                        <span style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace", background: "rgba(255,255,255,0.04)", borderRadius: 100, padding: "2px 8px", border: `1px solid ${C.border}` }}>
                          {groupNodes.length} node{groupNodes.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Nodes */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {groupNodes.map((node: any) => {
                          const unavailable = node.kind === "action" && node.available === false;
                          const kindColor = node.kind === "trigger" ? C.amber : unavailable ? C.faint : C.green;

                          return (
                            <div
                              key={node.id}
                              title={unavailable ? "This action is not yet available" : undefined}
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "11px 14px",
                                background: unavailable ? "rgba(255,255,255,0.01)" : C.raised,
                                border: `1px solid ${unavailable ? "rgba(255,255,255,0.04)" : C.border}`,
                                borderRadius: 10,
                                opacity: unavailable ? 0.52 : 1,
                                cursor: unavailable ? "not-allowed" : "default",
                                transition: "background 0.15s, border-color 0.15s",
                              }}
                              onMouseEnter={e => { if (!unavailable) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                              onMouseLeave={e => { if (!unavailable) (e.currentTarget as HTMLElement).style.background = C.raised; }}
                            >
                              {/* Kind badge */}
                              <span style={{
                                display: "flex", alignItems: "center", gap: 4,
                                fontSize: 9, fontWeight: 700,
                                fontFamily: "'DM Mono',monospace",
                                padding: "3px 8px", borderRadius: 6, flexShrink: 0,
                                background: `${kindColor}18`,
                                color: kindColor,
                                border: `1px solid ${kindColor}28`,
                                letterSpacing: "0.04em",
                              }}>
                                {node.kind === "trigger"
                                  ? <><MousePointerClick size={9} />TRIGGER</>
                                  : <><Zap size={9} />ACTION</>
                                }
                              </span>

                              {/* Label + description */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: unavailable ? C.muted : C.text, fontFamily: "'DM Sans',sans-serif" }}>{node.label}</div>
                                {node.description && (
                                  <div style={{ fontSize: 11, color: C.faint, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.description}</div>
                                )}
                              </div>

                              {/* Right side — node ID or unavailable badge */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                {unavailable ? (
                                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: C.faint, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px" }}>
                                    <Lock size={8} /> NOT YET AVAILABLE
                                  </span>
                                ) : (
                                  <>
                                    <code style={{ fontSize: 10, color: C.faint, fontFamily: "'DM Mono',monospace", background: "rgba(255,255,255,0.04)", padding: "3px 9px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                                      {node.id}
                                    </code>
                                    <button
                                      onClick={() => copyNodeId(node.id)}
                                      title="Copy node ID"
                                      style={{ background: "none", border: "none", cursor: "pointer", color: C.faint, padding: 4, display: "flex", transition: "color 0.15s" }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.green}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = C.faint}
                                    >
                                      {copied === node.id ? <Check size={12} color={C.green} /> : <Copy size={12} />}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && nodes.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Zap size={26} color={C.faint} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.muted, fontFamily: "'Syne',sans-serif", marginBottom: 6 }}>No nodes found</div>
            <div style={{ fontSize: 13, color: C.faint }}>Try adjusting your search or filter.</div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
