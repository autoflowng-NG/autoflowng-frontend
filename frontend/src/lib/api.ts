/**
 * AUTOFLOWNG — Centralized API Client (Phase 10A)
 * Connects to external backend at VITE_API_URL
 * Handles: JWT auth, 401 handling, timeout, query params, typed endpoints
 *
 * Phase 10A additions:
 *   - superAdminAPI: Super Admin dashboard and RBAC management endpoints
 *   - adminAPI: Preserved for backward compatibility, now uses JWT auth
 *
 * Task additions:
 *   - aiAPI.globalKnowledge: Explore page grounded AI search
 *   - aiAPI.imageEdit: pixel-level image editing via fal.ai
 *   - videoGenAPI: Phase 32 video generation endpoints
 *   - videoStyleAPI: Phase 31 style conversion endpoints
 *   - animationAPI: Phase 30 image animation endpoints
 *   - mediaCloudAPI: Phase 43 asset listing helpers
 */

declare global { interface ImportMeta { env: Record<string, string | undefined>; } }
const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
// Fix (Bug 2): IntegrationDetail.tsx needs the backend's absolute base URL to
// open OAuth popups (Railway), but BASE_URL was a module-private constant —
// `(api as any).baseUrl` it was reaching for doesn't exist on the `api` object,
// so it silently evaluated to "" and OAuth popups opened a relative (Vercel) URL.
export const API_BASE_URL = BASE_URL;
const TIMEOUT_MS = 30_000;
const TOKEN_KEY = "autoflowng_token";

export const tokenStore = {
  get:    ()              => localStorage.getItem(TOKEN_KEY),
  set:    (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear:  ()              => localStorage.removeItem(TOKEN_KEY),
  exists: ()              => !!localStorage.getItem(TOKEN_KEY),
};

const orgStore = {
  _id: null as number | null,
  set(id: number | null) { this._id = id; },
  get(): number | null { return this._id; },
};
export const setActiveOrgId = (id: number | null) => orgStore.set(id);

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  raw?: boolean;
}

async function request(path: string, { method = "GET", body, params, headers = {}, raw = false }: RequestOptions = {}): Promise<any> {
  const token = tokenStore.get();

  let url = `${BASE_URL}/api${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]))
    );
    if (qs.toString()) url += `?${qs}`;
  }

  const reqHeaders: Record<string, string> = { "Content-Type": "application/json", ...headers };
  if (token) reqHeaders["Authorization"] = `Bearer ${token}`;
  const orgId = orgStore.get();
  if (orgId) reqHeaders["X-Org-Id"] = String(orgId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw { message: "Request timed out. Please try again.", status: 408, data: {} };
    throw { message: err.message || "Unable to reach server.", status: 0, data: {} };
  } finally {
    clearTimeout(timeoutId);
  }

  if (raw) return response;

  if (response.status === 401) {
    // Only clear token if we are NOT on the /auth/me path, 
    // or let AuthContext handle the /auth/me 401 specifically.
    // For now, we keep the global 401 clear but AuthContext will be more resilient.
    tokenStore.clear();
    window.dispatchEvent(new CustomEvent("autoflowng:unauthorized"));
    throw { message: "Session expired. Please log in again.", status: 401, data: {} };
  }

  let data: any = {};
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try { data = await response.json(); } catch { data = {}; }
  } else if (contentType.includes("text/")) {
    data = { text: await response.text() };
  }

  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed (${response.status})`;
    throw { message, status: response.status, data };
  }

  return data;
}

const api = {
  get:    (path: string, options: RequestOptions = {})                 => request(path, { ...options, method: "GET" }),
  post:   (path: string, body?: unknown, options: RequestOptions = {}) => request(path, { ...options, method: "POST", body }),
  put:    (path: string, body?: unknown, options: RequestOptions = {}) => request(path, { ...options, method: "PUT", body }),
  patch:  (path: string, body?: unknown, options: RequestOptions = {}) => request(path, { ...options, method: "PATCH", body }),
  delete: (path: string, options: RequestOptions = {})                 => request(path, { ...options, method: "DELETE" }),
  getRaw: (path: string, options: RequestOptions = {})                 => request(path, { ...options, method: "GET", raw: true }),
};

export const authAPI = {
  register:           (data: any)        => api.post("/auth/register", data),
  login:              (data: any)        => api.post("/auth/login", data),
  logout:             ()                 => api.post("/auth/logout"),
  me:                 ()                 => api.get("/auth/me"),
  updateProfile:      (data: any)        => api.put("/auth/profile", data),
  changePassword:     (data: any)        => api.post("/auth/change-password", data),
  forgotPassword:     (data: any)        => api.post("/auth/forgot-password", data),
  resetPassword:      (data: any)        => api.post("/auth/reset-password", data),
  resendVerification: ()                 => api.post("/auth/resend-verification"),
  verifyEmail:        (token: string)    => api.get("/auth/verify-email", { params: { token } }),
  stats:              ()                 => api.get("/user/stats"),
};

