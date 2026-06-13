import { useState } from "react";
import { useAutomations, useToggleAutomation, useRunAutomation, useAutomationLogs } from "../hooks/useWorkflows";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { Zap, Play, ToggleLeft, ToggleRight, Search, Activity, Clock, ChevronDown, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  messaging:   "#00C896", ai:         "#A78BFA", data:       "#38BDF8",
  webhook:     "#FBBF24", scheduling: "#FB7185", integration:"#00C896",
};

function AutomationCard({ am }: { am: any }) {
  const toggleAM = useToggleAutomation();
  const runAM    = useRunAutomation();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const { data: logs = [] } = useAutomationLogs(expanded ? am.template_id : "");

  const cat   = am.category || "integration";
  const color = CATEGORY_COLORS[cat] || "#00C896";

  const handleToggle = () => {
    toggleAM.mutate({ templateId: am.template_id, enabled: !am.enabled }, {
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  };

  const handleRun = () => {
    runAM.mutate(am.template_id, {
      onSuccess: () => toast({ title: "Automation triggered!" }),
      onError:   (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  };

  return (
    <div className="af-glass" data-testid={`automation-card-${am.template_id}`} style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", transition: "border-color 0.2s" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}55, transparent)` }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 26, flexShrink: 0, lineHeight: 1, marginTop: 2 }}>{am.icon || "⚡"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}15`, borderRadius: 100, padding: "2px 8px", fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>{cat.toUpperCase()}</span>
              <span style={{ fontSize: 10, color: am.enabled ? "#00C896" : "rgba(232,238,255,0.25)", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{am.enabled ? "● ACTIVE" : "○ PAUSED"}</span>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF", marginBottom: 4 }}>{am.name}</h3>
            {am.description && <p style={{ fontSize: 12, color: "rgba(232,238,255,0.45)", lineHeight: 1.55 }}>{am.description}</p>}
          </div>
        </div>

        {am.run_count !== undefined && (
          <div style={{ display: "flex", gap: 16, marginBottom: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
              <Activity size={10} /> {am.run_count} runs
            </div>
            {am.last_run && <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
              <Clock size={10} /> {new Date(am.last_run).toLocaleDateString()}
            </div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button data-testid={`toggle-automation-${am.template_id}`} onClick={handleToggle} disabled={toggleAM.isPending} style={{ display: "flex", alignItems: "center", gap: 6, background: am.enabled ? "rgba(251,191,36,0.08)" : "rgba(0,200,150,0.08)", border: `1px solid ${am.enabled ? "rgba(251,191,36,0.2)" : "rgba(0,200,150,0.2)"}`, borderRadius: 8, padding: "6px 12px", color: am.enabled ? "#FBBF24" : "#00C896", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
            {am.enabled ? <><ToggleRight size={13} /> Disable</> : <><ToggleLeft size={13} /> Enable</>}
          </button>
          <button data-testid={`run-automation-${am.template_id}`} onClick={handleRun} disabled={runAM.isPending} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, padding: "6px 12px", color: "#38BDF8", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
            <Play size={12} /> Run
          </button>
          <button onClick={() => setExpanded(e => !e)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "6px 10px", color: "rgba(232,238,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
            Logs <ChevronDown size={12} style={{ transform: expanded ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "14px 20px", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8 }}>EXECUTION LOGS</div>
          {(logs as any[]).length === 0
            ? <div style={{ fontSize: 12, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Mono',monospace" }}>No logs yet.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(logs as any[]).slice(0, 8).map((l: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                    <span style={{ color: l.status === "success" ? "#00C896" : l.status === "failed" ? "#FB7185" : "#94A3B8" }}>
                      {l.status === "success" ? "✓" : l.status === "failed" ? "✗" : "○"}
                    </span>
                    <span style={{ color: "rgba(232,238,255,0.5)", flexShrink: 0 }}>{l.created_at ? new Date(l.created_at).toLocaleTimeString() : ""}</span>
                    <span style={{ color: "rgba(232,238,255,0.7)" }}>{l.message || l.output || "Completed"}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  );
}

export default function Automations() {
  const { data: automations = [], isLoading } = useAutomations();
  const [search, setSearch] = useState("");

  const filtered = (automations as any[]).filter((a: any) =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.category?.toLowerCase().includes(search.toLowerCase())
  );

  const active = filtered.filter((a: any) => a.enabled).length;

  return (
    <PageTransition variant="slide">
    <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto" }}>
      <Reveal>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#38BDF8", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>AUTOMATION ENGINE</div>
          <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>Automations</h1>
          <p style={{ fontSize: 14, color: "rgba(232,238,255,0.4)", marginTop: 4 }}>{filtered.length} automations · {active} active</p>
        </div>
      </Reveal>

      <Reveal delay={40}>
        <div style={{ position: "relative", marginBottom: 24 }}>
          <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.3)", pointerEvents: "none" }} />
          <input data-testid="input-search" type="search" placeholder="Search automations…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px 12px 40px", color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
        </div>
      </Reveal>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="af-glass af-shimmer" style={{ borderRadius: 16, height: 180 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Reveal>
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <Zap size={40} color="rgba(56,189,248,0.2)" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "rgba(232,238,255,0.3)" }}>{search ? "No automations match" : "No automations yet"}</div>
          </div>
        </Reveal>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {filtered.map((am: any, i: number) => (
            <Reveal key={am.template_id || i} delay={i * 30}>
              <div style={{ position: "relative" }}>
                <AutomationCard am={am} />
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
    </PageTransition>
  );
}
