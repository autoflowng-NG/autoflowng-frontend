/**
 * AppShell — Redesigned (Enterprise Premium)
 *
 * Visual redesign only — all logic, role checks, hooks, and imports
 * are preserved exactly from Phase 10A. Only CSS/layout changed.
 *
 * Design:
 *   - Deep #080B12 sidebar with subtle blue-tinted dark
 *   - Purple (#7C3AED) active state with left border accent
 *   - Grouped nav sections with muted category labels
 *   - Premium user footer with gradient avatar
 *   - Glassmorphism top bar on desktop
 *   - Smooth collapse animation
 */

import { useState, useEffect, type ReactNode } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { Logo } from "./Logo";
import { useServerStatus } from "../hooks/useServerStatus";
import { RuntimeObservabilityPanel, RuntimeHealthDot } from "./RuntimeObservabilityPanel";
import { WorkspaceSwitcher, OrgHealthSummary } from "./EnterpriseOpsCenter";
import { NotificationCentre } from "./NotificationCentre";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, GitBranch, Zap, Bot,
  CreditCard, Users, Settings, ShieldCheck, Crown,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Cpu,
  BarChart3, FileText, Layers, Webhook, Key,
  Wand2, Library, HelpCircle, Globe, Newspaper, Compass,
} from "lucide-react";
import { isPlatformAdmin, isSuperAdmin, isSupport, getRoleBadge } from "../lib/rbac";
import { LanguageSwitcher } from "./LanguageSwitcher";
import ProductTour from "./ProductTour";
import AnnouncementBanner from "./AnnouncementBanner";
import TrialCompletionSurvey from "./TrialCompletionSurvey";

/* ── Design tokens ──────────────────────────────────────────────────── */
const T = {
  bg:          "#080B12",
  bgHover:     "rgba(124,58,237,0.06)",
  active:      "rgba(124,58,237,0.12)",
  activeText:  "#A78BFA",
  activeBorder:"#7C3AED",
  text:        "rgba(226,232,255,0.55)",
  textActive:  "#E2E8FF",
  border:      "rgba(255,255,255,0.05)",
  separator:   "rgba(255,255,255,0.04)",
  muted:       "rgba(226,232,255,0.22)",
};

/* ── Nav config — labelKey resolved via t() at render time ───────────── */
const NAV = [
  { path: "/dashboard",    labelKey: "nav.dashboard",             icon: LayoutDashboard },
  { path: "/workflows",    labelKey: "nav.workflows_automations",  icon: GitBranch },
  { path: "/ai-chat",      labelKey: "nav.ai_assistant",           icon: Bot },
  { path: "/knowledge-hub",labelKey: "nav.explore",          icon: Compass },
  { path: "/news",         labelKey: "nav.news",             icon: Newspaper },
  { path: "/dashboard/creative-agents", labelKey: "nav.creative_agents", icon: Wand2 },
  { path: "/connections",  labelKey: "nav.connections",      icon: Layers },
  { path: "/intelligence", labelKey: "nav.intelligence",     icon: Cpu },
  { path: "/plans",        labelKey: "nav.plans",            icon: CreditCard },
  { path: "/referrals",    labelKey: "nav.referrals",        icon: Users },
  { path: "/settings",     labelKey: "nav.settings",         icon: Settings },
  { path: "/node-library", labelKey: "nav.node_library",     icon: Layers },
  { path: "/credentials",  labelKey: "nav.credentials",      icon: Key },
  { path: "/webhooks",     labelKey: "nav.webhooks",         icon: Webhook },
  { path: "/analytics",    labelKey: "nav.analytics",        icon: BarChart3 },
  { path: "/media-cloud",  labelKey: "nav.media_cloud",      icon: Library },
  { path: "/campaign-agents", labelKey: "nav.campaign_agents", icon: Bot     },
  { path: "/reports",      labelKey: "nav.reports",          icon: FileText },
];

const ADMIN_NAV = [
  { path: "/admin", labelKey: "nav.admin", icon: ShieldCheck, badgeKey: "nav.badge_admin", badgeColor: "#FB7185" },
];
const SUPER_ADMIN_NAV = [
  { path: "/super-admin",            labelKey: "nav.super_admin",   icon: Crown,  badgeKey: "nav.badge_sa",  badgeColor: "#F59E0B" },
  { path: "/queue-mission-control",  labelKey: "nav.queue_control", icon: Cpu,    badgeKey: "nav.badge_ops", badgeColor: "#8B5CF6" },
];