export const analyticsAPI = {
  get:       (range = "7d")  => api.get("/analytics", { params: { range } }),
  workflows: (days = 30)     => api.get("/analytics/workflows", { params: { days } }),
  ai:        (days = 30)     => api.get("/analytics/ai", { params: { days } }),
};

export const systemHealthAPI = {
  summary: () => api.get("/system/health/summary"),
};

export const resourceUsageAPI = {
  get: () => api.get("/dashboard/resource-usage"),
};

export const workflowsAPI = {
  list:             ()              => api.get("/workflows"),
  get:              (id: string)    => api.get(`/workflows/${id}`),
  create:           (data: any)     => api.post("/workflows", data),
  update:           (id: string, data: any) => api.put(`/workflows/${id}`, data),
  delete:           (id: string)    => api.delete(`/workflows/${id}`),
  toggle:           (id: string)    => api.post(`/workflows/${id}/toggle`),
  trigger:          (id: string, data: any = {}) => api.post(`/workflows/${id}/trigger`, data),
  runs:             (id: string)    => api.get(`/workflows/${id}/runs`),
  run:              (id: string, runId: string) => api.get(`/workflows/${id}/runs/${runId}`),
  validate:         (data: any)     => api.post("/workflows/validate", data),
  templates:        ()              => api.get("/workflows/templates"),
  activateTemplate: (templateId: string) => api.post(`/workflows/from-template/${templateId}`),
};

export const automationsAPI = {
  list:   ()               => api.get("/automations"),
  toggle: (data: any)      => api.post("/automations/toggle", data),
  run:    (templateId: string) => api.post(`/automations/${templateId}/run`),
  logs:   (templateId: string) => api.get(`/automations/${templateId}/logs`),
  delete: (templateId: string) => api.delete(`/automations/${templateId}`),
  tasks:  {
    list:   ()             => api.get("/automations/tasks"),
    create: (data: any)    => api.post("/automations/tasks", data),
  },
};

export const aiAPI = {
  chat:            (data: any)   => api.post("/ai/chat", data),
  knowledge:       (data: any)   => api.post("/ai/knowledge", data),
  // Task 1 + Task 2: Explore — grounded AI search using web search grounding
  globalKnowledge: (data: { query: string; category?: string; lang?: string }) =>
    api.post("/ai/knowledge", {
      messages: [{ role: "user", content: data.query }],
      mode: "general",
      lang: data.lang,
    }),
  generate:        (data: any)   => api.post("/ai/autoflowng-ai", data),
  status:          ()            => api.get("/ai/status"),
  // Task 6: pixel-level image editing via fal.ai
  imageEdit: (data: {
    imageUrl: string;
    prompt: string;
    negativePrompt?: string;
    strength?: number;
    guidanceScale?: number;
  }) => api.post("/ai/image-edit", data),
  // Text-to-image generation — no source image required
  imageGenerate: (data: {
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: 'square' | 'portrait' | 'landscape' | 'widescreen';
    guidanceScale?: number;
  }) => api.post("/ai/image-generate", data),
  sessions:  {
    list:    ()            => api.get("/ai/sessions"),
    delete:  (id: string)  => api.delete(`/ai/sessions/${id}`),
    rename:  (id: string, title: string) => api.put(`/ai/sessions/${id}/title`, { title }),
  },
  history:   (session = "agent", limit = 60) => api.get("/ai/history", { params: { session, limit } }),
};

export const connectionsAPI = {
  list:       ()           => api.get("/connections"),
  disconnect: (platform: string) => api.delete(`/connections/${platform}`),
  whatsapp:   (data: any)  => api.post("/connections/whatsapp", data),
  telegram:   (data: any)  => api.post("/connections/telegram", data),
  notify:     (data: any)  => api.post("/connections/telegram/notify", data),
  // Fix (Bug 1D): the "webhook" platform card had fields but no matching API
  // helper, so Connections.tsx's handleConnect() found `fn` null and did nothing.
  webhook:    (data: any)  => api.post("/connections/webhook", data),
  oauthUrl:   (platform: string, token: string) =>
    `${BASE_URL}/api/connections/${platform}?token=${encodeURIComponent(token)}`,
};

export const paymentsAPI = {
  initialize:   (data: any)       => api.post("/payments/initialize", data),
  verify:       (data: any)       => api.post("/payments/verify", data),
  history:      ()                => api.get("/payments/history"),
  config:       ()                => api.get("/config"),
  billingPlans: (region?: string) => api.get("/payments/billing/plans", { params: { region } }),
};

