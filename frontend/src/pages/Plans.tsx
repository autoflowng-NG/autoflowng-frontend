/**
 * Plans — Enterprise Redesign
 *
 * All existing hooks, API calls, mutations, and logic preserved exactly.
 * Only the visual layer has changed.
 *
 * New visual features:
 *   - DM Mono section label + Syne page title + subtitle
 *   - Stat pills row: Current Plan · Region · Payment History count
 *   - Plan cards with top accent line, icon container, feature list
 *   - Popular badge + YOUR PLAN badge
 *   - Payment modal: glassmorphism overlay, colour-matched accent
 *   - Payment history table with status badges
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { paymentsAPI, authAPI, geoAPI } from "../lib/api";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { queryKeys, invalidate } from "../lib/queryClient";
import { useAuth } from "../contexts/AuthContext";
import { Reveal } from "../components/Reveal";
import { Tilt } from "../components/Tilt";
import { useToast } from "@/hooks/use-toast";
import {
  Check, CreditCard, Clock, ChevronRight, Zap, Shield, Bot, Globe, Activity,
  TrendingUp, Star, ArrowUpRight, Sparkles,
} from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:       "#060810",
  surface:  "#0C0F1A",
  raised:   "#111520",
  border:   "rgba(255,255,255,0.06)",
  borderHv: "rgba(255,255,255,0.11)",
  text:     "#E2E8FF",
  muted:    "rgba(226,232,255,0.45)",
  faint:    "rgba(226,232,255,0.22)",
  green:    "#00C896",
  blue:     "#38BDF8",
  purple:   "#A78BFA",
  amber:    "#FBBF24",
  red:      "#FB7185",
};

/* ── Skeleton ──────────────────────────────────────────────────────── */
function Sk({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "rgba(255,255,255,0.05)",
      animation: "af-plans-pulse 1.8s ease-in-out infinite",
    }} />
  );
}

/* ── Card wrapper ──────────────────────────────────────────────────── */
function Card({ children, style = {}, accent }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
}) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 20,
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>
      {accent && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
        }} />
      )}
      {children}
    </div>
  );
}

/* ── Stat pill ─────────────────────────────────────────────────────── */
function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "10px 16px",
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: color, boxShadow: `0 0 6px ${color}80`,
        flexShrink: 0,
      }} />
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: C.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", letterSpacing: "0.05em", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// Plan base definitions — prices loaded dynamically from backend per region
const PLAN_DEFS = [
  {
    id: "trial", name: "3-Day Trial", color: "#94A3B8",
    features: ["2 workflows (trial total)", "200 events (trial total)", "1 video job (trial total)", "5 image jobs (trial total)", "Community support", "Watermark applied"],
    icon: Zap,
  },
  {
    id: "basic", name: "Basic", color: "#38BDF8",
    features: ["10 active workflows", "2,000 events/month", "5 video jobs/month", "30 images/month", "Content/Creative AI agents", "Email support", "Watermark applied"],
    icon: Activity,
  },
  {
    id: "pro", name: "Pro", color: "#00C896",
    features: ["15 active workflows", "5,000 events/month", "15 video jobs/month", "100 images/month", "Content/Creative + Campaign/Marketing AI agents", "Priority support", "No watermark"],
    icon: Shield, popular: true,
  },
  {
    id: "business", name: "Business", color: "#A78BFA",
    features: ["30 active workflows", "10,000 events/month", "25 video jobs/month", "300 images/month", "All AI agent categories (incl. Business-Department agents)", "24/7 support", "SLA guarantee", "No watermark"],
    icon: Bot,
  },
];

