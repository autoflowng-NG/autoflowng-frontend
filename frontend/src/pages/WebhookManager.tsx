import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Webhook, Copy, Check, RefreshCw, Play, ArrowRight, Clock, Eye, Loader2 } from "lucide-react";
import api from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";

export default function WebhookManager() {
  const qc             = useQueryClient();
  const { toast }      = useToast();
  const [copied, setCopied]       = useState<string | null>(null);
  const [testUrl, setTestUrl]     = useState("");
  const [testBody, setTestBody]   = useState('{"event":"test","source":"AutoFlowNG"}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<Record<string, any[]>>({});
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn:  () => (api as any).get("/webhooks"),
  });

  const replayMut = useMutation({
    mutationFn: (deliveryId: string) => (api as any).post(`/webhooks/replay/${deliveryId}`),
    onSuccess: () => toast({ title: "Webhook replayed" }),
    onError: (e: any) => toast({ title: "Replay failed", description: e?.message, variant: "destructive" }),
  });

  const rotateMut = useMutation({
    mutationFn: (workflowId: number) => (api as any).post("/webhooks/generate", { workflowId }),
    onSuccess: () => { toast({ title: "Webhook key rotated" }); qc.invalidateQueries({ queryKey: ["webhooks"] }); },
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTest = async () => {
    if (!testUrl.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      let body;
      try { body = JSON.parse(testBody); } catch { body = testBody; }
      const r = await (api as any).post("/webhooks/test", { url: testUrl, body });
      setTestResult(r);
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.message });
    } finally {
      setTestLoading(false);
    }
  };

  const loadDeliveries = async (workflowId: number) => {
    const key = String(workflowId);
    setLoadingDeliveries(key);
    try {
      const r = await (api as any).get(`/webhooks/deliveries/${workflowId}`);
      setDeliveries(d => ({ ...d, [key]: r.deliveries || [] }));
    } catch { }
    setLoadingDeliveries(null);
  };

  const webhooks: any[] = data?.webhooks || [];
  const inp: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "10px 12px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',monospace", outline: "none", boxSizing: "border-box" };

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        <Reveal>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", margin: 0 }}>Webhook Manager</h1>
            <p style={{ fontSize: 13, color: "rgba(232,238,255,0.4)", marginTop: 6 }}>Inbound triggers · HMAC validation · Delivery history · Replay</p>
          </div>
        </Reveal>

        {/* Webhook tester */}
        <Reveal delay={40}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 22, marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", marginBottom: 16, fontFamily: "'Syne',sans-serif" }}>Outbound Webhook Tester</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", marginBottom: 5 }}>Target URL</label>
                <input value={testUrl} onChange={e => setTestUrl(e.target.value)} placeholder="https://your-endpoint.com/webhook" style={inp} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", marginBottom: 5 }}>Payload (JSON)</label>
                <textarea value={testBody} onChange={e => setTestBody(e.target.value)} rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
              </div>
            </div>
            <button onClick={handleTest} disabled={testLoading || !testUrl.trim()} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.25)", borderRadius: 9, color: "#00C896", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {testLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Send Test
            </button>
            {testResult && (
              <div style={{ marginTop: 14, padding: "12px 16px", background: testResult.ok ? "rgba(0,200,150,0.07)" : "rgba(251,113,133,0.07)", border: `1px solid ${testResult.ok ? "rgba(0,200,150,0.2)" : "rgba(251,113,133,0.2)"}`, borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: testResult.ok ? "#00C896" : "#FB7185", marginBottom: 6 }}>
                  {testResult.ok ? `HTTP ${testResult.status} — Success` : `Failed: ${testResult.error}`}
                </div>
                {testResult.response && <pre style={{ fontSize: 11, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", margin: 0, overflowX: "auto" }}>{JSON.stringify(testResult.response, null, 2).slice(0, 500)}</pre>}
              </div>
            )}
          </div>
        </Reveal>

        {/* Webhook list */}
        <Reveal delay={60}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(232,238,255,0.6)", fontFamily: "'Syne',sans-serif", marginBottom: 14 }}>
            Active Webhook Workflows ({webhooks.length})
          </div>
        </Reveal>

        {isLoading && <div style={{ height: 80, borderRadius: 12, background: "rgba(255,255,255,0.03)" }} />}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {webhooks.map((wh: any) => (
            <Reveal key={wh.id}>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <Webhook size={16} color="#00C896" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF" }}>{wh.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#00C896", background: "rgba(0,200,150,0.1)", borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace" }}>{wh.is_active ? "ACTIVE" : "INACTIVE"}</span>
                  <span style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", marginLeft: "auto" }}>
                    <Clock size={9} style={{ verticalAlign: "middle", marginRight: 3 }} />
                    {wh.run_count || 0} runs
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 9, marginBottom: 14 }}>
                  <code style={{ flex: 1, fontSize: 11, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", overflowX: "auto", whiteSpace: "nowrap" }}>{wh.webhookUrl}</code>
                  <button onClick={() => copy(wh.webhookUrl)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(232,238,255,0.4)", flexShrink: 0, padding: 4 }}>
                    {copied === wh.webhookUrl ? <Check size={12} color="#00C896" /> : <Copy size={12} />}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => rotateMut.mutate(wh.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 7, color: "#A78BFA", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    <RefreshCw size={10} /> Rotate Key
                  </button>
                  <button onClick={() => loadDeliveries(wh.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 7, color: "#38BDF8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {loadingDeliveries === String(wh.id) ? <Loader2 size={10} className="animate-spin" /> : <Eye size={10} />} History
                  </button>
                </div>

                {/* Delivery history */}
                {deliveries[String(wh.id)] && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", marginBottom: 4 }}>Recent Deliveries</div>
                    {deliveries[String(wh.id)].slice(0, 8).map((d: any) => (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, fontFamily: "'DM Mono',monospace", background: d.status === "replayed" ? "rgba(167,139,250,0.15)" : "rgba(0,200,150,0.1)", color: d.status === "replayed" ? "#A78BFA" : "#00C896" }}>{d.status.toUpperCase()}</span>
                        <span style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", flex: 1 }}>{d.id?.slice(0, 18)}…</span>
                        <span style={{ fontSize: 10, color: "rgba(232,238,255,0.25)" }}>{new Date(d.received_at).toLocaleTimeString()}</span>
                        <button onClick={() => replayMut.mutate(d.id)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", background: "rgba(0,200,150,0.07)", border: "1px solid rgba(0,200,150,0.15)", borderRadius: 6, color: "#00C896", fontSize: 10, cursor: "pointer" }}>
                          <Play size={8} /> Replay
                        </button>
                      </div>
                    ))}
                    {deliveries[String(wh.id)].length === 0 && <div style={{ fontSize: 11, color: "rgba(232,238,255,0.25)", padding: "8px 0" }}>No deliveries yet</div>}
                  </div>
                )}
              </div>
            </Reveal>
          ))}
          {!isLoading && webhooks.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(232,238,255,0.25)" }}>
              <Webhook size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 14 }}>No webhook workflows yet — create a workflow with trigger type "webhook"</div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