export const geoAPI = {
  detect: () => api.get("/geo/detect"),
};

export const referralsAPI = {
  stats:    ()             => api.get("/referrals/stats"),
  list:     ()             => api.get("/referrals"),
  balance:  ()             => api.get("/referrals/balance"),
  withdraw: (data: any)    => api.post("/wallet/withdraw", data),
};

// ── Saved payout bank accounts (shared by Wallet withdrawals + Affiliate apply) ─
export const payoutAccountAPI = {
  get:    ()           => api.get("/wallet/payout-account"),
  banks:  ()           => api.get("/wallet/payout-account/banks"),
  create: (data: { bankCode: string; bankName: string; accountNumber: string; accountName?: string }) =>
    api.post("/wallet/payout-account", data),
  update: (id: number, data: { bankCode: string; bankName: string; accountNumber: string; accountName?: string }) =>
    api.patch(`/wallet/payout-account/${id}`, data),
  remove: (id: number)  => api.delete(`/wallet/payout-account/${id}`),
};

// ── Affiliate Program (opt-in upgrade on top of the flat referral bounty) ──────
export const affiliatesAPI = {
  apply: (data: {
    full_name: string;
    promotional_channels: string[];
    primary_channel_url: string;
    audience_size_bucket: string;
    promotion_plan: string;
    payout_account_id: number;
    agree_terms: boolean;
    self_referral_ack: boolean;
  }) => api.post("/affiliates/apply", data),
  me:    ()      => api.get("/affiliates/me"),
};

// ── Public demo video gallery (landing page) ───────────────────────────────────
export const publicAPI = {
  demoVideos: (category?: string) => api.get("/public/demo-videos", { params: { category } }),
};

// ── Legacy Admin API (preserved for backward compat — uses x-admin-secret) ────
export const adminAPI = {
  overview:         ()                   => api.get("/admin/overview"),
  users:            (params?: any)       => api.get("/admin/users/all", { params }),
  updatePlan:       (id: string, plan: string) => api.patch(`/admin/users/${id}/plan`, { plan }),
  payments:         (params?: any)       => api.get("/admin/payments/all", { params }),
  automations:      ()                   => api.get("/admin/automations/all"),
  withdrawals:      ()                   => api.get("/admin/withdrawals"),
  updateWithdrawal: (id: string, status: string) => api.patch(`/admin/withdrawals/${id}`, { status }),
  system:           ()                   => api.get("/admin/system"),
  chat:             (data: any)          => api.post("/admin/chat", data),
  broadcast:        (data: any)          => api.post("/admin/broadcast", data),

  // Demo video gallery manager (multi-video)
  demoVideos: {
    list:    ()               => api.get("/admin/demo-video/all"),
    upload:  (data: {
      video_url: string; thumbnail_url?: string; title?: string;
      description?: string; category?: string; sort_order?: number; publish?: boolean;
    }) => api.post("/admin/demo-video/upload", data),
    update:  (id: number, data: any) => api.patch(`/admin/demo-video/${id}`, data),
    publish: (id: number, publish?: boolean) => api.patch(`/admin/demo-video/${id}/publish`, { publish }),
    remove:  (id: number)     => api.delete(`/admin/demo-video/${id}`),
  },
};

