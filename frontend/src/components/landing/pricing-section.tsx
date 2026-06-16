"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Check, Zap } from "lucide-react";

// ── Static fallback prices per currency ──────────────────────────────────────
// Used when the /api/billing/plans call fails or returns no data.
const STATIC_FALLBACK: Record<
  string,
  { starter: number; professional: number; symbol: string }
> = {
  // Africa
  NGN: { starter: 0, professional: 30000,  symbol: "₦"   },
  GHS: { starter: 0, professional: 799,    symbol: "GH₵" },
  KES: { starter: 0, professional: 9999,   symbol: "KSh" },
  ZAR: { starter: 0, professional: 1999,   symbol: "R"   },
  UGX: { starter: 0, professional: 249000, symbol: "USh" },
  TZS: { starter: 0, professional: 199000, symbol: "TSh" },
  RWF: { starter: 0, professional: 99000,  symbol: "FRw" },
  XOF: { starter: 0, professional: 49999,  symbol: "CFA" },
  XAF: { starter: 0, professional: 49999,  symbol: "CFA" },
  // Americas
  USD: { starter: 0, professional: 99,     symbol: "$"   },
  CAD: { starter: 0, professional: 135,    symbol: "CA$" },
  // Europe
  GBP: { starter: 0, professional: 79,     symbol: "£"   },
  EUR: { starter: 0, professional: 89,     symbol: "€"   },
  // Asia-Pacific
  AUD: { starter: 0, professional: 149,    symbol: "A$"  },
  INR: { starter: 0, professional: 5499,   symbol: "₹"   },
};

// Annual discount multiplier (20% off monthly)
const ANNUAL_DISCOUNT = 0.8;

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://autoflowng-backend-production-dfa9.up.railway.app";

interface RegionalPlan {
  id: string;
  currency: string;
  monthly_price: number;
  yearly_price: number;
}

const plans = [
  {
    id: "starter",
    name: "Starter",
    description: "For testing and small workflows",
    features: [
      "Up to 5 workflows",
      "1,000 executions/month",
      "Community support",
      "Basic monitoring",
      "Public integrations",
    ],
    cta: "Start free",
    highlight: false,
    isFree: true,
  },
  {
    id: "professional",
    name: "Professional",
    description: "For teams building production workflows",
    features: [
      "Unlimited workflows",
      "100,000 executions/month",
      "Priority support",
      "Advanced monitoring",
      "Private integrations",
      "Team collaboration",
      "Custom automations",
    ],
    cta: "Start trial",
    highlight: true,
    isFree: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large-scale automation needs",
    features: [
      "Unlimited everything",
      "Unlimited executions",
      "24/7 dedicated support",
      "On-premise deployment",
      "SLA guarantee",
      "Custom AI models",
      "Advanced security",
      "Dedicated infrastructure",
    ],
    cta: "Contact sales",
    highlight: false,
    isFree: false,
    isEnterprise: true,
  },
];

