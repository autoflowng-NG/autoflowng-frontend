"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Check, Zap } from "lucide-react";

// ── Country → Currency fallback map ──────────────────────────────────────────
const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", UG: "UGX",
  TZ: "TZS", RW: "RWF", SN: "XOF", CI: "XOF", CM: "XAF",
  GB: "GBP", AU: "AUD", CA: "CAD", IN: "INR",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
  PT: "EUR", BE: "EUR", AT: "EUR", IE: "EUR", FI: "EUR",
};

// ── Static prices — used only when backend is unreachable ─────────────────────
const STATIC_PRICES: Record<string, { basic: number; pro: number; business: number; symbol: string }> = {
  NGN: { basic: 15000,  pro: 30000,   business: 50000,   symbol: "₦"   },
  GHS: { basic: 299,    pro: 799,     business: 1499,    symbol: "GH₵" },
  KES: { basic: 3999,   pro: 9999,    business: 18999,   symbol: "KSh" },
  ZAR: { basic: 699,    pro: 1999,    business: 3799,    symbol: "R"   },
  UGX: { basic: 99000,  pro: 249000,  business: 449000,  symbol: "USh" },
  TZS: { basic: 79000,  pro: 199000,  business: 379000,  symbol: "TSh" },
  RWF: { basic: 39000,  pro: 99000,   business: 189000,  symbol: "FRw" },
  XOF: { basic: 19999,  pro: 49999,   business: 94999,   symbol: "CFA" },
  XAF: { basic: 19999,  pro: 49999,   business: 94999,   symbol: "CFA" },
  GBP: { basic: 39,     pro: 119,     business: 229,     symbol: "£"   },
  EUR: { basic: 45,     pro: 139,     business: 279,     symbol: "€"   },
  CAD: { basic: 67,     pro: 199,     business: 399,     symbol: "CA$" },
  AUD: { basic: 75,     pro: 225,     business: 449,     symbol: "A$"  },
  INR: { basic: 1999,   pro: 5499,    business: 9999,    symbol: "₹"   },
  USD: { basic: 49,     pro: 149,     business: 299,     symbol: "$"   },
};

const CURRENCY_LABEL: Record<string, string> = {
  NGN: "Nigerian Naira (₦)", GHS: "Ghanaian Cedi (GH₵)",
  KES: "Kenyan Shilling (KSh)", ZAR: "South African Rand (R)",
  UGX: "Ugandan Shilling (USh)", TZS: "Tanzanian Shilling (TSh)",
  RWF: "Rwandan Franc (FRw)", XOF: "CFA Franc", XAF: "CFA Franc",
  GBP: "British Pound (£)", EUR: "Euro (€)", CAD: "Canadian Dollar (CA$)",
  AUD: "Australian Dollar (A$)", INR: "Indian Rupee (₹)", USD: "US Dollar ($)",
};

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
    id: "basic",
    name: "Basic",
    description: "For testing and small workflows",
    features: [
      "20 active workflows",
      "25K events/month",
      "5 video jobs/month",
      "3 AI agents",
      "Email support",
    ],
    cta: "Get started",
    highlight: false,
    icon: "⚡",
    color: "#38BDF8",
  },
  {
    id: "pro",
    name: "Pro",
    description: "For teams building production workflows",
    features: [
      "Unlimited workflows",
      "100K events/month",
      "10 video jobs/month",
      "10 AI agents",
      "Priority support",
      "No watermark",
    ],
    cta: "Get started",
    highlight: true,
    icon: "🚀",
    color: "#00C896",
  },
  {
    id: "business",
    name: "Business",
    description: "For large-scale automation needs",
    features: [
      "Unlimited everything",
      "1M events/month",
      "15 video jobs/month",
      "Unlimited AI agents",
      "24/7 support",
      "SLA guarantee",
      "No watermark",
    ],
    cta: "Get started",
    highlight: false,
    icon: "💎",
    color: "#A78BFA",
  },
];

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");
  const [regionalPlans, setRegionalPlans] = useState<RegionalPlan[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  // ── Pricing load: backend first → ipapi.co fallback → static ─────────────
  useEffect(() => {
    async function detectAndLoad() {
      let countryCode = "";
      let detectedCurrency = "";

      // Step 1: Try your backend geo endpoint
      try {
        const geoRes = await fetch(`${BACKEND_URL}/api/geo/detect`, {
          signal: AbortSignal.timeout(5000),
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          countryCode = geoData.country_code || "";
          detectedCurrency = geoData.currency || "";
          if (detectedCurrency) setCurrency(detectedCurrency);
        }
      } catch {
        // Backend geo failed — try ipapi.co below
      }

      // Step 2: If backend geo failed, use ipapi.co
      if (!detectedCurrency) {
        try {
          const ipapiRes = await fetch("https://ipapi.co/json/", {
            signal: AbortSignal.timeout(5000),
          });
          if (ipapiRes.ok) {
            const ipapiData = await ipapiRes.json();
            countryCode = ipapiData.country_code || countryCode;
            detectedCurrency =
              ipapiData.currency ||
              COUNTRY_CURRENCY[countryCode] ||
              "USD";
            if (STATIC_PRICES[detectedCurrency]) {
              setCurrency(detectedCurrency);
            }
          }
        } catch {
          // ipapi also failed — stay on USD
        }
      }

      // Step 3: Try backend billing/plans with the country code we have
      if (countryCode) {
        try {
          const planRes = await fetch(
            `${BACKEND_URL}/api/billing/plans?region=${countryCode}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (planRes.ok) {
            const planData = await planRes.json();
            if (planData?.plans?.length) {
              setRegionalPlans(planData.plans);
              // Backend currency takes highest priority
              const backendCurrency = planData.plans[0]?.currency;
              if (backendCurrency) setCurrency(backendCurrency);
            }
          }
        } catch {
          // Backend plans failed — STATIC_PRICES will be used in getPrice()
        }
      }

      setIsLoading(false);
    }

    detectAndLoad();
  }, []);

  // ── Scroll visibility ─────────────────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Price resolver: backend plans → static fallback ───────────────────────
  function getPrice(planId: "basic" | "pro" | "business"): string {
    // 1. Use live backend pricing if available
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
    const p = STATIC_PRICES[currency] ?? STATIC_PRICES["USD"];
    const base = p[planId];
    const amount = isAnnual ? Math.round(base * 0.8) : base;
    return `${p.symbol}${amount.toLocaleString()}`;
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

            {!isLoading && (
              <p className="mt-4 text-sm font-mono text-primary/70">
                Prices in {CURRENCY_LABEL[currency] ?? "US Dollar ($)"}
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
                !isAnnual ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                isAnnual ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
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
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{plan.icon}</span>
                      <span
                        className="font-mono text-xs tracking-widest uppercase"
                        style={{ color: plan.color }}
                      >
                        {plan.name}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    {isLoading ? (
                      <div className="h-14 w-36 bg-muted/30 rounded animate-pulse" />
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl lg:text-6xl font-display">
                            {getPrice(plan.id as "basic" | "pro" | "business")}
                          </span>
                          <span className="text-muted-foreground text-sm">/mo</span>
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
                        <Check
                          className="w-4 h-4 mt-0.5 shrink-0"
                          style={{ color: plan.color }}
                        />
                        <span className="text-sm text-muted-foreground">{feature}</span>
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
              <Check className="w-4 h-4 text-primary" /> Secure execution
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" /> Full audit logs
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" /> Instant deployment
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            All plans include a 3-day free trial · No credit card required
          </p>
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
