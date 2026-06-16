import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { paymentsAPI, authAPI } from "../lib/api";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { queryKeys, invalidate } from "../lib/queryClient";
import { useAuth } from "../contexts/AuthContext";
import { Reveal } from "../components/Reveal";
import { Tilt } from "../components/Tilt";
import { useToast } from "@/hooks/use-toast";
import { Check, CreditCard, Clock, ChevronRight, Zap, Shield, Bot, Globe, Activity } from "lucide-react";

// Plan base definitions — prices loaded dynamically from backend per region
const PLAN_DEFS = [
  {
    id: "trial", name: "3-Day Trial", color: "#94A3B8",
    features: ["5 workflows (trial total)", "1,000 events (trial total)", "2 video generations", "1 basic AI agent", "Community support", "Watermark applied"],
    icon: "🌱",
  },
  {
    id: "basic", name: "Basic", color: "#38BDF8",
    features: ["20 active workflows", "25K events/month", "10 video jobs/month", "3 AI agents", "Email support", "Watermark applied"],
    icon: "⚡",
  },
  {
    id: "pro", name: "Pro", color: "#00C896",
    features: ["Unlimited workflows", "100K events/month", "30 video jobs/month", "10 AI agents", "Priority support", "No watermark"],
    icon: "🚀", popular: true,
  },
  {
    id: "business", name: "Business", color: "#A78BFA",
    features: ["Unlimited everything", "1M events/month", "60 video jobs/month", "Unlimited AI agents", "24/7 support", "SLA guarantee", "No watermark"],
    icon: "💎",
  },
];

