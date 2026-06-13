/**
 * AppShell — Phase 10A
 *
 * Changes:
 *   - Nav now shows Super Admin item for super_admin and admin roles
 *   - Admin item visible to support, operator, admin, super_admin
 *   - Role badge shown in user footer for elevated roles
 *   - Uses getRoleBadge() from rbac.ts for consistent role display
 */
import { useState, type ReactNode } from "react";
import { useLocation, Link } from "wouter";
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
  Wand2, Library,
} from "lucide-react";
import { isPlatformAdmin, isSupport, getRoleBadge } from "../lib/rbac";
import { LanguageSwitcher } from "./LanguageSwitcher";

/* ── Nav config ─────────────────────────────────────────────────────── */
const NAV = [
  { path: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { path: "/workflows",    label: "Workflows",    icon: GitBranch },
  { path: "/automations",  label: "Automations",  icon: Zap },
  { path: "/ai",           label: "AI Assistant", icon: Bot },
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
  { path: "/phase17-ops",           label: "Phase 17 Ops",   icon: Activity, badge: "DEBUG", badgeColor: "#94A3B8" },
  { path: "/phase18-ops",           label: "Phase 18 Ops",   icon: Activity, badge: "DEBUG", badgeColor: "#94A3B8" },
  { path: "/phase19-ops",           label: "Phase 19 Ops",   icon: Activity, badge: "DEBUG", badgeColor: "#94A3B8" },
  { path: "/phase20-ops",           label: "Phase 20 Ops",   icon: Activity, badge: "DEBUG", badgeColor: "#94A3B8" },
  { path: "/media-cloud-ops",       label: "Media Cloud Ops", icon: Activity, badge: "DEBUG", badgeColor: "#94A3B8" },
];

const STATUS_COLORS: Record<string, string> = {
  online: "#00C896", waking: "#FBBF24", offline: "#FB7185", checking: "#94A3B8",
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
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { status, latency } = useServerStatus();

  const role = user?.role ?? "user";
  const isCollapsed = !isMobile && collapsed;

  // Build nav list based on role
  const allNav = [
    ...NAV,
    // Support+ sees legacy Admin panel
    ...(isSupport(role) || (user as any)?.is_admin ? ADMIN_NAV : []),
    // Admin+ sees Super Admin dashboard
    ...(isPlatformAdmin(role) ? SUPER_ADMIN_NAV : []),
  ];

  const statusLabel =
    status === "online"   ? `Online${latency ? ` · ${latency}ms` : ""}` :
    status === "waking"   ? "Waking up…" :
    status === "offline"  ? "Offline" : "Checking…";

  const roleBadge = getRoleBadge(role);

  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      height:         "100%",
      background:     "rgba(8,11,22,0.98)",
      backdropFilter: "blur(28px)",
      borderRight:    "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* ── Logo row ── */}
      <div style={{
        padding:        isCollapsed ? "20px 0" : "20px 18px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: isCollapsed ? "center" : "space-between",
        borderBottom:   "1px solid rgba(255,255,255,0.05)",
        minHeight:      72,
        flexShrink:     0,
      }}>
        {isCollapsed
          ? (
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#00C896", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#04060F", fontFamily: "Arial" }}>AF</span>
            </div>
          )
          : <Logo size="sm" onClick={() => {}} />
        }

        {!isMobile && onCollapse && (
          <button
            onClick={onCollapse}
            data-testid="sidebar-toggle"
            style={{
              background:   "rgba(255,255,255,0.04)",
              border:       "1px solid rgba(255,255,255,0.07)",
              borderRadius: 6,
              width:        24, height: 24,
              display:      "flex", alignItems: "center", justifyContent: "center",
              cursor:       "pointer", color: "rgba(232,238,255,0.4)", flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        )}

        {isMobile && (
          <button
            onClick={onClose}
            data-testid="mobile-sidebar-close"
            style={{
              background:   "rgba(255,255,255,0.04)",
              border:       "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              width:        32, height: 32,
              display:      "flex", alignItems: "center", justifyContent: "center",
              cursor:       "pointer", color: "rgba(232,238,255,0.5)",
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── Status pill ── */}
      {!isCollapsed && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          <div style={{
            display:    "flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.2)", borderRadius: 8,
            padding:    "6px 10px", border: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: STATUS_COLORS[status] || "#94A3B8",
              flexShrink: 0,
              animation:  status === "online" ? "glw 2s ease infinite" : "none",
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[status], fontFamily: "'DM Mono',monospace" }}>
              {statusLabel}
            </span>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {allNav.map(item => {
          const active = location === item.path || location.startsWith(item.path + "/");
          const Icon   = item.icon;
          const badge  = (item as any).badge;
          const badgeColor = (item as any).badgeColor ?? "#FB7185";

          // Highlight colour: super-admin = amber, admin = pink, default = green
          const activeColor =
            item.path === "/super-admin" ? "#F59E0B" :
            item.path === "/admin"       ? "#FB7185" : "#00C896";
          const activeBg  = item.path === "/super-admin" ? "rgba(245,158,11,0.1)"  :
                            item.path === "/admin"       ? "rgba(251,113,133,0.1)" : "rgba(0,200,150,0.1)";
          const activeBdr = item.path === "/super-admin" ? "rgba(245,158,11,0.2)"  :
                            item.path === "/admin"       ? "rgba(251,113,133,0.2)" : "rgba(0,200,150,0.2)";

          return (
            <Link key={item.path} href={item.path}>
              <a
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                onClick={onClose}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            10,
                  padding:        isCollapsed ? "10px 0" : "9px 12px",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  borderRadius:   10,
                  marginBottom:   2,
                  cursor:         "pointer",
                  textDecoration: "none",
                  background:     active ? activeBg    : "transparent",
                  border:         `1px solid ${active ? activeBdr : "transparent"}`,
                  color:          active ? activeColor : "rgba(232,238,255,0.6)",
                  fontFamily:     "'DM Sans',sans-serif",
                  fontSize:       14,
                  fontWeight:     active ? 700 : 500,
                  transition:     "all 0.16s",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLElement).style.color = "#E8EEFF";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "rgba(232,238,255,0.6)";
                  }
                }}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                {!isCollapsed && <span>{item.label}</span>}
                {!isCollapsed && badge && (
                  <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, color: badgeColor, background: `${badgeColor}1A`, border: `1px solid ${badgeColor}33`, borderRadius: 100, padding: "1px 6px", fontFamily: "'DM Mono',monospace" }}>
                    {badge}
                  </span>
                )}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: isCollapsed ? "12px 8px" : "12px", flexShrink: 0 }}>
        {!isCollapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "6px 6px" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: role !== "user" ? `linear-gradient(135deg,${roleBadge.color},${roleBadge.color}88)` : "linear-gradient(135deg,#00C896,#38BDF8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, color: "#04060F", flexShrink: 0,
            }}>
              {(user?.name || user?.email || "?")[0].toUpperCase()}
            </div>
            <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || "User"}</div>
              <div style={{ fontSize: 10, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {/* Phase 10A: show role for staff, plan for regular users */}
                {role !== "user" ? roleBadge.label : (user?.plan || "Free")}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          data-magnet
          data-testid="logout-button"
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap:            8,
            width:          "100%",
            padding:        isCollapsed ? "10px 0" : "9px 12px",
            background:     "transparent",
            border:         "1px solid transparent",
            borderRadius:   10,
            cursor:         "pointer",
            color:          "rgba(232,238,255,0.4)",
            fontFamily:     "'DM Sans',sans-serif",
            fontSize:       14,
            fontWeight:     500,
            transition:     "all 0.18s",
          }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background   = "rgba(251,113,133,0.08)";
            b.style.borderColor  = "rgba(251,113,133,0.2)";
            b.style.color        = "#FB7185";
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background  = "transparent";
            b.style.borderColor = "transparent";
            b.style.color       = "rgba(232,238,255,0.4)";
          }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!isCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );
}

