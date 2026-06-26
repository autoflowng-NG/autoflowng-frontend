import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useWorkflow, useUpdateWorkflow, useTriggerWorkflow, useWorkflowRuns } from "../hooks/useWorkflows";
import { workflowsAPI } from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Play, Plus, Trash2, Settings2, ChevronDown, ChevronRight, Activity, Clock, CheckCircle2, XCircle, RefreshCw, Zap, GitBranch, Bot, Bell, Globe, Filter, Code, Database } from "lucide-react";

interface WorkflowBuilderProps { id: string; }

const NODE_TYPES = [
  { type: "trigger",   label: "Trigger",    icon: Zap,          color: "#00C896" },
  { type: "action",    label: "Action",      icon: Play,         color: "#38BDF8" },
  { type: "condition", label: "Condition",   icon: GitBranch,    color: "#FBBF24" },
  { type: "ai",        label: "AI Step",     icon: Bot,          color: "#A78BFA" },
  { type: "notify",    label: "Notify",      icon: Bell,         color: "#FB7185" },
  { type: "webhook",   label: "Webhook",     icon: Globe,        color: "#38BDF8" },
  { type: "filter",    label: "Filter",      icon: Filter,       color: "#FBBF24" },
  { type: "code",      label: "Code",        icon: Code,         color: "#A78BFA" },
  { type: "database",  label: "Database",    icon: Database,     color: "#00C896" },
];

interface Node { id: string; type: string; label: string; x: number; y: number; config?: any; }
interface Edge { from: string; to: string; id: string; }

function NodeBox({ node, selected, onSelect, onDelete }: { node: Node; selected: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void; }) {
  const nt = NODE_TYPES.find(n => n.type === node.type) || NODE_TYPES[1];
  const Icon = nt.icon;
  return (
    <div
      data-testid={`node-${node.id}`}
      onClick={() => onSelect(node.id)}
      style={{
        position: "absolute", left: node.x, top: node.y,
        width: 140, background: "rgba(8,11,22,0.95)",
        border: `1.5px solid ${selected ? nt.color : "rgba(255,255,255,0.09)"}`,
        borderRadius: 12, padding: "12px 14px", cursor: "pointer", userSelect: "none",
        boxShadow: selected ? `0 0 20px ${nt.color}30` : undefined,
        transition: "border-color 0.18s, box-shadow 0.18s",
        zIndex: selected ? 10 : 1,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "12px 12px 0 0", background: `linear-gradient(90deg, transparent, ${nt.color}88, transparent)` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${nt.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={13} color={nt.color} />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: nt.color, fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>{nt.label.toUpperCase()}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#E8EEFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{node.label}</div>
        </div>
      </div>
      {/* Connectors */}
      <div style={{ position: "absolute", top: "50%", left: -5, width: 10, height: 10, borderRadius: "50%", background: "#04060F", border: `2px solid ${nt.color}60`, transform: "translateY(-50%)" }} />
      <div style={{ position: "absolute", top: "50%", right: -5, width: 10, height: 10, borderRadius: "50%", background: nt.color, border: `2px solid ${nt.color}`, transform: "translateY(-50%)" }} />
      {selected && (
        <button onClick={e => { e.stopPropagation(); onDelete(node.id); }} style={{ position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: "50%", background: "#FB7185", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 20 }}>
          <Trash2 size={10} color="white" />
        </button>
      )}
    </div>
  );
}

function RunsPanel({ workflowId }: { workflowId: string }) {
  const { data: runs = [], isLoading } = useWorkflowRuns(workflowId);
  const STATUS_ICON: Record<string, any> = {
    success: <CheckCircle2 size={13} color="#00C896" />,
    failed:  <XCircle size={13} color="#FB7185" />,
    running: <RefreshCw size={13} color="#38BDF8" style={{ animation: "spin-slow 1s linear infinite" }} />,
    pending: <Clock size={13} color="#FBBF24" />,
  };
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 12 }}>EXECUTION HISTORY</div>
      {isLoading ? <div className="af-shimmer" style={{ height: 120, borderRadius: 8 }} /> :
       runs.length === 0 ? <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(232,238,255,0.2)", fontSize: 12 }}>No runs yet</div> :
       <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
         {(runs as any[]).slice(0, 12).map((r: any) => (
           <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
             {STATUS_ICON[r.status] || STATUS_ICON.pending}
             <div style={{ flex: 1, minWidth: 0 }}>
               <div style={{ fontSize: 11, color: "#E8EEFF", fontFamily: "'DM Mono',monospace" }}>Run #{r.id?.slice?.(-6) || r.id}</div>
               {r.duration && <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)" }}>{r.duration}ms</div>}
             </div>
             <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>
               {r.created_at ? new Date(r.created_at).toLocaleTimeString() : ""}
             </div>
           </div>
         ))}
       </div>
      }
    </div>
  );
}

