"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Zap } from "lucide-react";

const PLAN_DEFS = [
  {
    id: "basic",
    name: "Basic",
    color: "#38BDF8",
    features: [
      "20 active workflows",
      "25K events/month",
      "5 video jobs/month",
      "3 AI agents",
      "Email support",
    ],
    icon: "⚡",
  },
  {
    id: "pro",
    name: "Pro",
    color: "#00C896",
    features: [
      "Unlimited workflows",
      "100K events/month",
      "10 video jobs/month",
      "10 AI agents",
      "Priority support",
      "No watermark",
    ],
    icon: "🚀",
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    color: "#A78BFA",
    features: [
      "Unlimited everything",
      "1M events/month",
      "15 video jobs/month",
      "Unlimited AI agents",
      "24/7 support",
      "SLA guarantee",
      "No watermark",
    ],
    icon: "💎",
  },
];

// Static fallback prices per currency — mirrors backend staticPricing.
// Used only when the /api/billing/plans call fails.
const STATIC_FALLBACK: Record<
  string,
  { basic: number; pro: number; business: number; symbol: string }
> = {
  // Africa
  NGN: { basic: 15000,  pro: 30000,   business: 50000,   symbol: "₦"    },
  GHS: { basic: 299,    pro: 799,     business: 1499,    symbol: "GH₵"  },
  KES: { basic: 3999,   pro: 9999,    business: 18999,   symbol: "KSh"  },
  ZAR: { basic: 699,    pro: 1999,    business: 3799,    symbol: "R"    },
  UGX: { basic: 99000,  pro: 249000,  business: 449000,  symbol: "USh"  },
  TZS: { basic: 79000,  pro: 199000,  business: 379000,  symbol: "TSh"  },
  RWF: { basic: 39000,  pro: 99000,   business: 189000,  symbol: "FRw"  },
  XOF: { basic: 19999,  pro: 49999,   business: 94999,   symbol: "CFA"  },
  XAF: { basic: 19999,  pro: 49999,   business: 94999,   symbol: "CFA"  },
  // Americas
  USD: { basic: 49,     pro: 149,     business: 299,     symbol: "$"    },
  CAD: { basic: 67,     pro: 199,     business: 399,     symbol: "CA$"  },
  // Europe
  GBP: { basic: 39,     pro: 119,     business: 229,     symbol: "£"    },
  EUR: { basic: 45,     pro: 139,     business: 279,     symbol: "€"    },
  // Asia-Pacific
  AUD: { basic: 75,     pro: 225,     business: 449,     symbol: "A$"   },
  INR: { basic: 1999,   pro: 5499,    business: 9999,    symbol: "₹"    },
};

interface RegionalPlan {
  id: string;
  currency: string;
  monthly_price: number;
  yearly_price: number;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://autoflowng-backend-production-dfa9.up.railway.app";

export function PricingSection() {
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [regionalPlans, setRegionalPlans] = useState<RegionalPlan[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [isLoading, setIsLoading] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  // Geo-detect then fetch regional pricing
  useEffect(() => {
    async function detectAndLoad() {
      try {
        const geoRes = await fetch(`${BACKEND_URL}/api/geo/detect`, {
          signal: AbortSignal.timeout(5000),
        });
        const geoData = await geoRes.json();

        // Set currency from geo immediately so fallback renders the right currency
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
        // Silently fall through — getPrice() will use STATIC_FALLBACK
      } finally {
        setIsLoading(false);
      }
    }
    detectAndLoad();
  }, []);

  // Scroll visibility
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

  function getPrice(planId: string): string {
    // 1. Use live API pricing if available
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

    // 2. Static fallback — use detected currency, default to USD
    const fb = STATIC_FALLBACK[currency] ?? STATIC_FALLBACK["USD"];
    const base = fb[planId as "basic" | "pro" | "business"];
    if (!base) return "—";
    const amount = isAnnual ? Math.round(base * 10 * 0.8) / 10 : base;
    return `${fb.symbol}${amount.toLocaleString()}`;
  }

  const currencyLabel =
    currency === "NGN"
      ? "Nigerian Naira (₦)"
      : currency === "GHS"
      ? "Ghanaian Cedi (GH₵)"
      : currency === "KES"
      ? "Kenyan Shilling (KSh)"
      : currency === "ZAR"
      ? "South African Rand (R)"
      : currency === "UGX"
      ? "Ugandan Shilling (USh)"
      : currency === "TZS"
      ? "Tanzanian Shilling (TSh)"
      : currency === "RWF"
      ? "Rwandan Franc (FRw)"
      : currency === "XOF" || currency === "XAF"
      ? "CFA Franc"
      : currency === "GBP"
      ? "British Pound (£)"
      : currency === "EUR"
      ? "Euro (€)"
      : currency === "CAD"
      ? "Canadian Dollar (CA$)"
      : currency === "AUD"
      ? "Australian Dollar (A$)"
      : currency === "INR"
      ? "Indian Rupee (₹)"
      : "US Dollar ($)";

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
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-xs font-mono text-primary tracking-[0.2em] uppercase mb-4">
            Pricing
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
            Start free, scale as you grow.{" "}
            {!isLoading && (
              <span className="text-primary font-mono text-sm">
                Prices in {currencyLabel}.
              </span>
            )}
          </p>

          {/* Billing Toggle */}
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

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLAN_DEFS.map((plan, i) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border transition-all duration-700 flex flex-col overflow-visible ${
                plan.popular
                  ? "border-primary/40 bg-card shadow-[0_0_40px_rgba(0,200,150,0.1)]"
                  : "border-border bg-card/50 hover:border-primary/20"
              } ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 100 + 200}ms` }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full font-mono flex items-center gap-1"
                    style={{ backgroundColor: "#00DC82", color: "#000000" }}
                  >
                    <Zap className="w-3 h-3" /> MOST POPULAR
                  </span>
                </div>
              )}

              <div className="p-8 flex-1">
                {/* Plan header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-2xl">{plan.icon}</div>
                  <p
                    className="text-xs font-mono tracking-widest uppercase"
                    style={{ color: plan.color }}
                  >
                    {plan.name}
                  </p>
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
                      <span className="text-muted-foreground text-sm mb-1">
                        /mo
                      </span>
                    </div>
                  )}
                  {isAnnual && !isLoading && (
                    <p className="text-xs text-primary font-mono mt-1">
                      Billed annually · Save 20%
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <Check
                        className="w-4 h-4 mt-0.5 shrink-0"
                        style={{ color: plan.color }}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="p-8 pt-0 mt-auto">
                <button
                  onClick={() => router.push("/register")}
                  className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all group ${
                    plan.popular
                      ? "hover:opacity-90"
                      : "border border-primary/20 text-primary hover:border-primary hover:bg-primary/5"
                  }`}
                  style={
                    plan.popular
                      ? { backgroundColor: "#00DC82", color: "#000000" }
                      : undefined
                  }
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
          All plans include a 3-day free trial · No credit card required
        </p>
      </div>
    </section>
  );
}
