import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { aiAPI } from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { queryKeys } from "../lib/queryClient";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Trash2, Plus, Sparkles, User, Loader2, Copy, Check, Zap } from "lucide-react";

interface Msg { role: "user"|"assistant"; content: string; id: string; }

const QUICK_PROMPTS = [
  "Create a workflow that sends a WhatsApp alert when a webhook fires",
  "Explain how to connect Telegram notifications to my automations",
  "Generate a workflow that checks an API and notifies me on failure",
  "What's the best way to schedule recurring automations?",
];

function MessageBubble({ msg }: { msg: Msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div data-testid={`message-${msg.id}`} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20, flexDirection: isUser ? "row-reverse" : "row" }}>
      {/* Avatar */}
      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isUser ? "rgba(56,189,248,0.15)" : "rgba(167,139,250,0.15)", border: `1.5px solid ${isUser ? "rgba(56,189,248,0.3)" : "rgba(167,139,250,0.3)"}` }}>
        {isUser ? <User size={14} color="#38BDF8" /> : <Bot size={14} color="#A78BFA" />}
      </div>
      {/* Bubble */}
      <div style={{ maxWidth: "75%", position: "relative", group: "1" } as any}>
        <div style={{ background: isUser ? "rgba(56,189,248,0.08)" : "rgba(167,139,250,0.06)", border: `1px solid ${isUser ? "rgba(56,189,248,0.15)" : "rgba(167,139,250,0.12)"}`, borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px", padding: "12px 16px", color: "#E8EEFF", fontSize: 14, lineHeight: 1.65, fontFamily: "'DM Sans',sans-serif", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {msg.content}
        </div>
        <button onClick={copy} style={{ position: "absolute", top: 8, right: isUser ? "auto" : -32, left: isUser ? -32 : "auto", background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(232,238,255,0.4)", opacity: 0, transition: "opacity 0.18s" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0"}
        >
          {copied ? <Check size={12} color="#00C896" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}

export default function AIChat() {
  const [msgs, setMsgs]   = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [session] = useState("agent");
  const endRef    = useRef<HTMLDivElement>(null);
  const taRef     = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const { data: history } = useQuery({
    queryKey: queryKeys.aiHistory(session),
    queryFn:  () => aiAPI.history(session, 60).then((d: any) => d.messages || []),
    onSuccess: (data: any[]) => {
      if (data.length > 0 && msgs.length === 0) {
        setMsgs(data.map((m: any, i: number) => ({ role: m.role, content: m.content || m.message, id: m.id || String(i) })));
      }
    },
  } as any);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");
    const userMsg: Msg = { role: "user", content, id: `u${Date.now()}` };
    setMsgs(ms => [...ms, userMsg]);
    setLoading(true);
    try {
      const res: any = await aiAPI.chat({ message: content, session });
      const reply = res?.reply || res?.message || res?.content || "I couldn't generate a response. Please try again.";
      setMsgs(ms => [...ms, { role: "assistant", content: reply, id: `a${Date.now()}` }]);
    } catch (e: any) {
      toast({ title: "AI Error", description: e?.message || "Could not reach AI service", variant: "destructive" });
      setMsgs(ms => ms.filter(m => m.id !== userMsg.id));
    } finally { setLoading(false); }
  };

  const clear = () => setMsgs([]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <PageTransition variant="slide" speed="snappy">
    <div style={{ height: "calc(100vh - 0px)", display: "flex", flexDirection: "column", padding: "0" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={18} color="#A78BFA" />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>AI Assistant</h1>
                <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>AUTOFLOWNG INTELLIGENCE ENGINE</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={clear} data-testid="button-clear-chat" style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "6px 12px", color: "rgba(232,238,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              <Trash2 size={12} /> Clear
            </button>
            <button onClick={() => setMsgs([])} data-testid="button-new-chat" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, padding: "6px 12px", color: "#A78BFA", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              <Plus size={12} /> New chat
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {msgs.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <Sparkles size={28} color="#A78BFA" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#E8EEFF", marginBottom: 8 }}>What can I help you automate?</h2>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.4)", marginBottom: 32, maxWidth: 500, lineHeight: 1.65 }}>
              I'm your AI-native orchestration assistant. Ask me to build workflows, explain automations, or generate integration logic.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, width: "100%", maxWidth: 700 }}>
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} data-testid={`quick-prompt-${i}`} onClick={() => send(p)} style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: 12, padding: "12px 14px", color: "rgba(232,238,255,0.65)", fontSize: 12, textAlign: "left", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, transition: "all 0.18s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.1)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.25)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.05)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.12)"; }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map(m => <MessageBubble key={m.id} msg={m} />)}
        {loading && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(167,139,250,0.15)", border: "1.5px solid rgba(167,139,250,0.3)", flexShrink: 0 }}>
              <Bot size={14} color="#A78BFA" />
            </div>
            <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: "4px 16px 16px 16px", padding: "14px 18px", display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={14} color="#A78BFA" style={{ animation: "spin-slow 1s linear infinite" }} />
              <span style={{ fontSize: 13, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Sans',sans-serif" }}>Thinking…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 32px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "12px 16px", transition: "border-color 0.18s" }}
          onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.3)"}
          onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"}
        >
          <textarea
            ref={taRef}
            data-testid="input-chat"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask me anything about workflows, automations, or integrations…"
            rows={1}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", resize: "none", lineHeight: 1.6, maxHeight: 200, overflow: "auto" }}
          />
          <button
            data-testid="button-send"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{ width: 36, height: 36, borderRadius: 10, background: input.trim() && !loading ? "#A78BFA" : "rgba(255,255,255,0.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() && !loading ? "pointer" : "not-allowed", flexShrink: 0, alignSelf: "flex-end", transition: "background 0.18s" }}
          >
            <Send size={15} color={input.trim() && !loading ? "white" : "rgba(232,238,255,0.2)"} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <Zap size={10} color="rgba(232,238,255,0.2)" />
          <span style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>AUTOFLOWNG AI · Enter to send · Shift+Enter for new line</span>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