// ── Phase 10A: Super Admin API (JWT-based RBAC) ────────────────────────────────
export const superAdminAPI = {
  // Bootstrap (one-time super_admin creation)
  bootstrap:          (data: { name: string; email: string; password: string }, adminSecret: string) =>
    api.post("/super-admin/bootstrap", data, { headers: { "x-admin-secret": adminSecret } }),

  // Overview
  overview:           ()                         => api.get("/super-admin/overview"),

  // User management
  users:              (params?: {
    page?: number; limit?: number; search?: string;
    role?: string; plan?: string;
  })                                             => api.get("/super-admin/users", { params: params as any }),
  getUser:            (id: string)               => api.get(`/super-admin/users/${id}`),
  updateUserRole:     (id: string, role: string) => api.patch(`/super-admin/users/${id}/role`,     { role }),
  updateUserPlan:     (id: string, plan: string) => api.patch(`/super-admin/users/${id}/plan`,     { plan }),
  suspendUser:        (id: string, reason?: string) => api.patch(`/super-admin/users/${id}/suspend`,  { reason }),
  unsuspendUser:      (id: string)               => api.patch(`/super-admin/users/${id}/unsuspend`, {}),
  updateUserNotes:    (id: string, notes: string) => api.patch(`/super-admin/users/${id}/notes`,   { notes }),
  deleteUser:         (id: string)               => api.delete(`/super-admin/users/${id}`),

  // Staff management
  staff:              ()                         => api.get("/super-admin/staff"),
  createStaff:        (data: { name: string; email: string; password: string; role: string }) =>
    api.post("/super-admin/staff", data),
  updateStaffRole:    (id: string, role: string) => api.patch(`/super-admin/staff/${id}/role`, { role }),
  removeStaff:        (id: string)               => api.delete(`/super-admin/staff/${id}`),

  // Audit log
  auditLog:           (params?: { page?: number; limit?: number }) =>
    api.get("/super-admin/audit-log", { params: params as any }),

  // System & reports
  system:             ()                         => api.get("/super-admin/system"),
  payments:           (params?: { page?: number; limit?: number }) =>
    api.get("/super-admin/payments", { params: params as any }),
  withdrawals:        ()                         => api.get("/super-admin/withdrawals"),
  updateWithdrawal:   (id: string, status: string) => api.patch(`/super-admin/withdrawals/${id}`, { status }),
  chat:               (data: any)                => api.post("/super-admin/chat", data),
  broadcast:          (data: { message: string; target?: string }) =>
    api.post("/super-admin/broadcast", data),

  // Affiliate Applications (approve / reject / suspend)
  affiliates: {
    list:    (status?: string) => api.get("/super-admin/affiliates", { params: { status } }),
    approve: (id: number)      => api.patch(`/super-admin/affiliates/${id}/approve`),
    reject:  (id: number, reason: string) => api.patch(`/super-admin/affiliates/${id}/reject`, { reason }),
    suspend: (id: number, reason?: string) => api.patch(`/super-admin/affiliates/${id}/suspend`, { reason }),
  },
};

// ── Phase 10D+: Approval Requests API ─────────────────────────────────────────
export const approvalsAPI = {
  list: (params?: { status?: string }) =>
    api.get("/approvals", { params: params as any }),
  create: (data: {
    action_type: string;
    target_type: string;
    target_id: string;
    payload?: Record<string, any>;
    reason: string;
  }) => api.post("/approvals", data),
  approve: (id: string | number) =>
    api.patch(`/approvals/${id}/approve`),
  decline: (id: string | number, decision_reason: string) =>
    api.patch(`/approvals/${id}/decline`, { decision_reason }),
};

export const runsAPI = {
  recent: (limit = 60) =>
    api.get("/analytics", { params: { range: "30d" } })
      .then((d: any) => (d.recent_runs || []).slice(0, limit)),
  forWorkflow: (wfId: string) =>
    workflowsAPI.runs(wfId).then((d: any) => d.runs || d || []),
};

export const platformPausesAPI = {
  list:   ()                 => request("/platform-pauses"),
  pause:  (platform: string) => request("/platform-pauses", { method: "POST", body: { platform } }),
  resume: (platform: string) => request(`/platform-pauses/${platform}`, { method: "DELETE" }),
};

export const pingAPI = {
  check: () => fetch(`${BASE_URL}/api/ping`, { signal: AbortSignal.timeout(15000), cache: "no-store" }),
};

export default api;

/* ── Phase 5: Execution persistence + AI summaries ─────────────────────────── */
export const executionsAPI = {
  get:     (runId: string) => api.get(`/executions/${runId}`),
  summary: (runId: string) => api.post(`/executions/${runId}/summary`, {}),
};

export const eventsAPI = {
  replay: (since: number, until: number) =>
    api.get(`/events/replay`, { params: { since, until } }),
};

export const metricsAPI = {
  all:        ()           => api.get(`/workflows/metrics`),
  forWorkflow: (wfId: string) => api.get(`/workflows/${wfId}/metrics`),
  recompute:  (wfId: string) => api.post(`/workflows/${wfId}/runs/hydrate`, {}),
};

// ── Phase 12: Operational Intelligence & Audit Export ────────────────────────
export const operationalIntelligenceAPI = {
  queuePressure:      () => api.get('/operational-intelligence/queue-pressure'),
  bottlenecks:        () => api.get('/operational-intelligence/bottlenecks'),
  anomalies:          () => api.get('/operational-intelligence/anomalies'),
  forecast:           () => api.get('/operational-intelligence/forecast'),
  recommendations:    () => api.get('/operational-intelligence/recommendations'),
  dlqList:            (limit = 50, offset = 0) => api.get('/operational-intelligence/dlq', { params: { limit, offset } }),
  dlqRetry:           (jobId: string) => api.post(`/operational-intelligence/dlq/${jobId}/retry`, {}),
  presence:           () => api.get('/operational-intelligence/presence'),
  wsHealth:           () => api.get('/operational-intelligence/ws-health'),
};