/* ── Payment Modal ─────────────────────────────────────────────────── */
function PaymentModal({ plan, onClose, onSuccess }: any) {
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep]     = useState<"confirm" | "redirecting">("confirm");
  const { toast }           = useToast();
  const { user }            = useAuth();

  const isPaystack    = plan.provider === "paystack";
  const providerLabel = isPaystack ? "Paystack" : "Card (Stripe)";

  const initPayment = async () => {
    setLoading(true);
    try {
      const res: any = await paymentsAPI.initialize({
        plan:     plan.id,
        currency: plan.currency,
        provider: plan.provider,
        email:    email || user?.email,
      });

      if (res?.authorization_url) {
        setStep("redirecting");
        setTimeout(() => { window.location.href = res.authorization_url; }, 600);
      } else if (res?.reference && (window as any).PaystackPop) {
        setStep("redirecting");
        const handler = (window as any).PaystackPop.setup({
          key:       (window as any).__PAYSTACK_PUBLIC_KEY__ || "",
          email:     email || user?.email,
          amount:    res.amount * 100,
          currency:  res.currency || "NGN",
          ref:       res.reference,
          onSuccess: () => { onSuccess?.(); },
          onCancel:  () => { setStep("confirm"); setLoading(false); },
        });
        handler.openIframe();
      } else if (res?.reference) {
        setStep("redirecting");
        setTimeout(() => { window.location.href = `https://checkout.paystack.com/${res.reference}`; }, 600);
      } else {
        throw new Error("No payment URL received from server. Please try again.");
      }
    } catch (e: any) {
      toast({ title: "Payment error", description: e?.message || "Could not start payment. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 999, padding: 24,
    }}>
      <div style={{
        background: C.surface,
        border: `1px solid ${plan.color}30`,
        borderRadius: 20, padding: 32,
        maxWidth: 440, width: "100%",
        position: "relative", overflow: "hidden",
      }}>
        {/* top accent */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${plan.color}, transparent)`,
        }} />

        {step === "redirecting" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: `${plan.color}15`, border: `1px solid ${plan.color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              animation: "af-plans-spin 1.2s linear infinite",
            }}>
              <CreditCard size={22} color={plan.color} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "'Syne',sans-serif" }}>
              Redirecting to {providerLabel}…
            </p>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 8, fontFamily: "'DM Sans',sans-serif" }}>
              Complete your payment on the {providerLabel} page. You'll be brought back automatically.
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: `${plan.color}15`, border: `1px solid ${plan.color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                {plan.icon && <plan.icon size={24} color={plan.color} />}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: C.text, marginBottom: 6 }}>
                Upgrade to {plan.name}
              </h2>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: plan.color, fontFamily: "'Syne',sans-serif" }}>{plan.priceLabel}</span>
                {plan.period && <span style={{ fontSize: 13, color: C.muted }}>{plan.period}</span>}
              </div>
              <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                via {providerLabel} · {plan.currency}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 700, color: C.muted,
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase",
              }}>
                Email for receipt
              </label>
              <input
                data-testid="input-payment-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={user?.email || "your@email.com"}
                style={{
                  width: "100%", background: C.raised,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "11px 14px", color: C.text, fontSize: 14,
                  fontFamily: "'DM Sans',sans-serif", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, background: "transparent",
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "11px", color: C.muted, fontSize: 14,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                data-testid="button-pay"
                onClick={initPayment}
                disabled={loading}
                style={{
                  flex: 2, background: plan.color, border: "none", borderRadius: 10,
                  padding: "11px", color: "#04060F", fontSize: 14, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
                }}
              >
                <CreditCard size={15} />
                {loading ? "Please wait…" : `Pay with ${providerLabel}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────── */
