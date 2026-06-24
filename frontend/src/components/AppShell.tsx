/**
 * AppShell — Phase 10A
 *
 * Changes:
 *   - Nav now shows Super Admin item for super_admin and admin roles
 *   - Admin item visible to support, operator, admin, super_admin
 *   - Role badge shown in user footer for elevated roles
 *   - Uses getRoleBadge() from rbac.ts for consistent role display
 *
 * Task 4: Knowledge Hub renamed to "Explore" in the sidebar.
 * Task 4: "News" added as a sidebar entry (path: /news, icon: Newspaper).
 */
import { useState, useEffect, type ReactNode } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Logo } from "./Logo";
import { useServerStatus } from "../hooks/useServerStatus";
import { RuntimeObservabilityPanel, RuntimeHealthDot } from "./RuntimeObservabilityPanel";
import { WorkspaceSwitcher, OrgHealthSummary } from "./EnterpriseOpsCenter";
import { NotificationCentre } from "./NotificationCentre";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, GitBranch, Zap, Bot, Link2,
  CreditCard, Users, Settings, ShieldCheck, Crown,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Cpu,
  BarChart3, FileText, Store, Layers, Webhook, Activity, Key,
  Wand2, Library, HelpCircle, Globe, Newspaper, Compass,
} from "lucide-react";
import { isPlatformAdmin, isSuperAdmin, isSupport, getRoleBadge } from "../lib/rbac";
import { LanguageSwitcher } from "./LanguageSwitcher";
import ProductTour from "./ProductTour";
import AnnouncementBanner from "./AnnouncementBanner";
import TrialCompletionSurvey from "./TrialCompletionSurvey";