/* ── Nav sections — groups with sectionKey resolved via t() ──────────── */
const NAV_SECTIONS = [
  {
    sectionKey: "nav.section_main",
    items: ["/dashboard", "/workflows"],
  },
  {
    sectionKey: "nav.section_ai_content",
    items: ["/ai-chat", "/knowledge-hub", "/news", "/dashboard/creative-agents"],
  },
  {
    sectionKey: "nav.section_platform",
    items: ["/connections", "/intelligence", "/plans", "/referrals", "/settings"],
  },
  {
    sectionKey: "nav.section_developer",
    items: ["/node-library", "/credentials", "/webhooks"],
  },
  {
    sectionKey: "nav.section_insights",
    items: ["/analytics", "/media-cloud", "/campaign-agents", "/reports"],
  },
];

const STATUS_COLORS: Record<string, string> = {
  online: "#00C896", waking: "#FBBF24", checking: "#94A3B8", offline: "#FB7185",
};

/* ── NavItem ─────────────────────────────────────────────────────────── */
function NavItem({
  item, active, isCollapsed, isMobile, onClose,
}: {
  key?: React.Key;
  item: typeof NAV[0] & { badgeKey?: string; badgeColor?: string };
  active: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(item.labelKey);
  return (
    <Link
      to={item.path}
      onClick={isMobile ? onClose : undefined}
      title={isCollapsed ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: isCollapsed ? "8px 0" : "8px 12px",
        justifyContent: isCollapsed ? "center" : "flex-start",
        margin: isCollapsed ? "1px 8px" : "1px 6px",
        borderRadius: 8,
        textDecoration: "none",
        background: active ? T.active : "transparent",
        color: active ? T.activeText : T.text,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.14s ease",
        whiteSpace: "nowrap",
        position: "relative",
        borderLeft: active && !isCollapsed ? `2px solid ${T.activeBorder}` : "2px solid transparent",
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = T.bgHover;
          (e.currentTarget as HTMLElement).style.color = T.textActive;
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = T.text;
        }
      }}
    >
      <Icon
        size={15}
        style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}
      />
      {!isCollapsed && (
        <>
          <span style={{ flex: 1, letterSpacing: "-0.01em" }}>{label}</span>
          {item.badgeKey && (
            <span style={{
              fontSize: 9,
              fontWeight: 800,
              color: item.badgeColor,
              background: `${item.badgeColor}15`,
              border: `1px solid ${item.badgeColor}35`,
              borderRadius: 4,
              padding: "1px 5px",
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.04em",
            }}>
              {t(item.badgeKey)}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

/* ── SidebarContent ──────────────────────────────────────────────────── */
function SidebarContent({
  collapsed, onCollapse, isMobile, onClose,
}: {
  collapsed: boolean;
  onCollapse?: () => void;
  isMobile: boolean;
  onClose: () => void;
}) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { status, latency } = useServerStatus();
  const { t } = useTranslation();

  const role = user?.role ?? "user";
  const isCollapsed = !isMobile && collapsed;

  const allNav = [
    ...NAV,
    ...(!isSuperAdmin(role) && (isSupport(role) || (user as any)?.is_admin) ? ADMIN_NAV : []),
    ...(isSuperAdmin(role) ? SUPER_ADMIN_NAV : []),
  ];

  const navByPath = Object.fromEntries(allNav.map(n => [n.path, n]));

  const statusLabel =
    status === "online"   ? `${t('shell.status_online')}${latency ? ` · ${latency}ms` : ""}` :
    status === "waking"   ? t('shell.status_waking') :
    status === "checking" ? t('shell.status_checking') :
    status === "offline"  ? t('shell.status_offline') : t('shell.status_checking');

  const roleBadge = getRoleBadge(role);

  // Staff-only paths for grouping
  const staffPaths = [
    ...ADMIN_NAV.map(n => n.path),
    ...SUPER_ADMIN_NAV.map(n => n.path),
  ];

  return (
    <div style={{
      width: isCollapsed ? 60 : 224,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: T.bg,
      borderRight: `1px solid ${T.border}`,
      transition: "width 0.22s cubic-bezier(.4,0,.2,1)",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Top gradient accent */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)",
        pointerEvents: "none",
      }} />

      {/* Logo row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "space-between",
        padding: isCollapsed ? "18px 0" : "18px 14px",
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
        minHeight: 64,
      }}>
        {!isCollapsed && <Logo size="sm" />}
        {isCollapsed && (
          <button
            onClick={onCollapse}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: "linear-gradient(135deg, rgba(0,200,150,0.18), rgba(124,58,237,0.18))",
              border: "1px solid rgba(0,200,150,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: onCollapse ? "pointer" : "default",
              transition: "all 0.14s",
            }}
            onMouseEnter={e => {
              if (!onCollapse) return;
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(0,200,150,0.18)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <ChevronRight size={16} strokeWidth={2.5} color="#00C896" />
          </button>
        )}
        {!isMobile && onCollapse && !isCollapsed && (
          <button
            onClick={onCollapse}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            style={{
              background: "rgba(0,200,150,0.10)",
              border: "1px solid rgba(0,200,150,0.35)",
              borderRadius: 8,
              color: "#00C896",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, flexShrink: 0,
              transition: "all 0.14s",
              boxShadow: "0 0 0 0 rgba(0,200,150,0)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0,200,150,0.18)";
              (e.currentTarget as HTMLElement).style.color = "#E2E8FF";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(0,200,150,0.15)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0,200,150,0.10)";
              (e.currentTarget as HTMLElement).style.color = "#00C896";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 0 rgba(0,200,150,0)";
            }}
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
        )}
        {isMobile && (
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", padding: 0 }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Workspace switcher */}
      {!isCollapsed && (
        <div style={{ padding: "10px 10px 2px", flexShrink: 0 }}>
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Nav sections */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0 8px", scrollbarWidth: "none" }}>
        {!isCollapsed ? (
          <>
            {NAV_SECTIONS.map(section => {
              const sectionItems = section.items
                .map(p => navByPath[p])
                .filter(Boolean);
              if (sectionItems.length === 0) return null;
              return (
                <div key={section.sectionKey} style={{ marginBottom: 4 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700,
                    color: T.muted,
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: "0.08em",
                    padding: "10px 14px 4px",
                  }}>
                    {t(section.sectionKey)}
                  </div>
                  {sectionItems.map(item => {
                    const active = pathname === item.path ||
                      (item.path !== "/" && pathname.startsWith(item.path));
                    return (
                      <NavItem
                        key={item.path}
                        item={item as any}
                        active={active}
                        isCollapsed={false}
                        isMobile={isMobile}
                        onClose={onClose}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* Staff section */}
            {staffPaths.length > 0 && staffPaths.some(p => navByPath[p]) && (
              <div style={{ marginTop: 4 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700,
                  color: "rgba(251,191,36,0.45)",
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.08em",
                  padding: "10px 14px 4px",
                }}>{t('nav.section_staff')}</div>
                {staffPaths.map(p => {
                  const item = navByPath[p];
                  if (!item) return null;
                  const active = pathname === item.path || pathname.startsWith(item.path);
                  return (
                    <NavItem
                      key={item.path}
                      item={item as any}
                      active={active}
                      isCollapsed={false}
                      isMobile={isMobile}
                      onClose={onClose}
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Collapsed — no section labels, just icons */
          allNav.map(item => {
            const active = pathname === item.path ||
              (item.path !== "/" && pathname.startsWith(item.path));
            return (
              <NavItem
                key={item.path}
                item={item as any}
                active={active}
                isCollapsed={true}
                isMobile={isMobile}
                onClose={onClose}
              />
            );
          })
        )}
      </nav>

      {/* OrgHealthSummary */}
      {!isCollapsed && (
        <div style={{ padding: "4px 10px", flexShrink: 0 }}>
          <OrgHealthSummary />
        </div>
      )}

      {/* Language switcher */}
      {!isCollapsed && (
        <div style={{ padding: "2px 10px 4px", flexShrink: 0 }}>
          <LanguageSwitcher />
        </div>
      )}

      {/* Server status */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: isCollapsed ? "10px 0" : "10px 14px",
        justifyContent: isCollapsed ? "center" : "flex-start",
        borderTop: `1px solid ${T.separator}`,
        flexShrink: 0,
      }} title={isCollapsed ? statusLabel : undefined}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: STATUS_COLORS[status] || STATUS_COLORS.checking,
          flexShrink: 0,
          boxShadow: `0 0 5px ${STATUS_COLORS[status] || STATUS_COLORS.checking}80`,
        }} />
        {!isCollapsed && (
          <span style={{
            fontSize: 10, color: T.muted,
            fontFamily: "'DM Mono', monospace",
          }}>
            {statusLabel}
          </span>
        )}
      </div>

      {/* User footer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: isCollapsed ? "12px 0" : "12px 12px",
        justifyContent: isCollapsed ? "center" : "flex-start",
        borderTop: `1px solid ${T.border}`,
        flexShrink: 0,
        background: "rgba(255,255,255,0.015)",
      }}>
        {/* Avatar */}
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #7C3AED, #00C896)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: "#fff",
          fontFamily: "'Syne', sans-serif",
          boxShadow: "0 0 0 1.5px rgba(124,58,237,0.3)",
        }}>
          {(user?.name || user?.email || "U")[0].toUpperCase()}
        </div>

        {!isCollapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: "#E2E8FF",
                fontFamily: "'DM Sans', sans-serif",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {user?.name || t('shell.user_fallback')}
              </div>
              {roleBadge && (
                <div style={{
                  fontSize: 9, fontWeight: 700,
                  color: roleBadge.color,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.05em",
                  opacity: 0.85,
                }}>
                  {roleBadge.label}
                </div>
              )}
            </div>
            <button
              onClick={logout}
              title={t('shell.log_out')}
              style={{
                background: "transparent", border: "none",
                color: T.muted, cursor: "pointer",
                padding: 5, borderRadius: 6,
                display: "flex", alignItems: "center",
                transition: "color 0.14s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#FB7185"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.muted}
            >
              <LogOut size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── AppShell ─────────────────────────────────────────────────────────── */
export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  const { t } = useTranslation();

  /* Invite token re-route (unchanged) */
  useEffect(() => {
    if (!user) return;
    if (location.pathname === "/accept-invite") return;
    const pendingToken = sessionStorage.getItem("af_pending_invite_token");
    if (pendingToken) nav("/accept-invite");
  }, [user, location.pathname]);

  const isTrialExpired =
    user?.plan === "trial" &&
    !!(user as any)?.trial_ends_at &&
    new Date((user as any).trial_ends_at).getTime() < Date.now();

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "#060810",
    }}>
      {/* ── Desktop sidebar ── */}
      <div style={{ display: "none", flexShrink: 0 }} className="af-desktop-sidebar">
        <SidebarContent
          collapsed={collapsed}
          onCollapse={() => setCollapsed(c => !c)}
          isMobile={false}
          onClose={() => {}}
        />
      </div>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(2px)",
                zIndex: 40,
              }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -224 }} animate={{ x: 0 }} exit={{ x: -224 }}
              transition={{ type: "tween", duration: 0.2 }}
              style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 224, zIndex: 50 }}
            >
              <SidebarContent
                collapsed={false}
                isMobile={true}
                onClose={() => setMobileOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Top bar */}
        <div
          className="af-topbar"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 16px",
            height: 56,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(8,11,18,0.92)",
            backdropFilter: "blur(12px)",
            flexShrink: 0,
            position: "relative",
            zIndex: 20,
          }}
        >
          {/* Mobile: hamburger + logo */}
          <button
            onClick={() => setMobileOpen(true)}
            className="af-topbar-mobile-only"
            style={{
              background: "transparent", border: "none",
              color: "rgba(226,232,255,0.5)", cursor: "pointer",
              display: "flex", alignItems: "center",
              padding: 4, borderRadius: 6,
            }}
          >
            <Menu size={19} />
          </button>
          <span className="af-topbar-mobile-only">
            <Logo size="xs" />
          </span>

          {/* Right controls */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginLeft: "auto",
          }}>
            <NotificationCentre />
            <span
              onClick={() => setRuntimeOpen(o => !o)}
              style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <RuntimeHealthDot />
            </span>
          </div>
        </div>

        {/* Announcement banner */}
        <AnnouncementBanner />

        {/* Trial expired banner */}
        {isTrialExpired && (
          <div style={{
            background: "rgba(251,113,133,0.08)",
            borderBottom: "1px solid rgba(251,113,133,0.2)",
            padding: "9px 16px",
            textAlign: "center",
            fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            color: "#FB7185",
            flexShrink: 0,
          }}>
            {t('shell.trial_ended_banner')}{" "}
            <a href="/plans" style={{ color: "#FB7185", fontWeight: 700, textDecoration: "underline" }}>
              {t('shell.subscribe_restore')}
            </a>
          </div>
        )}

        {/* Page content */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {/* Runtime panel overlay */}
          {runtimeOpen && (
            <div style={{
              position: "absolute", top: 0, right: 0, bottom: 0,
              width: 380, zIndex: 30,
              background: "#080B12",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              overflowY: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 12px 0" }}>
                <button
                  onClick={() => setRuntimeOpen(false)}
                  style={{
                    background: "transparent", border: "none",
                    color: "rgba(226,232,255,0.35)", cursor: "pointer",
                    borderRadius: 6, padding: 4,
                  }}
                >
                  <X size={15} />
                </button>
              </div>
              <RuntimeObservabilityPanel />
            </div>
          )}
          <TrialCompletionSurvey />
          <ProductTour />
          {children}
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .af-topbar-mobile-only { display: none !important; }
          .af-topbar { justify-content: flex-end !important; }
          .af-desktop-sidebar { display: block !important; }
        }
        nav::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
