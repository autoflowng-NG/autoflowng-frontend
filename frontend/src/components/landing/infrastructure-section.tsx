
import { useEffect, useState, useRef } from "react";

const capabilities = [
  { name: "Cloud object storage", detail: "Media assets stored on S3/R2-compatible storage" },
  { name: "Managed database", detail: "PostgreSQL with connection pooling" },
  { name: "Background workers", detail: "Queue-based execution for workflows and media jobs" },
  { name: "CDN-delivered frontend", detail: "Fast global page loads via edge delivery" },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeItem, setActiveItem] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

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

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveItem((prev) => (prev + 1) % capabilities.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="infra" ref={sectionRef} className="relative py-32 lg:py-40 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-20">
          <span className={`inline-flex items-center gap-4 text-sm font-mono text-white/60 mb-8 transition-all duration-700 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}>
            <span className="w-12 h-px bg-foreground/20" />
            Infrastructure
          </span>
          
          <div className="grid lg:grid-cols-[auto_1fr] gap-8 lg:gap-16 items-stretch">
            {/* Image globe — colonne gauche, pleine hauteur */}
            <div className={`w-48 lg:w-72 xl:w-80 shrink-0 transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/world-3i68QNWJwmO7W19ztZWbevAwJQHzYL.png"
                alt="Global network sphere"
                className="w-full h-full object-contain object-center"
              />
            </div>

            {/* Titre + description empilés */}
            <div className="flex flex-col justify-center">
              <h2 className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] text-white transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}>
                Built to
                <br />
                <span className="text-white/70">run reliably.</span>
              </h2>

              <p className={`mt-8 text-xl text-white/80 leading-relaxed max-w-lg transition-all duration-1000 delay-100 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}>
                AutoFlowNG runs on a managed cloud stack with a CDN-delivered
                frontend, pooled PostgreSQL, and queue-based background workers
                for workflow and media processing.
              </p>
            </div>
          </div>
        </div>

        {/* Capabilities grid */}
        <div className={`grid sm:grid-cols-2 gap-4 transition-all duration-1000 delay-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}>
          {capabilities.map((item, index) => (
            <div
              key={item.name}
              className={`p-6 border transition-all duration-300 cursor-default ${
                activeItem === index 
                  ? "border-foreground/30 bg-foreground/[0.04]" 
                  : "border-foreground/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full transition-colors ${
                  activeItem === index ? "bg-[#eca8d6]" : "bg-foreground/20"
                }`} />
              </div>
              <span className="font-medium block mb-1 text-white">{item.name}</span>
              <span className="text-sm text-white/70">{item.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
