/**
 * SuperAdminAssistant — Phase 3A
 * Chat-style panel for the Super Admin tab. Calls POST /api/super-admin/assistant/query.
 */
import { useState, useRef, useEffect } from "react";
import { superAdminAssistantAPI } from "../lib/api";
import { Sparkles, Send, Loader2, AlertCircle } from "lucide-react";

type Msg = {
  role: "user" | "assistant";
  content: string;
  contextUsed?: string[];
  error?: boolean;
};

export default function SuperAdminAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string>(
    `sa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res: any = await superAdminAssistantAPI.query(q, conversationIdRef.current);
      setMessages(m => [
        ...m,
        { role: "assistant", content: res?.response || "(no response)", contextUsed: res?.contextUsed || [] },
      ]);
    } catch (e: any) {
      setMessages(m => [
        ...m,
        { role: "assistant", content: e?.message || "Assistant call failed.", error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Sparkles size={16} color="#F59E0B" />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif" }}>
          Super Admin Assistant
        </div>
        <div style={{ fontSize: 10, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace" }}>
          infra · queues · providers · security
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: "auto", borderRadius: 12,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          padding: 14, display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "rgba(232,238,255,0.4)", fontSize: 13, padding: 12 }}>
            Ask anything about platform health, queue saturation, provider failover,
            region routing, storage backend, or security signals.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%",
              background: m.role === "user" ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${m.role === "user" ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 12, padding: "10px 12px",
              color: m.error ? "#FB7185" : "#E8EEFF",
              fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap",
              fontFamily: "'DM Sans',sans-serif",
            }}>
              {m.role === "assistant" && (m.contextUsed?.length || 0) > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {m.contextUsed!.map(tag => (
                    <span key={tag} style={{
                      fontSize: 9, fontFamily: "'DM Mono',monospace",
                      background: "rgba(245,158,11,0.1)", color: "#F59E0B",
                      padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em",
                    }}>{tag}</span>
                  ))}
                </div>
              )}
              {m.error && <AlertCircle size={12} style={{ marginRight: 4, verticalAlign: -2 }} />}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(232,238,255,0.5)", fontSize: 12 }}>
            <Loader2 size={14} className="animate-spin" /> Gathering live telemetry…
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about platform health, queues, providers…"
          disabled={loading}
          style={{
            flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "10px 14px", color: "#E8EEFF",
            fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
            color: "#F59E0B", borderRadius: 10, padding: "0 14px", cursor: loading ? "wait" : "pointer",
            display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12,
            fontFamily: "'DM Mono',monospace",
          }}
        >
          <Send size={13} /> Send
        </button>
      </div>
    </div>
  );
}
