import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";

document.documentElement.classList.add("dark");

// ── Stale chunk auto-recovery ─────────────────────────────────────────────────
// When Vercel deploys a new build, old JS chunk filenames no longer exist.
// Users with the old version cached get "Failed to fetch dynamically imported module".
// We detect this and silently reload once to pick up the new build.
function isChunkLoadError(msg) {
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
  }
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
// cache bust Sat Jun 13 22:56:51 UTC 2026
