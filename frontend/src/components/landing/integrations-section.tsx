
import { useEffect, useState, useRef } from "react";

const integrations = [
  { name: "YouTube", category: "Social", color: "#FF0000", icon: "https://cdn.simpleicons.org/youtube" },
  { name: "Facebook", category: "Social", color: "#1877F2", icon: "https://cdn.simpleicons.org/facebook" },
  { name: "Instagram", category: "Social", color: "#E1306C", icon: "https://cdn.simpleicons.org/instagram" },
  { name: "TikTok", category: "Social", color: "#FFFFFF", icon: "https://cdn.simpleicons.org/tiktok/FFFFFF" },
  { name: "X (Twitter)", category: "Social", color: "#FFFFFF", icon: "https://cdn.simpleicons.org/x/FFFFFF" },
  { name: "LinkedIn", category: "Social", color: "#0A66C2", icon: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/linkedin.svg" },
  { name: "WhatsApp", category: "Messaging", color: "#25D366", icon: "https://cdn.simpleicons.org/whatsapp" },
  { name: "Telegram", category: "Messaging", color: "#229ED9", icon: "https://cdn.simpleicons.org/telegram" },
  { name: "Discord", category: "Messaging", color: "#5865F2", icon: "https://cdn.simpleicons.org/discord" },
  { name: "Slack", category: "Messaging", color: "#4A154B", icon: "https://cdn.jsdelivr.net/npm/simple-icons@11/icons/slack.svg" },
  { name: "Google Sheets", category: "Productivity", color: "#34A853", icon: "https://cdn.simpleicons.org/googlesheets" },
  { name: "Gmail", category: "Productivity", color: "#EA4335", icon: "https://cdn.simpleicons.org/gmail" },
  { name: "Google Drive", category: "Productivity", color: "#4285F4", icon: "https://cdn.simpleicons.org/googledrive" },
  { name: "Notion", category: "Productivity", color: "#FFFFFF", icon: "https://cdn.simpleicons.org/notion/FFFFFF" },
  { name: "Salesforce", category: "CRM", color: "#00A1E0", icon: "https://cdn.jsdelivr.net/npm/simple-icons@11/icons/salesforce.svg" },
];

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
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

  return (
    <section id="integrations" ref={sectionRef} className="relative overflow-hidden">

      {/* Header — centré verticalement sur l'image */}
      <div className="relative z-10 pt-32 lg:pt-40 text-center">
        <span className={`inline-flex items-center gap-4 text-sm font-mono text-muted-foreground mb-8 transition-all duration-700 justify-center ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}>
          <span className="w-12 h-px bg-foreground/20" />
          Integrations
          <span className="w-12 h-px bg-foreground/20" />
        </span>

        <h2 className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          Connect
          <br />
          <span className="text-muted-foreground">everything.</span>
        </h2>

        <p className={`mt-8 text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto transition-all duration-1000 delay-100 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}>
          Automate posting, messaging, and data sync across social media, payments, and productivity tools — built for the platforms Nigerian businesses actually use.
        </p>
      </div>

      {/* Full-width image */}
      <div className={`relative left-1/2 -translate-x-1/2 w-screen -mt-16 transition-all duration-1000 delay-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}>
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/connection-KeJwWPQvn6l0a7C48tCARYtNEdC92H.png"
          alt=""
          aria-hidden="true"
          className="w-full h-auto object-cover"
        />
      </div>

      {/* Integration grid — remonte sur l'image avec spacing mobile approprié */}
      <div className="relative z-10 mt-0 lg:-mt-24 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-16">
          {integrations.map((integration, index) => (
            <div
              key={integration.name}
              className={`group relative overflow-hidden p-6 lg:p-8 border transition-all duration-500 cursor-default ${
                hoveredIndex === index
                  ? "border-foreground bg-foreground/[0.04] scale-[1.02]"
                  : "border-foreground/10 hover:border-foreground/30"
              } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{
                transitionDelay: `${index * 30 + 300}ms`,
              }}
              onMouseEnter={(e) => {
                setHoveredIndex(index);
                const rect = e.currentTarget.getBoundingClientRect();
                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseLeave={() => {
                setHoveredIndex(null);
                setMousePos(null);
              }}
            >
              {/* Cursor-following halo */}
              {hoveredIndex === index && mousePos && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0"
                  style={{
                    background: `radial-gradient(200px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.1) 0%, transparent 70%)`,
                  }}
                />
              )}
              {/* Category tag */}
              <span className={`absolute top-3 right-3 text-[10px] font-mono px-2 py-0.5 transition-colors ${
                hoveredIndex === index
                  ? "bg-foreground text-background"
                  : "bg-foreground/10 text-muted-foreground"
              }`}>
                {integration.category}
              </span>

              {/* Logo */}
              <div className={`w-10 h-10 mb-6 flex items-center justify-center rounded-lg transition-all ${
                hoveredIndex === index ? "scale-110" : ""
              }`}
                style={{ backgroundColor: `${integration.color}1A` }}
              >
                <img
                  src={integration.icon}
                  alt={integration.name}
                  className="w-6 h-6 object-contain"
                  loading="lazy"
                />
              </div>

              <span className="font-medium block">{integration.name}</span>

              {/* Animated underline */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-foreground/20 overflow-hidden">
                <div className={`h-full bg-foreground transition-all duration-500 ${
                  hoveredIndex === index ? "w-full" : "w-0"
                }`} />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom stats row */}
        <div className={`flex flex-wrap items-center justify-between gap-8 pt-12 border-t border-foreground/10 transition-all duration-1000 delay-500 pb-32 lg:pb-40 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}>
          <div className="flex flex-wrap gap-12">
            {[
              { value: "16+", label: "Integrations" },
              { value: "OAuth", label: "Auth built-in" },
              { value: "Real-time", label: "Sync & webhooks" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-3">
                <span className="text-3xl font-display">{stat.value}</span>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>

          <a href="#" className="group inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors">
            View all integrations
            <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
          </a>
        </div>
      </div>
    </section>
  );
}
