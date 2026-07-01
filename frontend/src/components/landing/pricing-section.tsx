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
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
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
      "10 active workflows",
      "2,000 events/month",
      "5 video jobs/month",
      "30 images/month",
      "Content/Creative AI agents",
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
      "15 active workflows",
      "5,000 events/month",
      "15 video jobs/month",
      "100 images/month",
      "Content/Creative + Campaign/Marketing AI agents",
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
      "30 active workflows",
      "10,000 events/month",
      "25 video jobs/month",
      "300 images/month",
      "All AI agent categories (incl. Business-Department agents)",
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
  const [isAnnual, setIsAnnual] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");
  const [regionalPlans, setRegionalPlans] = useState<RegionalPlan[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    async function detectAndLoad() {
      let countryCode = "";
      let detectedCurrency = "";

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
      } catch {}

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
        } catch {}
      }

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
              const backendCurrency = planData.plans[0]?.currency;
              if (backendCurrency) setCurrency(backendCurrency);
            }
          }
        } catch {}
      }

      setIsLoading(false);
    }

    detectAndLoad();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  function getPrice(planId: "basic" | "pro" | "business"): string {
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
    // Static fallback — always show base monthly price, no discount applied
    const p = STATIC_PRICES[currency] ?? STATIC_PRICES["USD"];
    const base = p[planId];
    return `${p.symbol}${base.toLocaleString()}`;
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

        {/* Pricing cards — items-stretch ensures equal height across all 3 */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 lg:gap-6 items-stretch">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border flex flex-col overflow-visible transition-all duration-700 ${
                plan.highlight
                  ? "border-primary bg-card shadow-[0_0_40px_rgba(0,200,150,0.1)]"
                  : "border-border bg-card/50 hover:border-primary/20"
              } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {/* MOST POPULAR badge — absolutely positioned, never affects card height */}
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold font-mono"
                    style={{ backgroundColor: "#00DC82", color: "#000000" }}
                  >
                    <Zap className="w-3 h-3" />
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* flex-col so features expand and push CTA to bottom */}
              <div className="p-3 md:p-8 flex flex-col flex-1">

                {/* Plan name */}
                <div className="flex items-center gap-1 md:gap-3 mb-1 md:mb-2">
                  <span className="text-base md:text-2xl">{plan.icon}</span>
                  <span
                    className="font-mono text-[10px] md:text-xs tracking-widest uppercase"
                    style={{ color: plan.color }}
                  >
                    {plan.name}
                  </span>
                </div>
                <p className="hidden md:block text-sm text-muted-foreground mb-4">
                  {plan.description}
                </p>

                <div className="border-t border-primary/10 mb-3 md:mb-6" />

                {/* Price */}
                <div className="mb-3 md:mb-6">
                  {isLoading ? (
                    <div className="h-8 md:h-14 w-20 md:w-36 bg-muted/30 rounded animate-pulse" />
                  ) : (
                    <>
                      <div className="flex items-baseline gap-0.5 md:gap-1">
                        <span className="text-lg md:text-4xl lg:text-5xl font-display font-bold text-foreground">
                          {getPrice(plan.id as "basic" | "pro" | "business")}
                        </span>
                        <span className="text-muted-foreground text-[10px] md:text-sm">/mo</span>
                      </div>
                      {isAnnual ? (
                        <p className="text-[10px] md:text-xs text-primary font-mono mt-1">
                          billed annually · save 20%
                        </p>
                      ) : (
                        <p className="text-[10px] md:text-xs text-muted-foreground font-mono mt-1">
                          billed monthly
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Features — flex-1 so this section grows, pushing CTA down */}
                <ul className="space-y-1 md:space-y-3 flex-1 mb-4 md:mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1 md:gap-2.5">
                      <Check
                        className="w-3 h-3 md:w-4 md:h-4 mt-0.5 shrink-0"
                        style={{ color: plan.color }}
                      />
                      <span className="text-[10px] md:text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA — pinned to bottom of every card at the same level */}
                <button
                  className={`w-full py-2 md:py-4 rounded-xl flex items-center justify-center gap-1 md:gap-2 text-[10px] md:text-sm font-semibold transition-all group ${
                    plan.highlight
                      ? "hover:opacity-90"
                      : "border border-primary/20 text-primary hover:border-primary hover:bg-primary/5"
                  }`}
                  style={
                    plan.highlight
                      ? { backgroundColor: "#00DC82", color: "#000000" }
                      : undefined
                  }
                >
                  {plan.cta}
                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ))}
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
    </section>
  );
}
