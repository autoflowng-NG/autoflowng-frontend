import { lazy, Suspense } from "react";
/**
import { LandingErrorBoundary } from "./components/LandingErrorBoundary";
 * AutoFlowNG — App Router (Phase 13B)
 *
 * Phase 6.5 additions:
 *   WorkspaceProvider wraps all authenticated routes
 *
 * Phase 14 additions:
 *   /analytics, /reports — Analytics and Reports Centers
 *
 * Phase 13.5 additions:
 *   /integration-health — Integration Health Monitor
 *
 * Phase 13B additions:
 *   /marketplace             — Integration Marketplace (protected)
 *   /integrations/:id        — Integration Detail page (protected)
 *   /credentials             — Credential Vault Manager (protected)
 *   /node-library            — Node Library Browser (protected)
 *   /webhooks                — Webhook Manager (protected)
 *
 * All Phase 1–12.5 routes preserved unchanged.
 */

import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { hasRole, type PlatformRole } from './lib/rbac';
import { CriticalAlertToaster } from './components/CriticalAlertToaster';

// ── Existing lazy imports (Phases 1–12.5, unchanged) ──────────────────────────
const Login        = lazy(() => import('./pages/Login'));
const Register     = lazy(() => import('./pages/Register'));
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Workflows    = lazy(() => import('./pages/Workflows'));
const Automations  = lazy(() => import('./pages/Automations'));
const Connections  = lazy(() => import('./pages/Connections'));
const Intelligence = lazy(() => import('./pages/IntelligenceOpsCenter'));
const Profile      = lazy(() => import('./pages/Profile'));
const Referrals    = lazy(() => import('./pages/Referrals'));
const Admin        = lazy(() => import('./pages/Admin'));
const SuperAdmin   = lazy(() => import('./pages/SuperAdmin'));
const Appeals      = lazy(() => import('./pages/Appeals'));
const MFASetup     = lazy(() => import('./components/MFASetup'));
const Wallet              = lazy(() => import('./pages/Wallet'));
const FinancialGovernance = lazy(() => import('./pages/FinancialGovernance'));
const FinancialIntegrityCenter = lazy(() => import('./pages/FinancialIntegrityCenter'));
const ExecutionPage       = lazy(() => import('./pages/ExecutionPage'));
const Plans               = lazy(() => import('./pages/Plans'));
const Settings            = lazy(() => import('./pages/Settings'));
const AIChat              = lazy(() => import('./pages/AIChat'));
const SharedExecutionPage = lazy(() => import('./pages/SharedExecutionPage'));
const Landing             = lazy(() => import('./pages/Landing'));
const WorkflowBuilder     = lazy(() => import('./pages/WorkflowBuilder'));

// ── Phase 13B: Integration Ecosystem ──────────────────────────────────────────
const Marketplace        = lazy(() => import('./pages/Marketplace'));
const IntegrationDetail  = lazy(() => import('./pages/IntegrationDetail'));
const CredentialManager  = lazy(() => import('./pages/CredentialManager'));
const NodeLibrary        = lazy(() => import('./pages/NodeLibrary'));
const WebhookManager     = lazy(() => import('./pages/WebhookManager'));

// ── Phase 13.5: Integration Health ───────────────────────────────────────────
const IntegrationHealth   = lazy(() => import('./pages/IntegrationHealth'));

// ── Phase 14: Analytics & Reports ────────────────────────────────────────────
const AnalyticsCenter     = lazy(() => import('./pages/AnalyticsCenter'));
const ReportsCenter       = lazy(() => import('./pages/ReportsCenter'));

// ── Phase 8: Enterprise Runtime Intelligence Dashboard ───────────────────────
const RuntimeDashboard    = lazy(() => import('./pages/RuntimeDashboard'));

// ── Phase 13: Queue Mission Control ──────────────────────────────────────────
const QueueMissionControl = lazy(() => import('./pages/QueueMissionControl'));

// ── Phase 16: Autonomous Operations Center ───────────────────────────────────
const AutonomousOpsCenter = lazy(() => import('./pages/AutonomousOpsCenter'));

