import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, ExternalLink, Copy, Zap, Play, Eye, EyeOff, RefreshCw } from "lucide-react";
import api, { API_BASE_URL } from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";

export default function IntegrationDetail() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const qc           = useQueryClient();
  const { toast }    = useToast();
  const [formData, setFormData]       = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testing, setTesting]         = useState(false);
  const [testResult, setTestResult]   = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["integrations", id],
    queryFn:  () => (api as any).get(`/integrations/${id}`),
  });

  const integ = data?.integration;

  const connectMut = useMutation({
    mutationFn: (creds: any) => (api as any).post(`/integrations/${id}/connect`, { credentials: creds }),
    onSuccess: () => {
      toast({ title: `${integ?.name} connected!`, description: "Connection stored securely in the Credential Vault." });
      qc.invalidateQueries({ queryKey: ["integrations", id] });
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
    onError: (e: any) => toast({ title: "Connection failed", description: e?.message, variant: "destructive" }),
  });

  const disconnectMut = useMutation({
    mutationFn: () => (api as any).delete(`/integrations/${id}/disconnect`),
    onSuccess: () => {
      toast({ title: "Disconnected" });
      qc.invalidateQueries({ queryKey: ["integrations", id] });
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  const handleOAuth = () => {
    const token = localStorage.getItem("autoflowng_token");
    window.open(
      `${API_BASE_URL}/api/integrations/${id}/oauth/start?token=${encodeURIComponent(token || "")}`,
      "_blank", "width=600,height=700"
    );
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await (api as any).post(`/integrations/${id}/test`);
      setTestResult(r);
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.message });
    } finally {
      setTesting(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8, padding: "10px 12px", color: "#E8EEFF", fontSize: 13,
    fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box",
  };

  // Per-integration field overrides — more descriptive than the generic auth-type labels
  // BUGFIX: 'discord' used to have an apiKey/"Bot Token" field here, which
  // looked like a working per-user connect form but was a dead end —
  // platforms/discord.js's discordReq() reads only the single shared
  // process.env.DISCORD_BOT_TOKEN; nothing ever reads whatever a user typed
  // into this form back out of the Credential Vault. Removed so Discord
  // falls through to the dedicated notice below instead of silently
  // accepting a token that would never be used.
  const INTEGRATION_FIELDS: Record<string, { name: string; label: string; type: string }[]> = {
    telegram:    [{ name: "apiKey", label: "Bot Token",        type: "password" }],
    openai:      [{ name: "apiKey", label: "OpenAI API Key",   type: "password" }],
    anthropic:   [{ name: "apiKey", label: "Anthropic API Key",type: "password" }],
    stripe:      [{ name: "apiKey", label: "Secret Key",       type: "password" }],
    sendgrid:    [{ name: "apiKey", label: "SendGrid API Key", type: "password" }],
    mailchimp:   [{ name: "apiKey", label: "Mailchimp API Key",type: "password" }],
    twilio:      [{ name: "apiKey", label: "Auth Token",       type: "password" }],
    airtable:    [{ name: "apiKey", label: "Personal Access Token", type: "password" }],
    notion:      [{ name: "apiKey", label: "Integration Token",type: "password" }],
    hubspot:     [{ name: "apiKey", label: "Private App Token",type: "password" }],
    shopify:     [{ name: "apiKey", label: "Admin API Token",  type: "password" }],
  };

  const AUTH_FIELDS: Record<string, { name: string; label: string; type: string }[]> = {
    api_key:      [{ name: "apiKey",   label: "API Key",      type: "password" }],
    bearer_token: [{ name: "apiKey",   label: "Bearer Token", type: "password" }],
    custom:       [{ name: "apiKey",   label: "Token / Key",  type: "password" }],
  };

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh" }}>
      <Loader2 size={24} className="animate-spin" color="#00C896" />
    </div>
  );

  if (!integ) return <div style={{ padding: 32, color: "#E8EEFF" }}>Integration not found</div>;

  const fields = INTEGRATION_FIELDS[integ.id] || AUTH_FIELDS[integ.authType] || [];
  const isOAuth = integ.authType === "oauth2";
  // Discord runs on one shared bot token configured by the platform owner
  // (Railway env var), not a per-user credential — so neither the OAuth
  // button nor the generic API-key form apply to it. The real connect flow
  // (invite the bot to a server, then submit the Server ID) lives on the
  // Integration Hub page; this page just points there instead of rendering
  // a form that would silently do nothing.
  const isDiscord = integ.id === "discord";

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        <Reveal>
          <button onClick={() => navigate("/marketplace")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(232,238,255,0.4)", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif", marginBottom: 24, padding: 0 }}>
            <ArrowLeft size={14} /> Back to Marketplace
          </button>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
          {/* Left */}
          <div>
            <Reveal>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: integ.iconColor + "22", border: `1px solid ${integ.iconColor}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: integ.iconColor, fontFamily: "'DM Mono',monospace" }}>{integ.id?.slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h1 style={{ fontSize: "1.8rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", color: "#E8EEFF", margin: 0 }}>{integ.name}</h1>
                    {integ.connected && <span style={{ fontSize: 9, fontWeight: 700, color: "#00C896", background: "rgba(0,200,150,0.12)", borderRadius: 100, padding: "3px 8px", fontFamily: "'DM Mono',monospace" }}>CONNECTED</span>}
                  </div>
                  <p style={{ color: "rgba(232,238,255,0.44)", fontSize: 13, margin: "4px 0 0" }}>{integ.description}</p>
                </div>
              </div>
            </Reveal>

            {/* Triggers */}
            {integ.triggers?.length > 0 && (
              <Reveal delay={60}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.07em", marginBottom: 12, textTransform: "uppercase" }}>Triggers ({integ.triggers.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {integ.triggers.map((t: any) => (
                      <NodeCard key={t.id} node={t} kind="trigger" color="#FBBF24" />
                    ))}
                  </div>
                </div>
              </Reveal>
            )}

            {/* Actions */}
            {integ.actions?.length > 0 && (
              <Reveal delay={80}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.07em", marginBottom: 12, textTransform: "uppercase" }}>Actions ({integ.actions.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {integ.actions.map((a: any) => (
                      <NodeCard key={a.id} node={a} kind="action" color="#00C896" />
                    ))}
                  </div>
                </div>
              </Reveal>
            )}
          </div>

          {/* Right — Connection Panel */}
          <div style={{ position: "sticky", top: 24 }}>
            <Reveal delay={40}>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF", marginBottom: 16 }}>Connection</div>

                {integ.connected ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 10, marginBottom: 16 }}>
                      <CheckCircle2 size={14} color="#00C896" />
                      <span style={{ fontSize: 13, color: "#00C896", fontWeight: 600 }}>Connected</span>
                    </div>
                    {integ.connection?.platform_email && (
                      <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", marginBottom: 16 }}>{integ.connection.platform_email}</div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleTest} disabled={testing} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, color: "#38BDF8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} />} Test
                      </button>
                      <button onClick={() => disconnectMut.mutate()} style={{ flex: 1, padding: "9px 0", background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 8, color: "#FB7185", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Disconnect
                      </button>
                    </div>
                    {testResult && (
                      <div style={{ marginTop: 12, padding: "10px 12px", background: testResult.ok ? "rgba(0,200,150,0.07)" : "rgba(251,113,133,0.07)", border: `1px solid ${testResult.ok ? "rgba(0,200,150,0.2)" : "rgba(251,113,133,0.2)"}`, borderRadius: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                          {testResult.ok ? <CheckCircle2 size={12} color="#00C896" /> : <XCircle size={12} color="#FB7185" />}
                          <span style={{ color: testResult.ok ? "#00C896" : "#FB7185", fontWeight: 600 }}>{testResult.ok ? "Connection healthy" : "Test failed"}</span>
                        </div>
                        {testResult.error && <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", marginTop: 4 }}>{testResult.error}</div>}
                      </div>
                    )}
                  </div>
                ) : isDiscord ? (
                  <div>
                    <div style={{ fontSize: 12, color: "rgba(232,238,255,0.55)", lineHeight: 1.6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                      Discord connects differently — there's one shared bot
                      for the whole platform rather than a personal token.
                      Head to the Integration Hub to invite the bot to your
                      server and link it.
                    </div>
                    <button onClick={() => navigate("/marketplace")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 0", background: "rgba(0,200,150,0.12)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 10, color: "#00C896", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      <ExternalLink size={13} /> Go to Integration Hub
                    </button>
                  </div>
                ) : isOAuth ? (
                  <div>
                    {!integ.configured && (
                      <div style={{ fontSize: 12, color: "#FB7185", background: "rgba(251,113,133,0.07)", border: "1px solid rgba(251,113,133,0.15)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                        OAuth credentials not configured. Set {integ.envRequired?.join(", ")} environment variables.
                      </div>
                    )}
                    <button onClick={handleOAuth} disabled={!integ.configured} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 0", background: integ.configured ? "rgba(0,200,150,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${integ.configured ? "rgba(0,200,150,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, color: integ.configured ? "#00C896" : "rgba(232,238,255,0.3)", fontSize: 13, fontWeight: 700, cursor: integ.configured ? "pointer" : "not-allowed" }}>
                      <ExternalLink size={13} /> Connect via OAuth
                    </button>
                  </div>
                ) : (
                  <div>
                    {fields.map(f => (
                      <div key={f.name} style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{f.label}</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type={showSecrets[f.name] ? "text" : f.type}
                            value={formData[f.name] || ""}
                            onChange={e => setFormData(d => ({ ...d, [f.name]: e.target.value }))}
                            placeholder={f.label}
                            style={{ ...inp, paddingRight: f.type === "password" ? 36 : 12 }}
                          />
                          {f.type === "password" && (
                            <button onClick={() => setShowSecrets(s => ({ ...s, [f.name]: !s[f.name] }))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(232,238,255,0.3)", padding: 0 }}>
                              {showSecrets[f.name] ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => connectMut.mutate(formData)} disabled={connectMut.isPending} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 0", background: "rgba(0,200,150,0.12)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 10, color: "#00C896", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
                      {connectMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Connect
                    </button>
                  </div>
                )}

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", marginBottom: 8 }}>Auth Type</div>
                  <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)" }}>{integ.authType?.replace(/_/g, " ").toUpperCase()}</div>
                  {integ.envRequired?.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", marginTop: 12, marginBottom: 6 }}>Required Env Vars</div>
                      {integ.envRequired.map((e: string) => (
                        <div key={e} style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>{e}</div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function NodeCard({ node, kind, color }: { node: any; kind: string; color: string }) {
  const unavailable = kind === "action" && node.available === false;
  return (
    <div
      title={unavailable ? "This action is not yet available" : undefined}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "12px 14px",
        background: unavailable ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${unavailable ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 10,
        opacity: unavailable ? 0.6 : 1,
        cursor: unavailable ? "not-allowed" : "default",
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, color: unavailable ? "rgba(232,238,255,0.25)" : color, background: unavailable ? "rgba(255,255,255,0.04)" : color + "18", borderRadius: 6, padding: "3px 7px", fontFamily: "'DM Mono',monospace", flexShrink: 0, marginTop: 1 }}>
        {kind.toUpperCase()}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: unavailable ? "rgba(232,238,255,0.4)" : "#E8EEFF" }}>{node.label}</div>
          {unavailable && (
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: "rgba(232,238,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>
              NOT YET AVAILABLE
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)" }}>{node.description}</div>
        {node.params?.length > 0 && !unavailable && (
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>
            {node.params.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