export const auditExportAPI = {
  export:            (params: { start?: string; end?: string; format?: 'json'|'csv'; action?: string; org_id?: number; limit?: number }) =>
                       api.get('/audit-export', { params }),
  complianceReport:  (params: { start?: string; end?: string }) =>
                       api.get('/audit-export/compliance-report', { params }),
  orgExport:         (orgId: number, params: { start?: string; end?: string; format?: 'json'|'csv'; limit?: number }) =>
                       api.get(`/audit-export/org/${orgId}`, { params }),
};

export const readinessAPI = {
  readiness: () => api.get('/readiness'),
  deepHealth: () => api.get('/health/deep'),
};

export const newsAPI = {
  latest:     (limit = 30, language?: string) => api.get("/news/latest", { params: { limit, language } }),
  byCategory: (category: string, limit = 20)  => api.get(`/news/latest/${category}`, { params: { limit } }),
  search:     (q: string, category?: string, limit = 20) => api.get("/news/search", { params: { q, category, limit } }),
  categories: ()                              => api.get("/news/categories"),
};

// ── Phase 3A: Assistants, Onboarding, Google Drive ───────────────────────────
export const superAdminAssistantAPI = {
  query: (message: string, conversationId?: string) =>
    api.post("/super-admin/assistant/query", { message, conversationId }),
};

export const adminAssistantAPI = {
  query: (message: string, conversationId?: string) =>
    api.post("/admin/assistant/query", { message, conversationId }),
};

export const onboardingAPI = {
  get:   ()                          => api.get("/onboarding/state"),
  patch: (data: { current_step?: number; tour_completed?: boolean; tour_skipped?: boolean }) =>
    api.patch("/onboarding/state", data),
};

// BUGFIX (Bug 3): The old routes (/integrations/google-drive/connect|status|disconnect)
// never existed in backend/routes/integrations.js — all three returned 404. Also,
// "google-drive" (hyphen) didn't match the backend's "google_drive" (underscore) key.
// Rewritten to reuse the existing generic integration endpoints instead.
// NOTE: `connect` must NOT be called via api.get() — the backend does a res.redirect()
// to Google's consent screen. Use window.open() in GoogleDriveCard (see Connections.tsx).
export const googleDriveAPI = {
  connect:    () => `${API_BASE_URL}/api/integrations/google_drive/oauth/start`,  // returns URL string for window.open
  status:     () => api.get("/integrations/google_drive"),                         // { integration: { connected, connection, ... } }
  disconnect: () => api.delete("/integrations/google_drive/disconnect"),
};

// ── Task 5: Phase 30/31/32 Creative Studio APIs ───────────────────────────────

// Phase 32: Video Generation (mounted at /api/enterprise/video-gen)
export const videoGenAPI = {
  providers:    () => api.get("/enterprise/video-gen/video-providers"),
  cameraMotions:() => api.get("/enterprise/video-gen/camera-motions"),
  buildPrompt:  (data: { rawPrompt: string; cameraMotion?: string; stylePreset?: string; aspectRatio?: string }) =>
    api.post("/enterprise/video-gen/build-prompt", data),
  generate: (projectId: string, assetId: string, data: {
    provider: string;
    input_type: "prompt" | "storyboard" | "scene_plan";
    raw_input: string;
    duration_sec?: number;
    aspect_ratio?: string;
    output_format?: string;
    camera_motion?: string | null;
    style_preset?: string | null;
    negative_prompt?: string | null;
    seed?: number | null;
  }) => api.post(`/enterprise/video-gen/projects/${projectId}/assets/${assetId}/generate-video`, data),
  status: (projectId: string, assetId: string) =>
    api.get(`/enterprise/video-gen/projects/${projectId}/assets/${assetId}/generate-video`),
};

// Phase 31: Video Style Conversion (mounted at /api/analytics/style)
export const videoStyleAPI = {
  providers: () => api.get("/analytics/style/style-providers"),
  targets:   () => api.get("/analytics/style/style-targets"),
  apply: (projectId: string, assetId: string, data: {
    style_target: string;
    params?: Record<string, any>;
    provider?: string;
  }) => api.post(`/analytics/style/projects/${projectId}/assets/${assetId}/style`, data),
  status: (projectId: string, assetId: string) =>
    api.get(`/analytics/style/projects/${projectId}/assets/${assetId}/style`),
};