export default function WorkflowBuilder({ id }: WorkflowBuilderProps) {
  const [, nav] = useLocation();
  const { data, isLoading } = useWorkflow(id);
  const updateWF   = useUpdateWorkflow(id);
  const triggerWF  = useTriggerWorkflow();
  const { toast }  = useToast();

  const [nodes, setNodes]   = useState<Node[]>([]);
  const [edges, setEdges]   = useState<Edge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName]     = useState("Workflow");
  const [tab, setTab]       = useState<"canvas"|"runs"|"config">("canvas");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOff, setDragOff]   = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  let nextId = useRef(1);

  useEffect(() => {
    if (!data) return;
    setName((data as any).name || "Workflow");
    const ns = (data as any).nodes || [];
    const es = (data as any).edges || [];
    setNodes(ns.map((n: any, i: number) => ({ id: n.id || `n${i}`, type: n.type || "action", label: n.label || n.name || "Node", x: n.x ?? 80 + i * 180, y: n.y ?? 150, config: n.config || {} })));
    setEdges(es.map((e: any, i: number) => ({ id: `e${i}`, from: e.from || e.source, to: e.to || e.target })));
  }, [data]);

  const addNode = (type: string) => {
    const nt = NODE_TYPES.find(n => n.type === type)!;
    // Place new nodes in a visible column starting at x=20, stacked vertically
    // so they never overflow off the right edge on mobile
    const existingCount = nodes.length;
    const col = Math.floor(existingCount / 4);
    const row = existingCount % 4;
    const newNode: Node = {
      id: `n${nextId.current++}`,
      type,
      label: nt.label,
      x: 20 + col * 170,  // start at 20px from left, step right per column
      y: 30 + row * 90,   // stack vertically with 90px gap
      config: {},
    };
    setNodes(ns => [...ns, newNode]);
  };

  const deleteNode = (nodeId: string) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId));
    setEdges(es => es.filter(e => e.from !== nodeId && e.to !== nodeId));
    if (selected === nodeId) setSelected(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateWF.mutateAsync({ name, nodes, edges });
      toast({ title: "Saved!", description: "Workflow updated." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const trigger = async () => {
    try {
      await triggerWF.mutateAsync({ id });
      toast({ title: "Workflow triggered!", description: "Execution started." });
      setTab("runs");
    } catch (e: any) {
      toast({ title: "Trigger failed", description: e?.message, variant: "destructive" });
    }
  };

  const onMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelected(nodeId);
    const node = nodes.find(n => n.id === nodeId)!;
    setDragging(nodeId);
    setDragOff({ x: e.clientX - node.x, y: e.clientY - node.y });
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    setNodes(ns => ns.map(n => n.id === dragging ? { ...n, x: e.clientX - dragOff.x, y: e.clientY - dragOff.y } : n));
  }, [dragging, dragOff]);

  const onMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const selNode = nodes.find(n => n.id === selected);

  if (isLoading) return (
    <div style={{ height: "100vh", background: "#04060F", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="af-loader" />
    </div>
  );

  return (
    <PageTransition variant="push" speed="snappy">
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#04060F", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ height: 56, background: "rgba(8,11,22,0.97)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, padding: "0 16px", flexShrink: 0, zIndex: 20 }}>
        <button onClick={() => nav("/workflows")} data-testid="button-back" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(232,238,255,0.5)", cursor: "pointer", fontSize: 13, padding: "6px 10px", borderRadius: 8, fontFamily: "'DM Sans',sans-serif" }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />
        <input value={name} onChange={e => setName(e.target.value)} data-testid="input-workflow-name" style={{ flex: 1, background: "none", border: "none", color: "#E8EEFF", fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", outline: "none" }} />
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {["canvas","runs","config"].map(t => (
            <button key={t} onClick={() => setTab(t as any)} style={{ background: tab === t ? "rgba(0,200,150,0.1)" : "transparent", border: `1px solid ${tab === t ? "rgba(0,200,150,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 8, padding: "5px 12px", color: tab === t ? "#00C896" : "rgba(232,238,255,0.4)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />
        <button onClick={trigger} disabled={triggerWF.isPending} data-testid="button-trigger" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 8, padding: "6px 14px", color: "#38BDF8", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          <Zap size={13} /> Run
        </button>
        <button onClick={save} disabled={saving} data-testid="button-save" style={{ display: "flex", alignItems: "center", gap: 6, background: "#00C896", border: "none", borderRadius: 8, padding: "6px 16px", color: "#04060F", fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          <Save size={13} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left panel: node types */}
        {tab === "canvas" && (
          <div style={{ width: 200, background: "rgba(8,11,22,0.97)", borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: "12px 8px", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 10, padding: "0 6px" }}>ADD NODES</div>
            {NODE_TYPES.map(nt => {
              const Icon = nt.icon;
              return (
                <button key={nt.type} data-testid={`add-node-${nt.type}`} onClick={() => addNode(nt.type)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", marginBottom: 4, color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${nt.color}12`; (e.currentTarget as HTMLElement).style.borderColor = `${nt.color}30`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)"; }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: `${nt.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={12} color={nt.color} />
                  </div>
                  {nt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Canvas */}
        {tab === "canvas" && (
          <div ref={canvasRef} onClick={() => setSelected(null)} style={{ flex: 1, position: "relative", overflow: "hidden", background: `radial-gradient(ellipse at 50% 50%, rgba(0,200,150,0.03) 0%, transparent 70%), repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.02) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.02) 40px)` }}>
            {nodes.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <GitBranch size={48} color="rgba(0,200,150,0.15)" style={{ marginBottom: 16 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(232,238,255,0.2)", fontFamily: "'Syne',sans-serif" }}>Add nodes from the left panel</div>
                <div style={{ fontSize: 13, color: "rgba(232,238,255,0.1)", marginTop: 6 }}>Drag to reposition · Click to select</div>
              </div>
            )}
            {/* SVG edges */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
              {edges.map(e => {
                const fn = nodes.find(n => n.id === e.from);
                const tn = nodes.find(n => n.id === e.to);
                if (!fn || !tn) return null;
                const x1 = fn.x + 140, y1 = fn.y + 36;
                const x2 = tn.x, y2 = tn.y + 36;
                const mx = (x1 + x2) / 2;
                return (
                  <g key={e.id}>
                    <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="rgba(0,200,150,0.3)" strokeWidth="1.5" strokeDasharray="6 4" fill="none" />
                  </g>
                );
              })}
            </svg>
            {nodes.map(n => (
              <div key={n.id} style={{ position: "absolute", left: n.x, top: n.y }} onMouseDown={e => onMouseDown(e, n.id)}>
                <NodeBox node={n} selected={selected === n.id} onSelect={setSelected} onDelete={deleteNode} />
              </div>
            ))}
          </div>
        )}

        {/* Runs tab */}
        {tab === "runs" && <div style={{ flex: 1, overflowY: "auto" }}><RunsPanel workflowId={id} /></div>}

        {/* Config tab */}
        {tab === "config" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <div className="af-glass" style={{ borderRadius: 16, padding: "24px", maxWidth: 600 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 20 }}>Workflow Settings</div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8 }}>NAME</label>
                <input value={name} onChange={e => setName(e.target.value)} data-testid="input-config-name" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 14px", color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 12 }}>STATISTICS</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[{ label: "Total Nodes", val: nodes.length }, { label: "Connections", val: edges.length }, { label: "Trigger", val: (data as any)?.trigger_type || "Manual" }, { label: "Status", val: (data as any)?.is_active ? "Active" : "Paused" }].map(s => (
                    <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace" }}>{s.val}</div>
                      <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 8, background: "#00C896", border: "none", borderRadius: 10, padding: "10px 20px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* Right panel: node config */}
        {tab === "canvas" && selected && selNode && (
          <div style={{ width: 240, background: "rgba(8,11,22,0.97)", borderLeft: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: "16px", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 12 }}>NODE CONFIG</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Label</label>
              <input data-testid="input-node-label" value={selNode.label} onChange={e => setNodes(ns => ns.map(n => n.id === selected ? { ...n, label: e.target.value } : n))} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "8px 10px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Type</label>
              <div style={{ fontSize: 12, color: "#00C896", fontFamily: "'DM Mono',monospace", background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 8, padding: "6px 10px" }}>{selNode.type.toUpperCase()}</div>
            </div>
            <button onClick={() => deleteNode(selected)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 8, padding: "8px", color: "#FB7185", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: 8 }}>
              <Trash2 size={12} /> Delete Node
            </button>
          </div>
        )}
      </div>
    </div>
    </PageTransition>
  );
}