/* ── Nav config ─────────────────────────────────────────────────────── */
const NAV = [
  { path: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { path: "/workflows",    label: "Workflows",    icon: GitBranch },
  { path: "/automations",  label: "Automations",  icon: Zap },
  { path: "/ai-chat",      label: "AI Assistant", icon: Bot },
  // Task 1: renamed Knowledge Hub → Explore
  { path: "/knowledge-hub", label: "Explore",     icon: Compass },
  // Task 4: News added as sidebar entry
  { path: "/news",         label: "News",         icon: Newspaper },
  { path: "/dashboard/creative-agents", label: "Creative Agents", icon: Wand2 },
  { path: "/connections",  label: "Connections",  icon: Link2 },
  { path: "/intelligence", label: "Intelligence", icon: Cpu },
  { path: "/plans",        label: "Plans",        icon: CreditCard },
  { path: "/referrals",    label: "Referrals",    icon: Users },
  { path: "/settings",     label: "Settings",     icon: Settings },
  { path: "/marketplace",  label: "Marketplace",  icon: Store },
  { path: "/node-library", label: "Node Library", icon: Layers },
  { path: "/credentials",  label: "Credentials",  icon: Key },
  { path: "/webhooks",     label: "Webhooks",     icon: Webhook },
  { path: "/integration-health", label: "Int. Health", icon: Activity },
  { path: "/analytics",    label: "Analytics",    icon: BarChart3 },
  { path: "/media-cloud",  label: "Media Cloud",  icon: Library  },
  { path: "/reports",      label: "Reports",      icon: FileText },
];

// Phase 10A: Staff nav items — shown based on role
const ADMIN_NAV = [
  { path: "/admin",       label: "Admin",       icon: ShieldCheck, badge: "ADMIN",  badgeColor: "#FB7185" },
];
const SUPER_ADMIN_NAV = [
  { path: "/super-admin",           label: "Super Admin",    icon: Crown,  badge: "SA",  badgeColor: "#F59E0B" },
  { path: "/queue-mission-control", label: "Queue Control",  icon: Cpu,    badge: "OPS", badgeColor: "#8B5CF6" },
];

const STATUS_COLORS: Record<string, string> = {
  online: "#00C896", waking: "#FBBF24", checking: "#94A3B8", offline: "#FB7185",
};

/* ── Sidebar inner content (shared desktop + mobile) ─────────────────── */
function SidebarContent({
  collapsed,
  onCollapse,
  isMobile,
  onClose,
}: {
  collapsed: boolean;
  onCollapse?: () => void;
  isMobile: boolean;
  onClose: () => void;
}) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { status, latency } = useServerStatus();

  const role = user?.role ?? "user";
  const isCollapsed = !isMobile && collapsed;

  // Build nav list based on role
  const allNav = [
    ...NAV,
    // Support+ (but NOT super_admin) sees the Admin panel.
    // super_admin goes directly to Super Admin — showing both is redundant.
    ...(!isSuperAdmin(role) && (isSupport(role) || (user as any)?.is_admin) ? ADMIN_NAV : []),
    // super_admin only: Super Admin + Queue Control
    ...(isSuperAdmin(role) ? SUPER_ADMIN_NAV : []),
  ];

  const statusLabel =
    status === "online"   ? `Online${latency ? ` · ${latency}ms` : ""}` :
    status === "waking"   ? "Waking up…" :
    status === "checking" ? "Checking…" :
  status === "offline"  ? "Offline" : "Checking…";

  return (
    <div
      style={{
        width: isCollapsed ? 64 : 220,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#080A14",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          padding: isCollapsed ? "20px 0" : "20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        {!isCollapsed && <Logo size="sm" />}
        {!isMobile && onCollapse && (
          <button
            onClick={onCollapse}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: "rgba(232,238,255,0.4)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
        {isMobile && (
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "rgba(232,238,255,0.4)", cursor: "pointer", padding: 0 }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* WorkspaceSwitcher (non-collapsed only) */}
      {!isCollapsed && (
        <div style={{ padding: "10px 12px 4px", flexShrink: 0 }}>
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }}>
        {allNav.map(item => {
          const Icon = item.icon;
          const active = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));
          const badge = (item as any).badge;
          const badgeColor = (item as any).badgeColor;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={isMobile ? onClose : undefined}
              title={isCollapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: isCollapsed ? "9px 0" : "9px 14px",
                justifyContent: isCollapsed ? "center" : "flex-start",
                margin: "1px 8px",
                borderRadius: 8,
                textDecoration: "none",
                background: active ? "rgba(0,200,150,0.1)" : "transparent",
                color: active ? "#00C896" : "rgba(232,238,255,0.55)",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                position: "relative",
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!isCollapsed && (
                <>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {badge && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: badgeColor,
                      background: `${badgeColor}18`,
                      border: `1px solid ${badgeColor}40`,
                      borderRadius: 4,
                      padding: "1px 5px",
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.04em",
                    }}>
                      {badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* OrgHealthSummary */}
      {!isCollapsed && (
        <div style={{ padding: "6px 12px", flexShrink: 0 }}>
          <OrgHealthSummary />
        </div>
      )}

      {/* Language Switcher */}
      {!isCollapsed && (
        <div style={{ padding: "4px 12px", flexShrink: 0 }}>
          <LanguageSwitcher />
        </div>
      )}

      {/* Server status dot */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: isCollapsed ? "12px 0" : "12px 16px",
          justifyContent: isCollapsed ? "center" : "flex-start",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
        title={isCollapsed ? statusLabel : undefined}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: STATUS_COLORS[status] || STATUS_COLORS.checking,
            flexShrink: 0,
            boxShadow: `0 0 6px ${STATUS_COLORS[status] || STATUS_COLORS.checking}`,
          }}
        />
        {!isCollapsed && (
          <span style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono', monospace" }}>
            {statusLabel}
          </span>
        )}
      </div>


      {/* User footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: isCollapsed ? "14px 0" : "14px 14px",
          justifyContent: isCollapsed ? "center" : "flex-start",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00C896, #38BDF8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "#04060F",
            flexShrink: 0,
            fontFamily: "'Syne', sans-serif",
          }}
        >
          {(user?.name || user?.email || "U")[0].toUpperCase()}
        </div>
        {!isCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#E8EEFF",
              fontFamily: "'DM Sans', sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {user?.name || "User"}
            </div>
            {getRoleBadge(role) && (
              <div style={{
                fontSize: 9,
                fontWeight: 700,
                color: getRoleBadge(role)!.color,
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "0.05em",
              }}>
                {getRoleBadge(role)!.label}
              </div>
            )}
          </div>
        )}
        {!isCollapsed && (
          <button
            onClick={logout}
            title="Log out"
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(232,238,255,0.3)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
            }}
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── AppShell ─────────────────────────────────────────────────────────── */
export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [runtimeOpen,  setRuntimeOpen]  = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const nav       = useNavigate();

  // BUGFIX: invite emails link to /accept-invite?token=... but a user who
  // wasn't logged in yet gets bounced to /login, which always nav()s to
  // /dashboard on success (no `next` param support) — so they'd land in
  // the app having never actually accepted the invite. AcceptInvite.tsx
  // stashes the token in sessionStorage before that detour; this runs on
  // every authenticated page (AppShell wraps all RequireAuth routes) and
  // picks it back up the moment the user is logged in, routing them back
  // to finish accepting instead of leaving the invite to silently expire.
  useEffect(() => {
    if (!user) return;
    if (location.pathname === "/accept-invite") return;
    const pendingToken = sessionStorage.getItem("af_pending_invite_token");
    if (pendingToken) nav("/accept-invite");
  }, [user, location.pathname]);

  // Bug 6: Only show trial-expired banner when trial is genuinely past
  const isTrialExpired = user?.plan === 'trial' &&
    !!(user as any)?.trial_ends_at &&
    new Date((user as any).trial_ends_at).getTime() < Date.now();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#04060F" }}>
      {/* Desktop sidebar */}
      <div style={{ display: "none", flexShrink: 0 }} className="af-desktop-sidebar">
        <SidebarContent
          collapsed={collapsed}
          onCollapse={() => setCollapsed(c => !c)}
          isMobile={false}
          onClose={() => {}}
        />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
                zIndex: 40, display: "block",
              }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "tween", duration: 0.22 }}
              style={{
                position: "fixed", top: 0, left: 0, bottom: 0,
                width: 220, zIndex: 50,
              }}
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

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Top bar (mobile) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "#080A14",
            flexShrink: 0,
          }}
          className="af-topbar"
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="af-topbar-mobile-only"
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(232,238,255,0.6)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Menu size={20} />
          </button>
          <span className="af-topbar-mobile-only"><Logo size="xs" /></span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 50 }}>
            <NotificationCentre />
            <span onClick={() => setRuntimeOpen(o => !o)} style={{ cursor: "pointer" }}><RuntimeHealthDot /></span>
          </div>
        </div>

        {/* Announcement banner */}
        <AnnouncementBanner />

        {/* Bug 6: Trial-expired banner — only shown when trial is confirmed past */}
        {isTrialExpired && (
          <div style={{
            background: "rgba(251,113,133,0.12)",
            borderBottom: "1px solid rgba(251,113,133,0.3)",
            padding: "10px 16px",
            textAlign: "center",
            fontSize: 13,
            fontFamily: "'DM Sans',sans-serif",
            color: "#FB7185",
            flexShrink: 0,
          }}>
            Your free trial has ended.{" "}
            <a href="/plans" style={{ color: "#FB7185", fontWeight: 700, textDecoration: "underline" }}>
              Subscribe to restore access.
            </a>
          </div>
        )}

        {/* Scrollable page content */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {/* Runtime panel overlay */}
          {runtimeOpen && (
            <div style={{
              position: "absolute",
              top: 0, right: 0, bottom: 0,
              width: 380,
              zIndex: 30,
              background: "#080A14",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              overflowY: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 12px 0" }}>
                <button
                  onClick={() => setRuntimeOpen(false)}
                  style={{ background: "transparent", border: "none", color: "rgba(232,238,255,0.4)", cursor: "pointer" }}
                >
                  <X size={16} />
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

      {/* Desktop top-right controls */}
      <style>{`
        @media (min-width: 768px) {
          .af-topbar-mobile-only { display: none !important; }
          .af-topbar { justify-content: flex-end !important; }
          .af-desktop-sidebar { display: block !important; }
        }
      `}</style>
    </div>
  );
}