// Phase 30: Image-to-Video Animation (mounted at /api/analytics/animation)
export const animationAPI = {
  providers: () => api.get("/analytics/animation/animation-providers"),
  animate: (projectId: string, assetId: string, data: {
    style?: string;
    params?: Record<string, any>;
    provider?: string;
  }) => api.post(`/analytics/animation/projects/${projectId}/assets/${assetId}/animate`, data),
  status: (projectId: string, assetId: string) =>
    api.get(`/analytics/animation/projects/${projectId}/assets/${assetId}/animate`),
};

// ── Media Cloud asset picker helpers (for Creative Agents tabs) ───────────────
export const mediaCloudAPI = {
  listAssets: (params?: { search?: string; type?: string; status?: string; page?: number; limit?: number }) =>
    api.get("/ai/media-cloud/library", { params: params as any }),
  getAsset:   (assetId: string) =>
    api.get(`/ai/media-cloud/assets/${assetId}`),
  // Links a Media Cloud library asset into the Creative Agents pipeline
  // (Style/Animate/Edit), returning the pipeline_project_id/pipeline_asset_id
  // those tabs need. Safe to call repeatedly — reuses the existing link
  // after the first call.
  linkToPipeline: (assetId: string) =>
    api.post(`/ai/media-cloud/library/${assetId}/link-pipeline`),
};

// ── Quick Generate: auto-create pipeline + media_library_assets in one call ───
// POST /api/ai/quick-video        → { libraryAssetId, aiVideoJobId, projectId, assetId, status }
// GET  /api/ai/quick-video/:id/sync → { status, progress, output_url, synced }
// GET  /api/ai/quick-video/library  → { assets: Asset[] }
export const quickVideoAPI = {
  generate: (data: {
    prompt:        string;
    provider?:     string;
    aspect_ratio?: string;
    duration_sec?: number;
    output_format?: string;
  }) => api.post("/ai/quick-video", data),

  sync: (aiVideoJobId: string) =>
    api.get(`/ai/quick-video/${aiVideoJobId}/sync`),

  library: () => api.get("/ai/quick-video/library"),
};


// ── Ad Platform Accounts (Phase 42C) ─────────────────────────────────────────
// Endpoints served by routes/ad-platforms.js
export const adPlatformAPI = {
  /** List ad accounts available under the freshly-authed token */
  listAccounts: (platform: string) =>
    api.get(`/ad-platforms/${platform}/accounts`) as Promise<{ accounts: { id: string; name: string; currency?: string; status?: string }[] }>,

  /** Save the chosen account_id for a platform (replaces 'pending' row) */
  selectAccount: (platform: string, account_id: string, account_name: string) =>
    api.post(`/ad-platforms/${platform}/select-account`, { account_id, account_name }) as Promise<{ success: boolean; platform: string; account_id: string }>,

  /** List all connected ad platform accounts for the current user */
  listConnected: () =>
    api.get('/ad-platforms/connections') as Promise<{ connections: { id: number; platform: string; account_id: string; account_name?: string; status: string; connected_at: string }[] }>,

  /** Revoke (delete) a specific ad account connection */
  revoke: (platform: string, accountId: string) =>
    api.delete(`/ad-platforms/${platform}/${accountId}`) as Promise<{ success: boolean }>,

  /**
   * Fetch account-level aggregated metrics (spend, impressions, clicks, CTR, CPM, CPC, conversions).
   * dateRange: 'last_7d' | 'last_30d'  (default: 'last_7d')
   */
  accountInsights: (platform: string, accountId: string, dateRange: 'last_7d' | 'last_30d' = 'last_7d') =>
    api.get(`/ad-platforms/${platform}/${accountId}/account-insights`, { params: { date_range: dateRange } }) as Promise<{
      platform: string;
      account_id: string;
      date_range: string;
      metrics: {
        views: number; clicks: number; spend_usd: number;
        ctr: number; cpm: number; cpc: number; conversions: number;
      };
    }>,

  /**
   * List active/paused campaigns for a connected ad account.
   * Returns id, name, status, objective, budget, budget_type per campaign.
   */
  listCampaigns: (platform: string, accountId: string, limit = 50) =>
    api.get(`/ad-platforms/${platform}/${accountId}/campaigns`, { params: { limit } }) as Promise<{
      platform: string;
      account_id: string;
      campaigns: {
        id: string; name: string; status: string;
        objective: string | null; budget: number | null; budget_type: string | null;
      }[];
    }>,

  /**
   * Pause or resume a single campaign.
   * action: 'pause' | 'resume'
   * Returns { success, platform, account_id, campaign_id, status }
   */
  setCampaignStatus: (platform: string, accountId: string, campaignId: string, action: 'pause' | 'resume') =>
    api.patch(`/ad-platforms/${platform}/${accountId}/campaigns/${campaignId}/status`, { action }) as Promise<{
      success: boolean; platform: string; account_id: string; campaign_id: string; status: string;
    }>,

  /**
   * Update the budget for a single campaign.
   * new_budget_usd: positive dollar amount (Google: daily budget; Meta/LinkedIn: lifetime; TikTok: total)
   * Returns { success, platform, account_id, campaign_id, new_budget_usd }
   */
  updateCampaignBudget: (platform: string, accountId: string, campaignId: string, newBudgetUsd: number) =>
    api.patch(`/ad-platforms/${platform}/${accountId}/campaigns/${campaignId}/budget`, { new_budget_usd: newBudgetUsd }) as Promise<{
      success: boolean; platform: string; account_id: string; campaign_id: string; new_budget_usd: number;
    }>,

  /**
   * Daily spend sparkline data for a campaign (always last 7 days).
   * Returns { platform, account_id, campaign_id, days: Array<{ date: string, spend_usd: number }> }
   */
  campaignDailySpend: (platform: string, accountId: string, campaignId: string) =>
    api.get(`/ad-platforms/${platform}/${accountId}/campaigns/${campaignId}/daily-spend`) as Promise<{
      platform: string; account_id: string; campaign_id: string;
      days: { date: string; spend_usd: number }[];
    }>,
};


