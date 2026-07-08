/**
 * TrialCompletionSurvey — Phase 3B
 *
 * Checks GET /api/surveys/pending on mount. If the user owes the trial
 * survey, renders a dismissible modal asking for:
 *   - 1-5 star rating
 *   - 0-10 NPS
 *   - Optional free-text testimonial
 *
 * Submits to /api/surveys/rating, /api/surveys/nps, and (only if quote
 * provided) /api/testimonials/submit.
 */

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { isPlatformAdmin } from "../lib/rbac";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "autoflowng_token";

function authFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${BASE_URL}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

export default function TrialCompletionSurvey() {
  const { user } = useAuth();
  const [open, setOpen]   = useState(false);
  const [rating, setRating] = useState(0);
  const [nps, setNps]       = useState<number | null>(null);
  const [quote, setQuote]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]     = useState(false);

  const DISMISS_KEY = `autoflowng_trial_survey_dismissed_${user?.id ?? "anon"}`;

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    // Never show to admin/staff accounts
    if (isPlatformAdmin(user?.role)) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    authFetch("/surveys/pending")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.pending) setOpen(true); })
      .catch(() => {});
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  async function submit() {
    if (submitting) return;
    if (!rating && nps == null && !quote.trim()) { dismiss(); return; }
    setSubmitting(true);
    try {
      const tasks: Promise<any>[] = [];
      if (rating)      tasks.push(authFetch("/surveys/rating", { method: "POST", body: JSON.stringify({ rating, trigger: "trial_end" }) }));
      if (nps != null) tasks.push(authFetch("/surveys/nps",    { method: "POST", body: JSON.stringify({ score: nps, trigger: "trial_end" }) }));
      if (quote.trim()) tasks.push(authFetch("/testimonials/submit", { method: "POST", body: JSON.stringify({ quote, rating: rating || null }) }));
      await Promise.allSettled(tasks);
      setDone(true);
      setTimeout(() => { dismiss(); }, 1400);
    } finally { setSubmitting(false); }
  }

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgba(4,6,15,0.72)", backdropFilter: "blur(8px)",
    }}>
      <div style={{
        width: "100%", maxWidth: 460, background: "rgba(15,18,32,0.98)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18,
        padding: "26px 26px 22px", color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#00C896", letterSpacing: "0.1em", fontFamily: "'DM Mono',monospace" }}>
              TRIAL COMPLETE
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", margin: "4px 0 0" }}>
              How was your trial?
            </h2>
          </div>
          <button onClick={dismiss} style={{ background: "transparent", border: "none", color: "rgba(232,238,255,0.5)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#00C896", fontWeight: 700 }}>
            Thank you! 🙏
          </div>
        ) : (
          <>
            {/* Rating */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, color: "rgba(232,238,255,0.6)", marginBottom: 8 }}>Rate your experience</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setRating(n)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
                    <Star size={26} color={n <= rating ? "#FBBF24" : "rgba(255,255,255,0.18)"} fill={n <= rating ? "#FBBF24" : "transparent"} />
                  </button>
                ))}
              </div>
            </div>

            {/* NPS */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, color: "rgba(232,238,255,0.6)", marginBottom: 8 }}>
                How likely are you to recommend us? (0-10)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {Array.from({ length: 11 }, (_, i) => i).map(n => (
                  <button key={n} onClick={() => setNps(n)} style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: nps === n ? "#00C896" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${nps === n ? "#00C896" : "rgba(255,255,255,0.08)"}`,
                    color: nps === n ? "#04060F" : "#E8EEFF",
                    fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace",
                  }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Quote */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, color: "rgba(232,238,255,0.6)", marginBottom: 8 }}>
                Optional — leave a short testimonial
              </div>
              <textarea value={quote} onChange={e => setQuote(e.target.value)} rows={3} placeholder="What stood out?" style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "10px 12px", color: "#E8EEFF", fontSize: 13,
                fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical",
              }} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={dismiss} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(232,238,255,0.7)", borderRadius: 10, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Later
              </button>
              <button onClick={submit} disabled={submitting} style={{ background: "#00C896", border: "none", color: "#04060F", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 800, cursor: submitting ? "default" : "pointer", fontFamily: "'DM Sans',sans-serif", opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Sending…" : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