export default function Plans() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [geo, setGeo] = useState<any>(null);
  const [regionalPlans, setRegionalPlans] = useState<any[]>([]);

  const { data: config } = useQuery({ queryKey: queryKeys.paymentConfig, queryFn: () => paymentsAPI.config() });
  const { data: history = [] } = useQuery({ queryKey: queryKeys.payments, queryFn: () => paymentsAPI.history().then((d: any) => d.payments || []) });

  // Auto-verify when returning from Paystack or Stripe redirect
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const payment    = params.get("payment");
    const reference  = params.get("reference");
    const provider   = params.get("provider") || "paystack";
    const session_id = params.get("session_id");

    if (payment === "verify" && reference) {
      window.history.replaceState({}, "", "/plans");
      paymentsAPI.verify({ reference, provider, ...(session_id ? { session_id } : {}) })
        .then((res: any) => {
          if (res?.status === "success") {
            toast({ title: "🎉 Plan activated!", description: `You're now on the ${res.plan} plan.` });
            invalidate.user();
            refreshUser();
          } else {
            toast({ title: "Verification pending", description: "Payment received — your plan will activate shortly.", variant: "destructive" });
          }
        })
        .catch(() => {
          toast({ title: "Could not verify", description: "Contact support if your plan has not been activated within a few minutes.", variant: "destructive" });
        });
    }

    if (payment === "cancelled") {
      window.history.replaceState({}, "", "/plans");
      toast({ title: "Payment cancelled", description: "No charge was made.", variant: "destructive" });
    }
  }, []);

  // Geo-detect on mount, then fetch regional pricing + provider
  useEffect(() => {
    async function detectAndLoad() {
      try {
        const geoData: any = await geoAPI.detect();
        setGeo(geoData);
        const planData: any = await paymentsAPI.billingPlans(geoData?.country_code).catch(() => null);
        if (planData?.plans?.length) {
          const enriched = planData.plans.map((p: any) => ({
            ...p,
            provider: planData.provider || "paystack",
            currency: planData.currency || planData.plans[0]?.currency || "NGN",
          }));
          setRegionalPlans(enriched);
        }
      } catch { /* use static fallback */ }
    }
    detectAndLoad();
  }, []);

  // Build PLANS with regional prices
  const PLANS = PLAN_DEFS.map(def => {
    const regional = regionalPlans.find((p: any) => p.id === def.id);
    let priceLabel: string;
    let period: string;
    const currency = regional?.currency || "NGN";
    const provider = regional?.provider || "paystack";

    if (def.id === "trial") {
      priceLabel = "Free";
      period     = "3 days";
    } else if (regional) {
      priceLabel = new Intl.NumberFormat(undefined, {
        style: "currency", currency, maximumFractionDigits: 0,
      }).format(regional.monthly_price);
      period = "/month";
    } else {
      priceLabel = "—";
      period     = "";
    }

    return { ...def, priceLabel, period, currency, provider };
  });

  const currentPlan = (user as any)?.plan || "trial";
  const detectedCurrency = regionalPlans[0]?.currency;
  const CURRENCY_NAMES: Record<string, string> = {
    NGN: "Nigerian Naira (NGN)",
    USD: "US Dollar (USD)",
    GBP: "British Pound (GBP)",
    EUR: "Euro (EUR)",
  };

  const historyList = history as any[];

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto", background: C.bg, minHeight: "100vh" }}>

        {/* ── Page header ── */}
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.purple,
              fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 8,
            }}>
              PLATFORM · BILLING
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{
                  fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900,
                  fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em",
                  color: C.text, margin: 0, lineHeight: 1.1,
                }}>
                  Plans & Pricing
                </h1>
                <p style={{ fontSize: 14, color: C.muted, marginTop: 6, fontFamily: "'DM Sans',sans-serif" }}>
                  Scale your automation. Upgrade, downgrade, or cancel anytime.
                </p>
              </div>
              {currentPlan && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)",
                  borderRadius: 100, padding: "7px 16px",
                  fontSize: 11, fontWeight: 700, color: C.green,
                  fontFamily: "'DM Mono',monospace",
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, display: "inline-block", animation: "af-plans-glow 2s ease infinite" }} />
                  ACTIVE: {currentPlan.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* ── Stat pills ── */}
        <Reveal delay={40}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 36 }}>
            <StatPill label="CURRENT PLAN" value={currentPlan.toUpperCase()} color={C.purple} />
            <StatPill label="REGION" value={geo?.country_code || "—"} color={C.blue} />
            <StatPill label="PAYMENT HISTORY" value={historyList.length} color={C.green} />
            {detectedCurrency && (
              <StatPill label="CURRENCY" value={detectedCurrency} color={C.amber} />
            )}
          </div>
        </Reveal>

        {/* ── Currency note ── */}
        {detectedCurrency && (
          <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace", marginBottom: 24 }}>
            Prices shown in {CURRENCY_NAMES[detectedCurrency] || detectedCurrency}
          </div>
        )}

        {/* ── Plan cards ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 20, marginBottom: 48,
        }}>
          {PLANS.map((plan, i) => {
            const isCurrent = currentPlan === plan.id;
            const isPopular = plan.popular;
            const PlanIcon  = plan.icon;
            return (
              <Reveal key={plan.id} delay={i * 60}>
                <Tilt max={4}>
                  <div style={{
                    background: C.surface,
                    border: `1.5px solid ${isCurrent ? plan.color : isPopular ? `${plan.color}40` : C.border}`,
                    borderRadius: 18, padding: "24px 20px",
                    position: "relative", overflow: "hidden",
                    height: "100%", boxSizing: "border-box",
                    boxShadow: isPopular ? `0 0 40px ${plan.color}14` : undefined,
                    display: "flex", flexDirection: "column",
                  }}>
                    {/* top accent */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 1,
                      background: `linear-gradient(90deg, transparent, ${plan.color}70, transparent)`,
                    }} />

                    {/* badge */}
                    {isCurrent && (
                      <div style={{
                        position: "absolute", top: 14, right: 14,
                        fontSize: 9, fontWeight: 800, color: "#04060F",
                        background: plan.color, borderRadius: 100,
                        padding: "3px 9px", fontFamily: "'DM Mono',monospace",
                      }}>
                        YOUR PLAN
                      </div>
                    )}
                    {isPopular && !isCurrent && (
                      <div style={{
                        position: "absolute", top: 14, right: 14,
                        fontSize: 9, fontWeight: 800, color: "#04060F",
                        background: plan.color, borderRadius: 100,
                        padding: "3px 9px", fontFamily: "'DM Mono',monospace",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <Star size={8} /> POPULAR
                      </div>
                    )}

                    {/* plan icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: `${plan.color}12`,
                      border: `1px solid ${plan.color}28`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 14,
                    }}>
                      <PlanIcon size={18} color={plan.color} />
                    </div>

                    {/* plan name */}
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: plan.color,
                      fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 6,
                    }}>
                      {plan.name.toUpperCase()}
                    </div>

                    {/* price */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
                      <span style={{
                        fontSize: "1.9rem", fontWeight: 900,
                        fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em",
                        color: C.text,
                      }}>
                        {plan.priceLabel}
                      </span>
                      {plan.period && (
                        <span style={{ fontSize: 12, color: C.muted }}>{plan.period}</span>
                      )}
                    </div>

                    {/* divider */}
                    <div style={{ height: 1, background: C.border, marginBottom: 16 }} />

                    {/* features */}
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 20, flex: 1 }}>
                      {plan.features.map(f => (
                        <li key={f} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "5px 0", fontSize: 13, color: C.muted,
                          fontFamily: "'DM Sans',sans-serif",
                        }}>
                          <Check size={12} color={plan.color} style={{ flexShrink: 0 }} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      data-testid={`plan-select-${plan.id}`}
                      disabled={isCurrent}
                      onClick={() => !isCurrent && setSelectedPlan(plan)}
                      style={{
                        width: "100%",
                        background: isCurrent
                          ? "rgba(255,255,255,0.04)"
                          : isPopular
                          ? plan.color
                          : `${plan.color}14`,
                        border: `1px solid ${isCurrent ? C.border : `${plan.color}40`}`,
                        borderRadius: 10, padding: "11px 0",
                        color: isCurrent ? C.faint : isPopular ? "#04060F" : plan.color,
                        fontSize: 13, fontWeight: 700,
                        cursor: isCurrent ? "default" : "pointer",
                        fontFamily: "'DM Sans',sans-serif",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        transition: "all 0.15s",
                      }}
                    >
                      {isCurrent ? (
                        "Current plan"
                      ) : plan.id === "trial" ? (
                        <><Sparkles size={13} /> Start free trial</>
                      ) : (
                        <><ArrowUpRight size={13} /> Upgrade</>
                      )}
                    </button>
                  </div>
                </Tilt>
              </Reveal>
            );
          })}
        </div>

        {/* ── No pricing fallback ── */}
        {regionalPlans.length === 0 && (
          <div style={{
            textAlign: "center", marginBottom: 36, fontSize: 12,
            color: C.faint, fontFamily: "'DM Mono',monospace",
          }}>
            Pricing unavailable —{" "}
            <a href="mailto:support@autoflowng.com" style={{ color: C.green }}>contact support</a>{" "}
            for current rates.
          </div>
        )}

        {/* ── Payment history ── */}
        {historyList.length > 0 && (
          <Reveal delay={100}>
            <Card accent={C.blue} style={{ marginBottom: 24 }}>
              {/* section label */}
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.faint,
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 16,
              }}>
                PAYMENT HISTORY
              </div>

              {/* table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 80px 80px",
                gap: 12, padding: "6px 12px",
                borderBottom: `1px solid ${C.border}`,
                marginBottom: 4,
              }}>
                {["DESCRIPTION", "DATE", "AMOUNT", "STATUS"].map(h => (
                  <div key={h} style={{
                    fontSize: 10, fontWeight: 700, color: C.faint,
                    fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em",
                  }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* rows */}
              {historyList.slice(0, 10).map((p: any, i: number) => {
                const isSuccess = p.status === "success";
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 80px 80px",
                      gap: 12, padding: "11px 12px",
                      borderRadius: 8,
                      transition: "background 0.12s",
                      cursor: "default",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {/* description */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: "rgba(56,189,248,0.08)",
                        border: "1px solid rgba(56,189,248,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <CreditCard size={13} color={C.blue} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
                          {p.plan || p.description || "Plan payment"}
                        </div>
                      </div>
                    </div>

                    {/* date */}
                    <div style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono',monospace", alignSelf: "center" }}>
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                    </div>

                    {/* amount */}
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: C.green,
                      fontFamily: "'Syne',sans-serif", alignSelf: "center",
                    }}>
                      {new Intl.NumberFormat(undefined, {
                        style: "currency", currency: p.currency || "NGN", maximumFractionDigits: 0,
                      }).format(p.amount || 0)}
                    </div>

                    {/* status badge */}
                    <div style={{ alignSelf: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 10, fontWeight: 700,
                        color: isSuccess ? C.green : C.amber,
                        background: isSuccess ? "rgba(0,200,150,0.08)" : "rgba(251,191,36,0.08)",
                        border: `1px solid ${isSuccess ? "rgba(0,200,150,0.2)" : "rgba(251,191,36,0.2)"}`,
                        borderRadius: 100, padding: "3px 9px",
                        fontFamily: "'DM Mono',monospace",
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: isSuccess ? C.green : C.amber,
                        }} />
                        {(p.status || "PENDING").toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </Card>
          </Reveal>
        )}

        {selectedPlan && (
          <PaymentModal
            plan={selectedPlan}
            onClose={() => setSelectedPlan(null)}
            onSuccess={() => { setSelectedPlan(null); invalidate.user(); refreshUser(); }}
          />
        )}

        <style>{`
          @keyframes af-plans-pulse {
            0%,100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          @keyframes af-plans-glow {
            0%,100% { box-shadow: 0 0 6px #00C89680; }
            50% { box-shadow: 0 0 12px #00C896; }
          }
          @keyframes af-plans-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </PageTransition>
  );
}
