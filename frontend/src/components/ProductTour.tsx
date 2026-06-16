/**
 * ProductTour — Phase 3A
 * Lightweight coach-mark overlay. Reads/writes /api/onboarding/state.
 * Mounted once in AppShell — renders nothing once completed/skipped
 * unless a window 'autoflowng:replayTour' event resets it.
 */
import { useEffect, useState, useCallback } from "react";
import { onboardingAPI, tokenStore } from "../lib/api";
import { X, ArrowRight, Sparkles } from "lucide-react";

type Step = {
  selector?: string; // CSS selector for anchor; falls back to centered card
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome to AutoFlowNG",
    body:  "Take 30 seconds to learn the essentials. You can skip or replay this tour anytime.",
  },
  {
    selector: "[data-tour='sidebar-nav']",
    title: "Navigation",
    body:  "Use the sidebar to switch between Workflows, Automations, AI tools, Connections and more.",
  },
  {
    selector: "[data-tour='notification-bell']",
    title: "Notifications",
    body:  "Critical alerts, run failures and admin updates surface here in real time.",
  },
  {
    selector: "[data-tour='upgrade-button'], a[href='/plans']",
    title: "Plans & Billing",
    body:  "Upgrade your plan to unlock more runs, providers and enterprise features.",
  },
  {
    title: "You're all set",
    body:  "Create your first workflow when you're ready. You can replay this tour from the sidebar.",
  },
];

function anchorRect(selector?: string): DOMRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  return el.getBoundingClientRect();
}

export default function ProductTour() {
  const [step, setStep]   = useState(0);
  const [show, setShow]   = useState(false);
  const [ready, setReady] = useState(false);
  const [, force] = useState(0);

  // Re-position on scroll/resize.
  useEffect(() => {
    if (!show) return;
    const tick = () => force(x => x + 1);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", tick);
    };
  }, [show]);

  const loadState = useCallback(async () => {
    if (!tokenStore.exists()) { setShow(false); setReady(true); return; }
    try {
      const s: any = await onboardingAPI.get();
      if (s?.tour_completed || s?.tour_skipped) {
        setShow(false);
      } else {
        setStep(Number.isFinite(s?.current_step) ? Math.max(0, Math.min(s.current_step, STEPS.length - 1)) : 0);
        setShow(true);
      }
    } catch {
      setShow(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  // Public replay trigger.
  useEffect(() => {
    const onReplay = async () => {
      try {
        await onboardingAPI.patch({ current_step: 0, tour_completed: false, tour_skipped: false });
      } catch { /* ignore */ }
      setStep(0); setShow(true);
    };
    window.addEventListener("autoflowng:replayTour", onReplay);
    return () => window.removeEventListener("autoflowng:replayTour", onReplay);
  }, []);

  async function persistStep(next: number) {
    try { await onboardingAPI.patch({ current_step: next }); } catch { /* ignore */ }
  }

  async function skip() {
    setShow(false);
    try { await onboardingAPI.patch({ tour_skipped: true }); } catch { /* ignore */ }
  }

  async function next() {
    if (step >= STEPS.length - 1) {
      setShow(false);
      try { await onboardingAPI.patch({ tour_completed: true, current_step: STEPS.length - 1 }); } catch { /* ignore */ }
      return;
    }
    const n = step + 1;
    setStep(n);
    persistStep(n);
  }

  if (!ready || !show) return null;
  const current = STEPS[step];
  const rect = anchorRect(current.selector);

  // Card position: near anchor or centered.
  const CARD_W = 320;
  const CARD_H = 170;
  let top: number, left: number;
  if (rect) {
    top  = Math.min(window.innerHeight - CARD_H - 16, Math.max(16, rect.bottom + 12));
    left = Math.min(window.innerWidth  - CARD_W - 16, Math.max(16, rect.left));
  } else {
    top  = Math.max(16, window.innerHeight / 2 - CARD_H / 2);
    left = Math.max(16, window.innerWidth  / 2 - CARD_W / 2);
  }

  return (
    <>
      {/* Dim backdrop */}
      <div
        onClick={skip}
        style={{
          position: "fixed", inset: 0, background: "rgba(4,6,15,0.55)", zIndex: 9000,
        }}
      />

      {/* Highlight ring */}
      {rect && (
        <div
          style={{
            position: "fixed",
            top:  rect.top - 6, left: rect.left - 6,
            width:  rect.width  + 12, height: rect.height + 12,
            border: "2px solid #00C896", borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(4,6,15,0.55), 0 0 0 4px rgba(0,200,150,0.25)",
            pointerEvents: "none", zIndex: 9001, transition: "all 0.18s",
          }}
        />
      )}

      {/* Card */}
      <div
        role="dialog"
        aria-label="Product tour"
        style={{
          position: "fixed", top, left, width: CARD_W,
          background: "#0B0F1F", border: "1px solid rgba(0,200,150,0.25)",
          borderRadius: 14, padding: 18, zIndex: 9002,
          color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#00C896", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>
            <Sparkles size={12} /> STEP {step + 1} / {STEPS.length}
          </div>
          <button onClick={skip} aria-label="Skip tour" style={{
            background: "transparent", border: "none", color: "rgba(232,238,255,0.45)",
            cursor: "pointer", padding: 4, display: "flex",
          }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
          {current.title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(232,238,255,0.75)", marginBottom: 14 }}>
          {current.body}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={skip} style={{
            background: "transparent", border: "none", color: "rgba(232,238,255,0.5)",
            fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace",
          }}>
            Skip
          </button>
          <button onClick={next} style={{
            background: "rgba(0,200,150,0.12)", border: "1px solid rgba(0,200,150,0.3)",
            color: "#00C896", borderRadius: 10, padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 6,
            fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace",
          }}>
            {step >= STEPS.length - 1 ? "Finish" : "Next"} <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </>
  );
}