/* ── AppShell ───────────────────────────────────────────────────────── */
export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const { user } = useAuth();

  const closeMobile = () => setMobileOpen(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#04060F" }}>

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside
        className="af-sidebar-desktop"
        style={{
          width:      collapsed ? 64 : 220,
          flexShrink: 0,
          position:   "sticky",
          top:        0,
          height:     "100vh",
          overflow:   "hidden",
          transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          display:    "none",
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          onCollapse={() => setCollapsed(c => !c)}
          isMobile={false}
          onClose={closeMobile}
        />
      </aside>

      {/* ── Mobile top bar ─────────────────────────────────────────── */}
      <header
        className="af-mobile-header"
        style={{
          display:        "none",
          position:       "fixed",
          top:            0, left: 0, right: 0,
          height:         56,
          zIndex:         300,
          background:     "rgba(8,11,22,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom:   "1px solid rgba(255,255,255,0.06)",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "0 16px",
        }}
      >
        <button
          onClick={() => setMobileOpen(o => !o)}
          data-testid="mobile-menu-toggle"
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#E8EEFF", flexShrink: 0,
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {mobileOpen
              ? <motion.span key="x" initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.15 }}><X size={18} /></motion.span>
              : <motion.span key="m" initial={{ rotate: 45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -45, opacity: 0 }} transition={{ duration: 0.15 }}><Menu size={18} /></motion.span>
            }
          </AnimatePresence>
        </button>

        <Logo size="sm" onClick={() => {}} />

        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg,#00C896,#38BDF8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color: "#04060F", flexShrink: 0,
        }}>
          {(user?.name || user?.email || "?")[0].toUpperCase()}
        </div>
      </header>

      {/* ── Mobile drawer ──────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={closeMobile}
              style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
            />
            <motion.div
              key="drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 272, zIndex: 500, overflowY: "auto" }}
            >
              <SidebarContent collapsed={false} isMobile={true} onClose={closeMobile} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, position: "relative" }} className="af-main-content">
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 100, pointerEvents: "none" }}>
          <div style={{ height: "100%", background: "linear-gradient(90deg,#00C896,#38BDF8,#A78BFA)" }} />
        </div>
        {children}
      </main>

      <style>{`
        @media (min-width: 768px) {
          .af-sidebar-desktop { display: block !important; }
          .af-mobile-header   { display: none !important; }
        }
        @media (max-width: 767px) {
          .af-sidebar-desktop { display: none !important; }
          .af-mobile-header   { display: flex !important; }
          .af-main-content    { padding-top: 56px; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