// ── Campaign Agents (Phase 42A–46 Unified API) ────────────────────────────────
// Endpoints served by routes/campaign-agent.js, routes/campaigns.js, routes/platform.js, routes/publishing-gate.js
export const campaignAgents = {
  /** Launch a new autonomous campaign. POST /api/campaign-agent/launch */
  launch: (prompt: string) =>
    api.post('/campaign-agent/launch', { prompt }) as Promise<{ campaignId: string }>,

  /** Get campaign agent status/assets. GET /api/campaign-agent/status/:campaignId */
  status: (campaignId: string) =>
    api.get(`/campaign-agent/status/${campaignId}`) as Promise<{
      campaignId: string; assets: any[]; count: number;
    }>,

  /** List all campaigns. GET /api/campaigns */
  list: (params?: { status?: string; limit?: number }) =>
    api.get('/campaigns', { params }) as Promise<{ campaigns: any[]; total: number }>,

  /** Get single campaign. GET /api/campaigns/:id */
  get: (id: string) =>
    api.get(`/campaigns/${id}`) as Promise<any>,

  /** Approve campaign plan. PATCH /api/campaigns/:id/approve */
  approve: (id: string) =>
    api.patch(`/campaigns/${id}/approve`, {}) as Promise<any>,

  /** Pause campaign. PATCH /api/campaigns/:id/pause */
  pause: (id: string) =>
    api.patch(`/campaigns/${id}/pause`, {}) as Promise<any>,

  /** Resume campaign. PATCH /api/campaigns/:id/resume */
  resume: (id: string) =>
    api.patch(`/campaigns/${id}/resume`, {}) as Promise<any>,

  /** Submit campaign brief. POST /api/campaigns/:id/brief */
  brief: (id: string, brief: string) =>
    api.post(`/campaigns/${id}/brief`, { brief }) as Promise<any>,

  /** Get campaign assets. GET /api/campaigns/:id/assets */
  assets: (id: string) =>
    api.get(`/campaigns/${id}/assets`) as Promise<{ assets: any[] }>,

  /** Get campaign jobs. GET /api/campaigns/:id/jobs */
  jobs: (id: string) =>
    api.get(`/campaigns/${id}/jobs`) as Promise<{ jobs: any[] }>,

  /** Get campaign analytics summary. GET /api/campaigns/analytics/summary */
  analyticsSummary: (days: number) =>
    api.get('/campaigns/analytics/summary', { params: { days } }) as Promise<any>,

  /** Get campaign analytics detail. GET /api/campaigns/analytics/:id */
  analyticsDetail: (id: string, days: number) =>
    api.get(`/campaigns/analytics/${id}`, { params: { days } }) as Promise<any>,

  /** Get org approval queue. GET /api/platform/campaigns/orgs/:orgId/approval-queue */
  approvalQueue: (orgId: string) =>
    api.get(`/platform/campaigns/orgs/${orgId}/approval-queue`, { params: { limit: 50 } }) as Promise<any>,

  /** Get org escalation queue. GET /api/platform/campaigns/orgs/:orgId/escalation-queue */
  escalationQueue: (orgId: string) =>
    api.get(`/platform/campaigns/orgs/${orgId}/escalation-queue`, { params: { limit: 50 } }) as Promise<any>,

  /** Act on approval queue item. POST /api/platform/campaigns/approval-queue/:id/action */
  approvalAction: (id: string, action: string, note?: string) =>
    api.post(`/platform/campaigns/approval-queue/${id}/action`, { action, note }) as Promise<any>,

  /** Get org campaigns lifecycle. GET /api/platform/campaigns/orgs/:orgId/campaigns/lifecycle */
  lifecycle: (orgId: string) =>
    api.get(`/platform/campaigns/orgs/${orgId}/campaigns/lifecycle`, { params: { limit: 50 } }) as Promise<any>,

  /** Optimize budget for a campaign (compute + optionally apply). POST /api/campaigns/:id/optimize-budget */
  optimizeBudget: (id: string, apply?: boolean) =>
    api.post(`/campaigns/${id}/optimize-budget`, { apply }) as Promise<any>,

  /** List existing budget reallocation proposals. GET /api/platform/campaign-optim/campaigns/:id/budget-reallocations */
  budgetReallocations: (id: string) =>
    api.get(`/platform/campaign-optim/campaigns/${id}/budget-reallocations`) as Promise<any>,

  /** Get risk audit entries for a campaign. GET /api/platform/campaigns/campaigns/:id/risk/audit */
  riskAudit: (id: string) =>
    api.get(`/platform/campaigns/campaigns/${id}/risk/audit`) as Promise<any>,

  /** Get risk thresholds. GET /api/platform/campaigns/orgs/:orgId/risk-thresholds */
  riskThresholds: (orgId: string) =>
    api.get(`/platform/campaigns/orgs/${orgId}/risk-thresholds`) as Promise<any>,

  /** Get performance metrics snapshot for a campaign. GET /api/campaigns/:id/performance-metrics */
  performanceMetrics: (id: string) =>
    api.get(`/campaigns/${id}/performance-metrics`) as Promise<any>,

  /** Check publishing gate. GET /api/publishing-gate/:jobId/check */
  gateCheck: (jobId: string) =>
    api.get(`/publishing-gate/${jobId}/check`) as Promise<any>,

  /** Set publishing gate. POST /api/publishing-gate/:jobId/set */
  gateSet: (jobId: string, requires_approval: boolean) =>
    api.post(`/publishing-gate/${jobId}/set`, { requires_approval }) as Promise<any>,
};

