import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Zap } from "lucide-react";

const PLAN_DEFS = [
  {
    id: "basic",
    name: "Basic",
    color: "#38BDF8",
    features: ["20 active workflows", "25K events/month", "10 video jobs/month", "3 AI agents", "Email support"],
    icon: "⚡",
  },
  {
    id: "pro",
    name: "Pro",
    color: "#00C896",
    features: ["Unlimited workflows", "100K events/month", "30 video jobs/month", "10 AI agents", "Priority support", "No watermark"],
    icon: "🚀",
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    color: "#A78BFA",
    features: ["Unlimited everything", "1M events/month", "60 video jobs/month", "Unlimited AI agents", "24/7 support", "SLA guarantee", "No watermark"],
    icon: "💎",
  },
];

const NGN_PRICES: Record<string, number> = {
  basic: 15000,
  pro: 30000,
  business: 50000,
};

interface RegionalPlan {
  id: string;
  currency: string;
  monthly_price: number;
  yearly_price: number;
}

const BACKEND_URL = import.meta.env.VITE_API_URL || "https://autoflowng-backend-production-dfa9.up.railway.app";

export function PricingSection() {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [regionalPlans, setRegionalPlans] = useState<RegionalPlan[]>([]);
  const [currency, setCurrency] = useState("NGN");
  const [isLoading, setIsLoading] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  // Geo-detect and fetch regional pricing
  useEffect(() => {
    async function detectAndLoad() {
      try {
        const geoRes = await fetch(`${BACKEND_URL}/api/geo/detect`, { signal: AbortSignal.timeout(5000) });
        const geoData = await geoRes.json();
        const planRes = await fetch(`${BACKEND_URL}/api/billing/plans?region=${geoData.country_code}`, { signal: AbortSignal.timeout(5000) });
        if (planRes.ok) {
          const planData = await planRes.json();
          if (planData?.plans?.length) {
            setRegionalPlans(planData.plans);
            setCurrency(planData.plans[0]?.currency || "NGN");
          }
        }
      } catch {
        // Use NGN fallback silently
      } finally {
        setIsLoading(false);
      }
    }
    detectAndLoad();
  }, []);

  // Scroll visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  function getPrice(planId: string): string {
    const regional = regionalPlans.find(p => p.id === planId);
    if (regional) {
      const amount = isAnnual ? regional.yearly_price / 12 : regional.monthly_price;
      return new Intl.NumberFormat(undefined, {
        style: "currency", currency: regional.currency, maximumFractionDigits: 0,
      }).format(amount);
    }
    // NGN fallback
    const ngn = NGN_PRICES[planId];
    if (!ngn) return "—";
    const amount = isAnnual ? Math.round(ngn * 10 * 0.8) / 10 : ngn;
    return `₦${amount.toLocaleString()}`;
  }

  return (
    <section
      id="pricing"
      ref={sectionRef}
      className="relative py-32 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,200,150,0.05),transparent_70%)]" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 lg:px-8">
        {/* Header */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <p className="text-xs font-mono text-primary tracking-[0.2em] uppercase mb-4">Pricing</p>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
            Start free, scale as you grow. Prices shown in {currency === "NGN" ? "Nigerian Naira (₦)" : currency}.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 bg-card border border-border rounded-full p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!isAnnual ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${isAnnual ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
            >
              Annual
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">-20%</span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLAN_DEFS.map((plan, i) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border transition-all duration-700 flex flex-col ${
                plan.popular
                  ? "border-primary/40 bg-card shadow-[0_0_40px_rgba(0,200,150,0.1)]"
                  : "border-border bg-card/50 hover:border-primary/20"
              } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 100 + 200}ms` }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-black text-xs font-bold px-3 py-1 rounded-full font-mono flex items-center gap-1">
                    <Zap className="w-3 h-3" /> MOST POPULAR
                  </span>
                </div>
              )}

              <div className="p-8 flex-1">
                {/* Plan header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-2xl">{plan.icon}</div>
                  <div>
                    <p className="text-xs font-mono tracking-widest uppercase" style={{ color: plan.color }}>
                      {plan.name}
                    </p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {isLoading ? (
                    <div className="h-10 w-28 bg-muted/30 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold text-foreground font-display">
                        {getPrice(plan.id)}
                      </span>
                      <span className="text-muted-foreground text-sm mb-1">/mo</span>
                    </div>
                  )}
                  {isAnnual && (
                    <p className="text-xs text-primary font-mono mt-1">Billed annually · Save 20%</p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: plan.color }} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="p-8 pt-0">
                <button
                  onClick={() => navigate("/register")}
                  className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all group ${
                    plan.popular
                      ? "bg-primary text-black hover:bg-primary/90"
                      : "border border-primary/20 text-primary hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  Get started
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground font-mono mt-10">
          All plans include a 7-day free trial · No credit card required
        </p>
      </div>
    </section>
  );
}
