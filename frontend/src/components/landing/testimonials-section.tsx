import { useEffect, useRef, useState } from "react";

const FALLBACK = [
  { name: "Amara O.", role: "Marketing Lead", company: "Fincra", text: "AutoFlowNG cut our campaign turnaround from 3 days to 4 hours. The AI agents just handle it.", avatar: "AO" },
  { name: "Tunde B.", role: "CTO", company: "Paystack Labs", text: "We automated our entire onboarding email sequence in one afternoon. Remarkable platform.", avatar: "TB" },
  { name: "Chisom E.", role: "Founder", company: "CreatorStack", text: "The video production pipeline is insane. 15 videos a month, zero manual editing.", avatar: "CE" },
  { name: "Malik R.", role: "Head of Ops", company: "Flutterwave", text: "Multi-workspace support means every team has their own automations. Game changer.", avatar: "MR" },
  { name: "Sade A.", role: "Product Manager", company: "Interswitch", text: "Went live in 2 days. The workflow builder is genuinely intuitive.", avatar: "SA" },
  { name: "Emeka N.", role: "DevOps Engineer", company: "Andela", text: "BullMQ integration is rock solid. Haven't had a failed job in production in weeks.", avatar: "EN" },
];

const COLORS = ["#00DC82","#3B9EFF","#A855F7","#F59E0B","#EC4899","#00DC82"];

interface Testimonial { name: string; role: string; company: string; text: string; avatar: string; }

export function TestimonialsSection() {
  const [items, setItems] = useState<Testimonial[]>(FALLBACK);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const BACKEND_URL = import.meta.env.VITE_API_URL || "https://autoflowng-backend-production-dfa9.up.railway.app";

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/testimonials/approved`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.testimonials?.length) setItems(d.testimonials); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true); }, { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <p className="text-xs font-mono text-primary tracking-[0.2em] uppercase mb-4">Testimonials</p>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Trusted by builders
          </h2>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Teams across the globe use AutoFlowNG to move faster.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <div
              key={t.name}
              className={`bg-card/50 border border-border/50 rounded-2xl p-6 flex flex-col gap-4 transition-all duration-700 hover:border-primary/30 hover:bg-card/80 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 100 + 200}ms` }}
            >
              <p className="text-white/70 text-sm leading-relaxed flex-1">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ background: COLORS[i % COLORS.length] }}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-white/70 font-mono">{t.role} · {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