// ── Brands (routes/brands.js) ───────────────────────────────────────────────
export const brandAPI = {
  /** List brands for the active org. GET /api/brands (returns a raw array). */
  list: () => api.get('/brands') as Promise<{ id: string; name: string }[]>,

  /** Get a single brand. GET /api/brands/:id */
  get: (id: string) => api.get(`/brands/${id}`) as Promise<any>,
};

// ── Caption/Copy Engine (Phase 47B) ────────────────────────────────────────
// Endpoints served by routes/caption-engine.js
export type CaptionTone = 'professional' | 'gen_z' | 'naija';

export interface CaptionEngineOutput {
  meta_ads: { primary_text: string; headline: string; cta: string };
  google_search: { headline_1: string; headline_2: string; headline_3: string; description_1: string; description_2: string };
  tiktok_ads: { on_screen_hook: string; video_script: string; caption_text: string };
  linkedin_ads: { introductory_text: string; headline: string };
}

export const captionEngine = {
  /** Generate multi-channel ad copy. POST /api/caption-engine/generate */
  generate: (input: { product: string; offer?: string; audience?: string; tone: CaptionTone; brandId?: string }) =>
    api.post('/caption-engine/generate', input) as Promise<{ draftId: number | null; output: CaptionEngineOutput }>,

  /** Rewrite a single field. POST /api/caption-engine/rewrite-line */
  rewriteLine: (input: {
    platform: string; field: string; currentText: string;
    product: string; offer?: string; audience?: string; tone: CaptionTone;
  }) => api.post('/caption-engine/rewrite-line', input) as Promise<{ text: string }>,

  /** List saved drafts. GET /api/caption-engine/drafts */
  listDrafts: (limit = 20) =>
    api.get('/caption-engine/drafts', { params: { limit } }) as Promise<{ drafts: any[] }>,

  /** Get a single draft. GET /api/caption-engine/drafts/:id */
  getDraft: (id: number | string) =>
    api.get(`/caption-engine/drafts/${id}`) as Promise<any>,

  /** Save a brand's target audience. PUT /api/caption-engine/brands/:brandId/audience */
  saveAudience: (brandId: string, targetAudience: string) =>
    api.put(`/caption-engine/brands/${brandId}/audience`, { targetAudience }) as Promise<{ ok: boolean }>,

  /** Save a brand's banned words list. PUT /api/caption-engine/brands/:brandId/banned-words */
  saveBannedWords: (brandId: string, words: string[]) =>
    api.put(`/caption-engine/brands/${brandId}/banned-words`, { words }) as Promise<{ ok: boolean }>,
};
