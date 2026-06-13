import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Trash2, RefreshCw, ChevronDown, Lock, CheckCircle2, Clock, Eye, EyeOff } from "lucide-react";
import api from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";

export default function CredentialManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ platform: "", apiKey: "", label: "" });
  const [showKey, setShowKey]   = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const { data: credsData, isLoading } = useQuery({
    queryKey: ["credentials"],
    queryFn:  () => (api as any).get("/credentials"),
  });

  const { data: auditData } = useQuery({
    queryKey: ["credentials", "audit"],
    queryFn:  () => (api as any).get("/credentials/audit"),
    enabled:  auditOpen,
  });

  const storeMut = useMutation({
    mutationFn: () => (api as any).post("/credentials", { platform: formData.platform, credentials: { apiKey: formData.apiKey }, label: formData.label }),
    onSuccess: () => {
      toast({ title: "Credential stored", description: "Encrypted and stored in Credential Vault." });
      qc.invalidateQueries({ queryKey: ["credentials"] });
      setShowForm(false);
      setFormData({ platform: "", apiKey: "", label: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (platform: string) => (api as any).delete(`/credentials/${platform}`),
    onSuccess: () => { toast({ title: "Credential deleted" }); qc.invalidateQueries({ queryKey: ["credentials"] }); },
  });

  const credentials: any[] = credsData?.credentials || [];
  const auditEntries: any[] = auditData?.entries || [];

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8, padding: "10px 12px", color: "#E8EEFF", fontSize: 13,
    fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box",
  };

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>PHASE 13 · CREDENTIAL VAULT</div>
              <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", margin: 0 }}>Credential Manager</h1>
              <p style={{ fontSize: 13, color: "rgba(232,238,255,0.4)", marginTop: 6 }}>AES-256-GCM encrypted · Organization-isolated · Audit-logged</p>
            </div>
            <button onClick={() => setShowForm(s => !s)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.25)", borderRadius: 10, color: "#00C896", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <Plus size={14} /> Add Credential
            </button>
          </div>
        </Reveal>

        {/* Add form */}
        {showForm && (
          <Reveal>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 18 }}>Store New Credential</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", marginBottom: 5 }}>Platform ID</label>
                  <input value={formData.platform} onChange={e => setFormData(d => ({ ...d, platform: e.target.value }))} placeholder="e.g. youtube, discord" style={inp} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", marginBottom: 5 }}>Label</label>
                  <input value={formData.label} onChange={e => setFormData(d => ({ ...d, label: e.target.value }))} placeholder="e.g. Production Bot" style={inp} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", marginBottom: 5 }}>API Key / Token</label>
                  <div style={{ position: "relative" }}>
                    <input type={showKey ? "text" : "password"} value={formData.apiKey} onChange={e => setFormData(d => ({ ...d, apiKey: e.target.value }))} placeholder="Paste secret here" style={{ ...inp, paddingRight: 36 }} />
                    <button onClick={() => setShowKey(s => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(232,238,255,0.3)", padding: 0 }}>
                      {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => storeMut.mutate()} disabled={!formData.platform || !formData.apiKey || storeMut.isPending} style={{ padding: "9px 20px", background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.25)", borderRadius: 8, color: "#00C896", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {storeMut.isPending ? "Encrypting…" : <><Lock size={11} style={{ verticalAlign: "middle", marginRight: 5 }} />Encrypt & Store</>}
                </button>
                <button onClick={() => setShowForm(false)} style={{ padding: "9px 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: "rgba(232,238,255,0.4)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </Reveal>
        )}

        {/* Credential list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 64, borderRadius: 12, background: "rgba(255,255,255,0.03)" }} />
          ))}
          {!isLoading && credentials.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(232,238,255,0.25)" }}>
              <Shield size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 14 }}>No credentials stored yet</div>
            </div>
          )}
          {credentials.map((cred: any) => (
            <Reveal key={cred.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: (cred.integrationColor || "#00C896") + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Lock size={14} color={cred.integrationColor || "#00C896"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF" }}>{cred.integrationName || cred.platform}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#00C896", background: "rgba(0,200,150,0.1)", borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace" }}>AES-256</span>
                    {cred.metadata?.label && <span style={{ fontSize: 11, color: "rgba(232,238,255,0.35)" }}>{cred.metadata.label}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", marginTop: 2, display: "flex", gap: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={9} /> Updated {new Date(cred.updated_at).toLocaleDateString()}</span>
                    <span>Rotations: {cred.rotation_count || 0}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace" }}>{cred.credential_type}</span>
                  </div>
                </div>
                <button onClick={() => deleteMut.mutate(cred.platform)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", background: "rgba(251,113,133,0.07)", border: "1px solid rgba(251,113,133,0.15)", borderRadius: 7, color: "#FB7185", fontSize: 11, cursor: "pointer" }}>
                  <Trash2 size={10} /> Delete
                </button>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Audit Log */}
        <Reveal>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
            <button onClick={() => setAuditOpen(s => !s)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", color: "#E8EEFF" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Credential Audit Log</span>
              <ChevronDown size={14} style={{ transform: auditOpen ? "rotate(180deg)" : "", transition: "transform 0.2s", color: "rgba(232,238,255,0.3)" }} />
            </button>
            {auditOpen && (
              <div style={{ padding: "0 0 16px" }}>
                {auditEntries.map((e: any) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace", padding: "2px 7px", borderRadius: 6, background: e.action === "deleted" ? "rgba(251,113,133,0.1)" : "rgba(0,200,150,0.1)", color: e.action === "deleted" ? "#FB7185" : "#00C896" }}>{e.action.toUpperCase()}</span>
                    <span style={{ fontSize: 12, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace" }}>{e.platform}</span>
                    <span style={{ fontSize: 11, color: "rgba(232,238,255,0.25)", marginLeft: "auto" }}>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {auditEntries.length === 0 && <div style={{ padding: "20px", fontSize: 12, color: "rgba(232,238,255,0.25)", textAlign: "center" }}>No audit entries</div>}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </PageTransition>
  );
}
