import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";

document.documentElement.classList.add("dark");

// ── TEMP DIAGNOSTIC ──
function renderFatalError(source: string, err: unknown) {
  const root = document.getElementById("root");
  if (!root) return;
  const msg = err instanceof Error ? (err.stack || err.message) : String(err);
  root.innerHTML = `<div style="min-height:100vh;background:#04060F;color:#fff;font-family:monospace;padding:20px;white-space:pre-wrap;word-break:break-word;font-size:13px;"><div style="color:#FB7185;font-weight:bold;font-size:15px;margin-bottom:10px;">AutoFlowNG crashed (${source})</div><div>${msg.replace(/</g, "&lt;")}</div></div>`;
}

interface EBProps { children: ReactNode; }
interface EBState { hasError: boolean; error: unknown; }
class RootErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false, error: null };
  static getDerivedStateFromError(error: unknown): EBState { return { hasError: true, error }; }
  componentDidCatch(error: unknown, info: unknown) {
    console.error("RootErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const msg = err instanceof Error ? (err.stack || err.message) : String(err);
      return (
        <div style={{ minHeight: "100vh", background: "#04060F", color: "#fff", fontFamily: "monospace", padding: 20, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>
          <div style={{ color: "#FB7185", fontWeight: "bold", fontSize: 15, marginBottom: 10 }}>AutoFlowNG crashed (React render)</div>
          <div>{msg}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Stale chunk auto-recovery ─────────────────────────────────────────────────
// When Vercel deploys a new build, old JS chunk filenames no longer exist.
// Users with the old version cached get "Failed to fetch dynamically imported module".
// We detect this and silently reload once to pick up the new build.
function isChunkLoadError(msg: unknown) {
  const s = typeof msg === "string" ? msg : String(msg || "");
  return (
    s.includes("Failed to fetch dynamically imported module") ||
    s.includes("Importing a module script failed") ||
    s.includes("Unable to preload CSS")
  );
}

const RELOAD_KEY = "autoflowng_chunk_reload";

window.addEventListener("error", (e) => {
  if (isChunkLoadError(e.message || "")) {
    if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }
  } else {
    renderFatalError("window error", e.error || e.message);
  }
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason?.message || String(e.reason || "");
  if (isChunkLoadError(msg)) {
    e.preventDefault();
    if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }
  } else {
    renderFatalError("unhandled promise rejection", e.reason);
  }
});

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </RootErrorBoundary>
);
// cache bust Sat Jun 13 22:56:51 UTC 2026
