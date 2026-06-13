import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Zap, MousePointerClick, ChevronRight, Copy, Check } from "lucide-react";
import { api } from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";

export default function NodeLibrary() {
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState<"all" | "trigger" | "action">("all");
  const [copied, setCopied]       = useState<string | null>(null);
  const { toast }                 = useToast();

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

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        <Reveal>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>PHASE 13 · INTEGRATION ECOSYSTEM</div>
            <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", margin: 0 }}>Node Library</h1>
            <p style={{ fontSize: 13, color: "rgba(232,238,255,0.4)", marginTop: 6 }}>
              {data?.total || 0} nodes across all integrations — triggers, actions, and connectors
            </p>
          </div>
        </Reveal>

        <Reveal delay={40}>
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.3)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes..." style={{ width: "100%", paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
            </div>
            {(["all", "trigger", "action"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", cursor: "pointer", border: filter === f ? "1px solid #00C896" : "1px solid rgba(255,255,255,0.08)", background: filter === f ? "rgba(0,200,150,0.1)" : "rgba(255,255,255,0.03)", color: filter === f ? "#00C896" : "rgba(232,238,255,0.45)" }}>
                {f === "all" ? "All Nodes" : f === "trigger" ? "Triggers" : "Actions"}
              </button>
            ))}
          </div>
        </Reveal>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 56, borderRadius: 10, background: "rgba(255,255,255,0.03)" }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {grouped.map(([integName, groupNodes]) => (
              <Reveal key={integName}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: (groupNodes[0]?.integration?.iconColor || "#00C896") + "33", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: groupNodes[0]?.integration?.iconColor || "#00C896", fontFamily: "'DM Mono',monospace" }}>{integName.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,238,255,0.6)", fontFamily: "'Syne',sans-serif" }}>{integName}</span>
                    <span style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>{groupNodes.length} node{groupNodes.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {groupNodes.map((node: any) => (
                      <div key={node.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, transition: "border-color 0.15s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"}
                      >
                        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono',monospace", padding: "2px 7px", borderRadius: 5, flexShrink: 0, background: node.kind === "trigger" ? "rgba(251,191,36,0.12)" : "rgba(0,200,150,0.1)", color: node.kind === "trigger" ? "#FBBF24" : "#00C896" }}>
                          {node.kind === "trigger" ? <><MousePointerClick style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} size={9} />TRIGGER</> : <><Zap style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} size={9} />ACTION</>}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF" }}>{node.label}</div>
                          <div style={{ fontSize: 11, color: "rgba(232,238,255,0.32)", marginTop: 1 }}>{node.description}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <code style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 5 }}>{node.id}</code>
                          <button onClick={() => copyNodeId(node.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(232,238,255,0.3)", padding: 4 }}>
                            {copied === node.id ? <Check size={11} color="#00C896" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {!isLoading && nodes.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(232,238,255,0.25)" }}>
            <Zap size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>No nodes match your search</div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
