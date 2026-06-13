/**
 * ExecutionSummaryPanel — Phase 5
 *
 * Renders an AI-generated natural-language narrative for a completed execution.
 * Calls POST /api/executions/:runId/summary which uses the backend AI engine
 * (Gemini / OpenAI / Groq) and caches the result in execution_summaries.
 *
 * Rules:
 * - Only shown for terminal executions (completed / failed / cancelled)
 * - One call per runId — result cached server-side; subsequent loads are instant
 * - Never shown while a run is still live
 * - Summary is clearly labelled as AI-generated to maintain transparency
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { executionsAPI } from "../lib/api";

interface ExecutionSummaryPanelProps {
  runId:   string | null;
  phase:   string;
  /** If true, auto-fetch on mount */
  autoFetch?: boolean;
}

type SummaryState = "idle" | "loading" | "ready" | "error";

export function ExecutionSummaryPanel({
  runId, phase, autoFetch = false,
}: ExecutionSummaryPanelProps) {
  const [state,   setState]   = useState<SummaryState>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [model,   setModel]   = useState<string | null>(null);
  const [cached,  setCached]  = useState(false);
  const [open,    setOpen]    = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const isTerminal = phase === "completed" || phase === "failed" || phase === "cancelled";

  const fetchSummary = async () => {
    if (!runId || !isTerminal || state === "loading") return;
    setState("loading");
    setError(null);
    try {
      const data = await executionsAPI.summary(runId);
      setSummary(data.summary || null);
      setModel(data.model   || null);
      setCached(!!data.cached);
      setState("ready");
    } catch (e: any) {
      setError(e?.message || "Summary unavailable");
      setState("error");
    }
  };

  // Auto-fetch when runId becomes available and phase is terminal
  useEffect(() => {
    if (autoFetch && runId && isTerminal && state === "idle") {
      fetchSummary();
    }
    // Reset if runId changes
    if (!runId) {
      setState("idle");
      setSummary(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, phase, autoFetch]);

  if (!isTerminal || !runId) return null;

  return (
    <div style={{
      background:   "rgba(167,139,250,0.05)",
      border:       "1px solid rgba(167,139,250,0.15)",
      borderRadius: 12,
      overflow:     "hidden",
    }}>
      {/* Header */}
      <div style={{
        display:     "flex",
        alignItems:  "center",
        gap:         8,
        padding:     "10px 14px",
        cursor:      state === "ready" ? "pointer" : "default",
      }}
        onClick={() => state === "ready" && setOpen(v => !v)}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background:   "rgba(167,139,250,0.12)",
          border:       "1px solid rgba(167,139,250,0.22)",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
        }}>
          {state === "loading"
            ? <RefreshCw size={11} color="#A78BFA" style={{ animation: "spin-slow 1.2s linear infinite" }} />
            : <Sparkles  size={11} color="#A78BFA" />
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#A78BFA",
            fontFamily: "'DM Sans',sans-serif",
          }}>
            AI Summary
          </span>
          {model && (
            <span style={{
              marginLeft: 6, fontSize: 9, color: "rgba(167,139,250,0.45)",
              fontFamily: "'DM Mono',monospace",
            }}>
              {model}{cached ? " · cached" : ""}
            </span>
          )}
        </div>

        {state === "idle" && (
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={e => { e.stopPropagation(); fetchSummary(); }}
            style={{
              fontSize: 10, fontWeight: 700, color: "#A78BFA",
              background: "rgba(167,139,250,0.1)",
              border: "1px solid rgba(167,139,250,0.22)",
              borderRadius: 7, padding: "4px 10px",
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Generate
          </motion.button>
        )}

        {state === "error" && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={e => { e.stopPropagation(); fetchSummary(); }}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700, color: "#FB7185",
              background: "rgba(251,113,133,0.08)",
              border: "1px solid rgba(251,113,133,0.2)",
              borderRadius: 7, padding: "4px 10px",
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <RefreshCw size={9} /> Retry
          </motion.button>
        )}

        {state === "ready" && (
          open ? <ChevronUp size={12} color="rgba(167,139,250,0.4)" />
               : <ChevronDown size={12} color="rgba(167,139,250,0.4)" />
        )}
      </div>

      {/* Body */}
      <AnimatePresence initial={false}>
        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ padding: "0 14px 12px" }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.2, 0.7, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  style={{
                    height: 8, borderRadius: 4, background: "rgba(167,139,250,0.25)",
                    width: i === 0 ? 120 : i === 1 ? 80 : 100,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              padding: "0 14px 12px",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <AlertCircle size={11} color="#FB7185" />
            <span style={{
              fontSize: 11, color: "rgba(251,113,133,0.7)",
              fontFamily: "'DM Sans',sans-serif",
            }}>
              {error || "Could not generate summary"}
            </span>
          </motion.div>
        )}

        {state === "ready" && open && summary && (
          <motion.div
            key="summary"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              borderTop: "1px solid rgba(167,139,250,0.1)",
              padding: "10px 14px 14px",
            }}>
              <p style={{
                fontSize: 12, lineHeight: 1.6,
                color: "rgba(232,238,255,0.75)",
                fontFamily: "'DM Sans',sans-serif",
                margin: 0,
                fontStyle: "italic",
              }}>
                "{summary}"
              </p>
              <div style={{
                marginTop: 8,
                fontSize: 9, color: "rgba(232,238,255,0.2)",
                fontFamily: "'DM Mono',monospace",
              }}>
                AI-generated from real execution data · verify independently
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