// ── Phase 17: Self-Improving Autonomous Operations Center ────────────────────
const Phase17OpsCenter = lazy(() => import('./pages/Phase17OpsCenter'));

// Phase 18: Production Autonomous Distributed Orchestration OS
const Phase18OpsCenter = lazy(() => import('./pages/Phase18OpsCenter'));

// Phase 19: Autonomous Intelligence Foundation
const Phase19OpsCenter = lazy(() => import('./pages/Phase19OpsCenter'));
const Phase20OpsCenter = lazy(() => import('./pages/Phase20OpsCenter'));
const VoiceStudio     = lazy(() => import('./pages/VoiceStudio'));
const AutoProducer        = lazy(() => import('./pages/AutoProducer'));
const CreativeAgents      = lazy(() => import('./pages/CreativeAgents'));

// ── Phase 43A: Enterprise Media Cloud ─────────────────────────────────────
const MediaCloudPage = lazy(() => import('./pages/MediaCloudPage'));

// ── Phase 45: Global Autonomous Campaign Orchestration ──────────────────────
const Phase45OpsCenter = lazy(() => import('./pages/Phase45OpsCenter'));

const Spinner = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── Route guards ──────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user)   return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role as PlatformRole;
  if (!hasRole(role, 'support')) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role as PlatformRole;
  if (!hasRole(role, 'admin')) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────

function LandingRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingErrorBoundary><Landing /></LandingErrorBoundary>;
}

function WorkflowBuilderWrapper() {
  const { id } = useParams();
  return <WorkflowBuilder id={id || ''} />;
}