function PaymentModal({ plan, onClose, onSuccess }: any) {
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep]     = useState<'confirm' | 'redirecting'>('confirm');
  const { toast }           = useToast();
  const { user }            = useAuth();

  const isPaystack = plan.provider === 'paystack';
  const providerLabel = isPaystack ? 'Paystack' : 'Card (Stripe)';

  const initPayment = async () => {
    setLoading(true);
    try {
      // Backend computes the correct amount from plan + currency server-side
      const res: any = await paymentsAPI.initialize({
        plan:     plan.id,
        currency: plan.currency,
        provider: plan.provider,
        email:    email || user?.email,
      });

      if (res?.authorization_url) {
        setStep('redirecting');
        // Small delay so user sees the redirecting state
        setTimeout(() => {
          window.location.href = res.authorization_url;
        }, 600);
      } else {
        throw new Error('No payment URL received from server');
      }
    } catch (e: any) {
      toast({ title: 'Payment error', description: e?.message || 'Could not start payment. Please try again.', variant: 'destructive' });
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 24 }}>
      <div className="af-glass" style={{ borderRadius: 20, padding: '32px', maxWidth: 440, width: '100%', position: 'relative', border: `1px solid ${plan.color}30` }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: '20px 20px 0 0', background: `linear-gradient(90deg, transparent, ${plan.color}, transparent)` }} />

        {step === 'redirecting' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#E8EEFF', fontFamily: "'Syne',sans-serif" }}>
              Redirecting to {providerLabel}…
            </p>
            <p style={{ fontSize: 13, color: 'rgba(232,238,255,0.4)', marginTop: 8 }}>
              Complete your payment on the {providerLabel} page. You'll be brought back automatically.
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{plan.icon}</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: '#E8EEFF' }}>Upgrade to {plan.name}</h2>
              <p style={{ fontSize: 28, fontWeight: 900, color: plan.color, fontFamily: "'Syne',sans-serif", marginTop: 8 }}>
                {plan.priceLabel}<span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(232,238,255,0.4)' }}>{plan.period}</span>
              </p>
              <p style={{ fontSize: 11, color: 'rgba(232,238,255,0.35)', fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                via {providerLabel} · {plan.currency}
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(232,238,255,0.5)', fontFamily: "'DM Mono',monospace", letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>Email for receipt</label>
              <input
                data-testid="input-payment-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={user?.email || 'your@email.com'}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '11px 14px', color: '#E8EEFF', fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '11px', color: 'rgba(232,238,255,0.5)', fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                Cancel
              </button>
              <button
                data-testid="button-pay"
                onClick={initPayment}
                disabled={loading}
                style={{ flex: 2, background: plan.color, border: 'none', borderRadius: 10, padding: '11px', color: '#04060F', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}
              >
                <CreditCard size={15} /> {loading ? 'Please wait…' : `Pay with ${providerLabel}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
    const payment    = params.get('payment');
    const reference  = params.get('reference');
    const provider   = params.get('provider') || 'paystack';
    const session_id = params.get('session_id');

    if (payment === 'verify' && reference) {
      // Clean the URL immediately so a refresh doesn't re-trigger
      window.history.replaceState({}, '', '/plans');

      paymentsAPI.verify({ reference, provider, ...(session_id ? { session_id } : {}) })
        .then((res: any) => {
          if (res?.status === 'success') {
            toast({ title: '🎉 Plan activated!', description: `You're now on the ${res.plan} plan.` });
            invalidate.user();
            refreshUser();
          } else {
            toast({ title: 'Verification pending', description: 'Payment received — your plan will activate shortly.', variant: 'destructive' });
          }
        })
        .catch(() => {
          toast({ title: 'Could not verify', description: 'Contact support if your plan has not been activated within a few minutes.', variant: 'destructive' });
        });
    }

    if (payment === 'cancelled') {
      window.history.replaceState({}, '', '/plans');
      toast({ title: 'Payment cancelled', description: 'No charge was made.', variant: 'destructive' });
    }
  }, []);

  // Geo-detect on mount, then fetch regional pricing + provider
  useEffect(() => {
    async function detectAndLoad() {
      try {
        const geoRes = await fetch('/api/geo/detect');
        const geoData = await geoRes.json();
        setGeo(geoData);

        const planRes = await fetch(`/api/billing/plans?region=${geoData.country_code}`).catch(() => null);
        if (planRes?.ok) {
          const planData = await planRes.json();
          if (planData?.plans?.length) {
            // Attach provider + currency to every plan for use in PaymentModal
            const enriched = planData.plans.map((p: any) => ({
              ...p,
              provider: planData.provider || 'paystack',
              currency: planData.currency  || planData.plans[0]?.currency || 'NGN',
            }));
            setRegionalPlans(enriched);
            return;
          }
        }
      } catch { /* use static fallback — PaymentModal falls back gracefully */ }
    }
    detectAndLoad();
  }, []);

  // Build PLANS with regional prices, provider and currency for checkout
  const PLANS = PLAN_DEFS.map(def => {
    const regional = regionalPlans.find((p: any) => p.id === def.id);
    let priceLabel: string;
    let period: string;
    const currency = regional?.currency || 'NGN';
    const provider = regional?.provider || 'paystack';

    if (def.id === 'trial') {
      priceLabel = '3-Day Trial';
      period     = '';
    } else if (regional) {
      priceLabel = new Intl.NumberFormat(undefined, {
        style: 'currency', currency, maximumFractionDigits: 0,
      }).format(regional.monthly_price);
      period = '/month';
    } else {
      priceLabel = '—';
      period     = '';
    }

    return { ...def, priceLabel, period, currency, provider };
  });

  const currentPlan = (user as any)?.plan || "trial";

  return (
    <PageTransition variant="slide">
    <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto" }}>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 10 }}>PRICING & PLANS</div>
          <h1 style={{ fontSize: "clamp(2rem,3.5vw,2.8rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", marginBottom: 12 }}>Choose your plan</h1>
          <p style={{ fontSize: 15, color: "rgba(232,238,255,0.4)", maxWidth: 500, margin: "0 auto" }}>Scale your automation with a plan built for your needs. Upgrade, downgrade, or cancel anytime.</p>
          {currentPlan && <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 100, padding: "6px 16px", marginTop: 16, fontSize: 12, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C896", display: "inline-block", animation: "glw 2s ease infinite" }} />
            Current: {currentPlan.toUpperCase()}
          </div>}
        </div>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 20, marginBottom: 56 }}>
        {PLANS.map((plan, i) => {
          const isCurrent  = currentPlan === plan.id;
          const isPopular  = plan.popular;
          return (
            <Reveal key={plan.id} delay={i * 60}>
              <Tilt max={4}>
                <div style={{ borderRadius: 20, padding: "28px 22px", position: "relative", overflow: "hidden", background: isPopular ? "rgba(12,17,32,0.95)" : "rgba(8,11,22,0.72)", backdropFilter: "blur(20px)", border: `1.5px solid ${isCurrent ? plan.color : isPopular ? `${plan.color}40` : "rgba(255,255,255,0.07)"}`, boxShadow: isPopular ? `0 0 60px ${plan.color}18` : undefined, height: "100%" }}>
                  {isPopular && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${plan.color}, transparent)` }} />}
                  {isCurrent && <div style={{ position: "absolute", top: 14, right: 14, fontSize: 9, fontWeight: 800, color: "#04060F", background: plan.color, borderRadius: 100, padding: "3px 8px", fontFamily: "'DM Mono',monospace" }}>YOUR PLAN</div>}
                  {isPopular && !isCurrent && <div style={{ position: "absolute", top: 14, right: 14, fontSize: 9, fontWeight: 800, color: "#04060F", background: plan.color, borderRadius: 100, padding: "3px 8px", fontFamily: "'DM Mono',monospace" }}>POPULAR</div>}
                  <div style={{ fontSize: 30, marginBottom: 12 }}>{plan.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: plan.color, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8 }}>{plan.name.toUpperCase()}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
                    <span style={{ fontSize: "2rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>{plan.priceLabel}</span>
                    {plan.period && <span style={{ fontSize: 13, color: "rgba(232,238,255,0.35)" }}>{plan.period}</span>}
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, marginBottom: 24 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13, color: "rgba(232,238,255,0.65)" }}>
                        <Check size={13} color={plan.color} style={{ flexShrink: 0 }} /> {f}
                      </li>
                    ))}
                  </ul>
                  <button data-testid={`plan-select-${plan.id}`} disabled={isCurrent} onClick={() => !isCurrent && setSelectedPlan(plan)} style={{ width: "100%", background: isCurrent ? "rgba(255,255,255,0.04)" : isPopular ? plan.color : `${plan.color}18`, border: `1px solid ${isCurrent ? "rgba(255,255,255,0.07)" : `${plan.color}40`}`, borderRadius: 12, padding: "11px 0", color: isCurrent ? "rgba(232,238,255,0.4)" : isPopular ? "#04060F" : plan.color, fontSize: 13, fontWeight: 700, cursor: isCurrent ? "default" : "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.18s" }}>
                    {isCurrent ? "Current plan" : plan.id === "trial" ? "Start your 3-day free trial" : <><ChevronRight size={14} /> Upgrade</>}
                  </button>
                </div>
              </Tilt>
            </Reveal>
          );
        })}
      </div>

      {regionalPlans.length === 0 && (
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace" }}>
          Pricing unavailable — <a href="mailto:support@autoflowng.com" style={{ color: "#00C896" }}>contact support</a> for current rates.
        </div>
      )}

      {/* Payment history */}
      {(history as any[]).length > 0 && (
        <Reveal delay={100}>
          <div className="af-glass" style={{ borderRadius: 18, padding: "24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 20 }}>Payment History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(history as any[]).slice(0, 10).map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10 }}>
                  <CreditCard size={14} color="rgba(232,238,255,0.3)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF" }}>{p.plan || p.description || "Plan payment"}</div>
                    <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#00C896' }}>
                    {new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency || 'NGN', maximumFractionDigits: 0 }).format(p.amount || 0)}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: p.status === "success" ? "#00C896" : "#FBBF24", background: p.status === "success" ? "rgba(0,200,150,0.1)" : "rgba(251,191,36,0.1)", borderRadius: 100, padding: "2px 8px", fontFamily: "'DM Mono',monospace" }}>{(p.status || "pending").toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {selectedPlan && <PaymentModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} onSuccess={() => { setSelectedPlan(null); invalidate.user(); refreshUser(); }} />}
    </div>
    </PageTransition>
  );
}