function getCurrencyLabel(currency: string): string {
  const map: Record<string, string> = {
    NGN: "Nigerian Naira (₦)",
    GHS: "Ghanaian Cedi (GH₵)",
    KES: "Kenyan Shilling (KSh)",
    ZAR: "South African Rand (R)",
    UGX: "Ugandan Shilling (USh)",
    TZS: "Tanzanian Shilling (TSh)",
    RWF: "Rwandan Franc (FRw)",
    XOF: "CFA Franc",
    XAF: "CFA Franc",
    GBP: "British Pound (£)",
    EUR: "Euro (€)",
    CAD: "Canadian Dollar (CA$)",
    AUD: "Australian Dollar (A$)",
    INR: "Indian Rupee (₹)",
  };
  return map[currency] ?? "US Dollar ($)";
}

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");
  const [regionalPlans, setRegionalPlans] = useState<RegionalPlan[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  // ── Geo-detect then fetch regional pricing ─────────────────────────────────
  useEffect(() => {
    async function detectAndLoad() {
      try {
        const geoRes = await fetch(`${BACKEND_URL}/api/geo/detect`, {
          signal: AbortSignal.timeout(5000),
        });
        const geoData = await geoRes.json();

        if (geoData.currency) setCurrency(geoData.currency);

        const planRes = await fetch(
          `${BACKEND_URL}/api/billing/plans?region=${geoData.country_code}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (planRes.ok) {
          const planData = await planRes.json();
          if (planData?.plans?.length) {
            setRegionalPlans(planData.plans);
            setCurrency(planData.plans[0]?.currency || geoData.currency || "USD");
          }
        }
      } catch {
        // Fall through — getPrice() will use STATIC_FALLBACK
      } finally {
        setIsLoading(false);
      }
    }
    detectAndLoad();
  }, []);

  // ── Scroll visibility ──────────────────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Price resolver ─────────────────────────────────────────────────────────
  function getPrice(planId: string): string | null {
    if (planId === "enterprise") return null; // always "Custom"

    // 1. Live API pricing
    const regional = regionalPlans.find((p) => p.id === planId);
    if (regional) {
      const amount = isAnnual
        ? regional.yearly_price / 12
        : regional.monthly_price;
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: regional.currency,
        maximumFractionDigits: 0,
      }).format(amount);
    }

    // 2. Static fallback
    if (planId === "starter") return "0";

    const fb = STATIC_FALLBACK[currency] ?? STATIC_FALLBACK["USD"];
    const base = fb[planId as "starter" | "professional"];
    if (base == null) return "—";
    const amount = isAnnual ? Math.round(base * ANNUAL_DISCOUNT) : base;
    return `${fb.symbol}${amount.toLocaleString()}`;
  }

  return (
    <section id="pricing" ref={sectionRef} className="relative py-32 lg:py-40">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="grid lg:grid-cols-12 gap-8 mb-20">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-8">
              <span className="w-12 h-px bg-primary/30" />
              Pricing
            </span>
            <h2
              className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              Simple
              <br />
              <span className="text-primary">pricing.</span>
            </h2>

            {/* Currency badge — shown once geo resolves */}
            {!isLoading && currency !== "USD" && (
              <p className="mt-4 text-sm font-mono text-primary/70">
                Showing prices in {getCurrencyLabel(currency)}
              </p>
            )}
          </div>

          <div className="lg:col-span-5 relative p-0 h-96 lg:h-auto">
            <div
              className={`absolute inset-0 pointer-events-none transition-all duration-1000 delay-100 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                src="/images/whale.png"
                alt="Organic whale"
                className="w-full h-full object-contain object-center"
              />
            </div>
          </div>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-start mb-10">
          <div className="inline-flex items-center gap-3 bg-card border border-border rounded-full p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                !isAnnual
                  ? "bg-primary text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                isAnnual
                  ? "bg-primary text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="relative">
          <div className="grid lg:grid-cols-3 gap-4 lg:gap-0">
            {plans.map((plan, index) => (
              <div
                key={plan.name}
                className={`relative bg-background border transition-all duration-700 ${
                  plan.highlight
                    ? "border-primary lg:-mx-2 lg:z-10 lg:scale-105"
                    : "border-primary/10 lg:first:-mr-2 lg:last:-ml-2"
                } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-8 right-8 flex justify-center">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-black text-xs font-mono uppercase tracking-widest">
                      <Zap className="w-3 h-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-8 lg:p-10">
                  {/* Plan header */}
                  <div className="mb-8 pb-8 border-b border-primary/10">
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-2xl lg:text-3xl font-display mt-2">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    {plan.isEnterprise ? (
                      <span className="text-4xl font-display">Custom</span>
                    ) : isLoading ? (
                      <div className="h-14 w-36 bg-muted/30 rounded animate-pulse" />
                    ) : plan.isFree ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl lg:text-6xl font-display">$0</span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl lg:text-6xl font-display">
                            {getPrice(plan.id)}
                          </span>
                          <span className="text-muted-foreground text-sm">/month</span>
                        </div>
                        {isAnnual && (
                          <p className="text-xs text-primary font-mono mt-1">
                            billed annually · save 20%
                          </p>
                        )}
                        {!isAnnual && (
                          <p className="text-xs text-muted-foreground mt-2 font-mono">
                            billed monthly
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-10">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-[#eca8d6] mt-0.5 shrink-0" />
                        <span className="text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                      plan.highlight
                        ? "bg-primary text-black hover:bg-primary/90"
                        : "border border-primary/20 text-primary hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom strip */}
        <div
          className={`mt-20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 pt-12 border-t border-primary/10 transition-all duration-1000 delay-500 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              Secure execution
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              Full audit logs
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              Instant deployment
            </span>
          </div>
          <a
            href="#"
            className="text-sm underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Compare all features
          </a>
        </div>
      </div>

      <style>{`
        .text-stroke {
          -webkit-text-stroke: 1.5px currentColor;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
    </section>
  );
}
