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
 *   - aiAPI.imageEdit: pixel-level image editing via Replicate
 *   - videoGenAPI: Phase 32 video generation endpoints
 *   - videoStyleAPI: Phase 31 style conversion endpoints
 *   - animationAPI: Phase 30 image animation endpoints
 *   - mediaCloudAPI: Phase 43 asset listing helpers
 */

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TIMEOUT_MS = 30_000;
const TOKEN_KEY = "autoflowng_token";

export const tokenStore = {
  get:    ()              => localStorage.getItem(TOKEN_KEY),
  set:    (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear:  ()              => localStorage.removeItem(TOKEN_KEY),
  exists: ()              => !!localStorage.getItem(TOKEN_KEY),
};

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

export const workflowsAPI = {
  list:      ()              => api.get("/workflows"),
  get:       (id: string)    => api.get(`/workflows/${id}`),
  create:    (data: any)     => api.post("/workflows", data),
  update:    (id: string, data: any) => api.put(`/workflows/${id}`, data),
  delete:    (id: string)    => api.delete(`/workflows/${id}`),
  toggle:    (id: string)    => api.post(`/workflows/${id}/toggle`),
  trigger:   (id: string, data: any = {}) => api.post(`/workflows/${id}/trigger`, data),
  runs:      (id: string)    => api.get(`/workflows/${id}/runs`),
  run:       (id: string, runId: string) => api.get(`/workflows/${id}/runs/${runId}`),
  validate:  (data: any)     => api.post("/workflows/validate", data),
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
  // Task 6: pixel-level image editing via Replicate
  imageEdit: (data: {
    imageUrl: string;
    prompt: string;
    negativePrompt?: string;
    strength?: number;
    guidanceScale?: number;
  }) => api.post("/ai/image-edit", data),
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
  withdraw: (data: any)    => api.post("/referrals/withdraw", data),
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
};

export const runsAPI = {
  recent: (limit = 60) =>
    api.get("/analytics", { params: { range: "30d" } })
      .then((d: any) => (d.recent_runs || []).slice(0, limit)),
  forWorkflow: (wfId: string) =>
    workflowsAPI.runs(wfId).then((d: any) => d.runs || d || []),
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

export const googleDriveAPI = {
  connect:    () => api.get("/integrations/google-drive/connect"),
  status:     () => api.get("/integrations/google-drive/status"),
  disconnect: () => api.post("/integrations/google-drive/disconnect", {}),
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