export default function App() {
  return (
    <AuthProvider>
        <WebSocketProvider>
        <WorkspaceProvider>
    <BrowserRouter>
      <CriticalAlertToaster />
      <Suspense fallback={<Spinner />}>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Appeals */}
          <Route path="/appeals" element={<RequireAuth><Appeals /></RequireAuth>} />

          {/* Core user routes */}
          <Route path="/dashboard"     element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/workflows/*"   element={<RequireAuth><Workflows /></RequireAuth>} />
          <Route path="/automations/*" element={<RequireAuth><Automations /></RequireAuth>} />
          <Route path="/connections"   element={<RequireAuth><Connections /></RequireAuth>} />
          <Route path="/intelligence"  element={<RequireAuth><Intelligence /></RequireAuth>} />
          <Route path="/profile"       element={<RequireAuth><Profile /></RequireAuth>} />

          {/* Phase 10C */}
          <Route path="/referrals"     element={<RequireAuth><Referrals /></RequireAuth>} />
          <Route path="/referral"      element={<Navigate to="/referrals" replace />} />
          <Route path="/wallet"        element={<RequireAuth><Wallet /></RequireAuth>} />

          {/* MFA Setup */}
          <Route path="/mfa/setup" element={
            <RequireAuth>
              <AdminRoute>
                <div className="min-h-screen bg-black flex items-center justify-center p-4">
                  <MFASetup onComplete={() => window.location.href = '/profile'} />
                </div>
              </AdminRoute>
            </RequireAuth>
          } />

          {/* Admin */}
          <Route path="/admin/*" element={
            <RequireAuth><AdminRoute><Admin /></AdminRoute></RequireAuth>
          } />

          {/* Super Admin */}
          <Route path="/super-admin/*" element={
            <RequireAuth><SuperAdminRoute><SuperAdmin /></SuperAdminRoute></RequireAuth>
          } />

          {/* Phase 10C — Financial Governance */}
          <Route path="/financial-governance/*" element={
            <RequireAuth><SuperAdminRoute><FinancialGovernance /></SuperAdminRoute></RequireAuth>
          } />

          {/* Phase 10D — Financial Integrity */}
          <Route path="/financial-integrity/*" element={
            <RequireAuth><SuperAdminRoute><FinancialIntegrityCenter /></SuperAdminRoute></RequireAuth>
          } />

          {/* Phase 10G */}
          <Route path="/share/execution/:token" element={<SharedExecutionPage />} />
          <Route path="/executions/:runId" element={<RequireAuth><ExecutionPage /></RequireAuth>} />
          <Route path="/plans"             element={<RequireAuth><Plans /></RequireAuth>} />
          <Route path="/settings"          element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/ai-chat"           element={<RequireAuth><AIChat /></RequireAuth>} />

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* Phase 13B: Integration Ecosystem & Automation Marketplace      */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <Route path="/marketplace"          element={<RequireAuth><Marketplace /></RequireAuth>} />
          <Route path="/integrations/:id"     element={<RequireAuth><IntegrationDetail /></RequireAuth>} />
          <Route path="/credentials"          element={<RequireAuth><CredentialManager /></RequireAuth>} />
          <Route path="/node-library"         element={<RequireAuth><NodeLibrary /></RequireAuth>} />
          <Route path="/webhooks"             element={<RequireAuth><WebhookManager /></RequireAuth>} />


          {/* Phase 13: Queue Mission Control */}
          <Route path="/queue-mission-control" element={<RequireAuth><SuperAdminRoute><QueueMissionControl /></SuperAdminRoute></RequireAuth>} />

          {/* Phase 16: Autonomous Operations Center */}
          <Route path="/autonomous-ops" element={<RequireAuth><SuperAdminRoute><AutonomousOpsCenter /></SuperAdminRoute></RequireAuth>} />

          {/* Phase 17: Self-Improving Autonomous OS */}
          <Route path="/phase17-ops" element={<RequireAuth><SuperAdminRoute><Phase17OpsCenter /></SuperAdminRoute></RequireAuth>} />

          {/* Phase 18: Production Autonomous Distributed Orchestration OS */}
          <Route path="/phase18-ops" element={<RequireAuth><SuperAdminRoute><Phase18OpsCenter /></SuperAdminRoute></RequireAuth>} />

          {/* Phase 19: Autonomous Intelligence Foundation */}
          <Route path="/phase19-ops" element={<RequireAuth><SuperAdminRoute><Phase19OpsCenter /></SuperAdminRoute></RequireAuth>} />
          <Route path="/phase20-ops" element={<RequireAuth><SuperAdminRoute><Phase20OpsCenter /></SuperAdminRoute></RequireAuth>} />

          {/* Phase 13.5: Integration Health */}
          <Route path="/integration-health" element={<RequireAuth><IntegrationHealth /></RequireAuth>} />

          {/* Phase 14: Analytics & Reports */}
          <Route path="/analytics" element={<RequireAuth><AnalyticsCenter /></RequireAuth>} />
          <Route path="/reports"   element={<RequireAuth><ReportsCenter /></RequireAuth>} />

          {/* Phase 8: Enterprise Runtime Intelligence Dashboard */}
          <Route path="/runtime-dashboard" element={
            <RequireAuth><AdminRoute><RuntimeDashboard /></AdminRoute></RequireAuth>
          } />

          <Route path="/workflow-builder/:id?" element={<RequireAuth><WorkflowBuilderWrapper /></RequireAuth>} />

          {/* Phase 35 — AI Voice Studio */}
          <Route path="/dashboard/voice-studio" element={<RequireAuth><VoiceStudio /></RequireAuth>} />

          {/* Phase 36 — Auto Producer */}
          <Route path="/dashboard/auto-producer" element={<RequireAuth><AutoProducer /></RequireAuth>} />

          {/* Phase 37 — AI Creative Agents */}
          <Route path="/dashboard/creative-agents" element={<RequireAuth><CreativeAgents /></RequireAuth>} />

          {/* Phase 43A — Enterprise Media Cloud */}
          <Route path="/media-cloud" element={<RequireAuth><MediaCloudPage /></RequireAuth>} />

          {/* Phase 45 — Global Autonomous Campaign Orchestration */}
          <Route path="/campaign-orchestration" element={<RequireAuth><Phase45OpsCenter /></RequireAuth>} />

          <Route path="/" element={<LandingRoute />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </WorkspaceProvider>
      </WebSocketProvider>
      </AuthProvider>
  );
}
