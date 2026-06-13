import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { connectionsAPI, tokenStore } from "../lib/api";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { queryKeys, invalidate } from "../lib/queryClient";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { Link2, Check, ExternalLink, Trash2, Plus, Phone, MessageSquare, Webhook, Globe, Zap } from "lucide-react";

const PLATFORMS = [
  { id: "whatsapp", label: "WhatsApp",  icon: "📱", color: "#25D366", desc: "Send and receive WhatsApp messages", fields: [{ name: "phoneNumberId", label: "Phone Number ID", type: "text" }, { name: "accessToken", label: "Access Token", type: "password" }, { name: "verifyToken", label: "Verify Token", type: "text" }] },
  { id: "telegram", label: "Telegram",  icon: "✈️",  color: "#229ED9", desc: "Connect your Telegram bot", fields: [{ name: "botToken", label: "Bot Token", type: "password" }, { name: "chatId", label: "Chat ID", type: "text" }] },
  { id: "google",   label: "Google",   icon: "🔵", color: "#4285F4", desc: "Google Calendar, Sheets, Drive", fields: [] },
  { id: "github",   label: "GitHub",   icon: "⬛", color: "#E8EEFF", desc: "Repository events and webhooks", fields: [] },
  { id: "slack",    label: "Slack",    icon: "💬", color: "#4A154B", desc: "Send messages to Slack channels", fields: [] },
  { id: "webhook",  label: "Webhook",  icon: "🔗", color: "#00C896", desc: "Custom webhook endpoint", fields: [{ name: "url", label: "Webhook URL", type: "url" }, { name: "secret", label: "Secret", type: "password" }] },
];

function ConnectionCard({ platform, connected, onConnect, onDisconnect }: any) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(false);
  const { toast } = useToast();

  const p = PLATFORMS.find(pl => pl.id === platform.platform || pl.id === platform.id) || {
    id: platform.platform || platform.id, label: platform.platform || platform.id,
    icon: "🔌", color: "#00C896", desc: "Integration", fields: [],
  };

  const handleConnect = async () => {
    if (p.fields.length === 0) {
      const token = tokenStore.get();
      if (!token) return;
      window.open(connectionsAPI.oauthUrl(p.id, token), "_blank", "width=600,height=700");
      return;
    }
    setLoading(true);
    try {
      const fn = p.id === "whatsapp" ? connectionsAPI.whatsapp : p.id === "telegram" ? connectionsAPI.telegram : null;
      if (fn) { await fn(formData); onConnect(); setShowForm(false); toast({ title: `${p.label} connected!` }); }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8, padding: "9px 12px", color: "#E8EEFF", fontSize: 13,
    fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box",
  };

  return (
    <Reveal>
      <div className="af-glass" data-testid={`connection-card-${p.id}`} style={{ borderRadius: 16, padding: "20px", position: "relative", overflow: "hidden", border: `1px solid ${connected ? "rgba(0,200,150,0.15)" : "rgba(255,255,255,0.06)"}`, transition: "border-color 0.2s" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${p.color}55, transparent)` }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>{p.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF" }}>{p.label}</span>
              {connected && <span style={{ fontSize: 9, fontWeight: 700, color: "#00C896", background: "rgba(0,200,150,0.12)", borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace" }}>CONNECTED</span>}
            </div>
            <p style={{ fontSize: 12, color: "rgba(232,238,255,0.4)", lineHeight: 1.5 }}>{p.desc}</p>
          </div>
        </div>

        {showForm && p.fields.length > 0 && (
          <div style={{ marginBottom: 14, padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: 10 }}>
            {p.fields.map(f => (
              <div key={f.name} style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>{f.label}</label>
                <input data-testid={`input-${f.name}`} type={f.type} value={formData[f.name] || ""} onChange={e => setFormData(d => ({ ...d, [f.name]: e.target.value }))} placeholder={f.label} style={inp} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {connected ? (
            <button data-testid={`disconnect-${p.id}`} onClick={() => onDisconnect(p.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 8, padding: "7px 12px", color: "#FB7185", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              <Trash2 size={11} /> Disconnect
            </button>
          ) : showForm ? (
            <>
              <button onClick={handleConnect} disabled={loading} data-testid={`confirm-connect-${p.id}`} style={{ display: "flex", alignItems: "center", gap: 6, background: "#00C896", border: "none", borderRadius: 8, padding: "7px 14px", color: "#04060F", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                {loading ? "Connecting…" : <><Check size={11} /> Connect</>}
              </button>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "7px 12px", color: "rgba(232,238,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
            </>
          ) : (
            <button data-testid={`connect-${p.id}`} onClick={() => { if (p.fields.length > 0) setShowForm(true); else handleConnect(); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 8, padding: "7px 12px", color: "#00C896", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              {p.fields.length === 0 ? <><ExternalLink size={11} /> Connect via OAuth</> : <><Plus size={11} /> Connect</>}
            </button>
          )}
        </div>
      </div>
    </Reveal>
  );
}

export default function Connections() {
  const { data: conns = [], refetch } = useQuery({
    queryKey: queryKeys.connections,
    queryFn: () => connectionsAPI.list().then((d: any) => d.connections || d.platforms || []),
  });
  const { toast } = useToast();

  const handleDisconnect = async (platform: string) => {
    try {
      await connectionsAPI.disconnect(platform);
      invalidate.connections();
      toast({ title: "Disconnected" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  };

  const connected = (conns as any[]).filter((c: any) => c.connected);
  const all = PLATFORMS.map(p => {
    const existing = (conns as any[]).find((c: any) => c.platform === p.id || c.id === p.id);
    return { ...p, ...(existing || {}), connected: existing?.connected ?? false };
  });

  return (
    <PageTransition variant="slide">
    <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto" }}>
      <Reveal>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>INTEGRATIONS</div>
          <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>Connections</h1>
          <p style={{ fontSize: 14, color: "rgba(232,238,255,0.4)", marginTop: 4 }}>{connected.length} active connections · {all.length} available</p>
        </div>
      </Reveal>

      {connected.length > 0 && (
        <Reveal delay={40}>
          <div style={{ marginBottom: 24, display: "flex", gap: 8, padding: "12px 16px", background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.15)", borderRadius: 12 }}>
            <Check size={14} color="#00C896" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: "rgba(232,238,255,0.6)", fontFamily: "'DM Sans',sans-serif" }}>
              <strong style={{ color: "#00C896" }}>{connected.length} connection{connected.length !== 1 ? "s" : ""}</strong> active and ready for automation
            </span>
          </div>
        </Reveal>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
        {all.map((p: any, i: number) => (
          <Reveal key={p.id} delay={i * 40}>
            <ConnectionCard platform={p} connected={p.connected} onConnect={() => { invalidate.connections(); refetch(); }} onDisconnect={handleDisconnect} />
          </Reveal>
        ))}
      </div>
    </div>
    </PageTransition>
  );
}
