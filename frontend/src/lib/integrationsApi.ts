/**
 * AutoFlowNG — Integrations API Client
 * Phase 13: Frontend API bindings for the Integration Ecosystem.
 *
 * Extends the existing api.ts with Phase 13 endpoints.
 * Import from here rather than constructing URLs manually.
 */

import api from './api';

// ── Integration Marketplace ────────────────────────────────────────────────────
export const integrationsAPI = {
  list:     ()           => (api as any).get('/integrations'),
  get:      (id: string) => (api as any).get(`/integrations/${id}`),
  search:   (q: string)  => (api as any).get('/integrations/search', { params: { q } }),
  categories: ()         => (api as any).get('/integrations/categories'),

  connect:    (id: string, credentials: Record<string, string>, label?: string) =>
    (api as any).post(`/integrations/${id}/connect`, { credentials, label }),
  disconnect: (id: string) =>
    (api as any).delete(`/integrations/${id}/disconnect`),
  test:       (id: string) =>
    (api as any).post(`/integrations/${id}/test`),

  oauthStart: (id: string) =>
    `${(globalThis as any).__VITE_API_URL__ || ''}/api/integrations/${id}/oauth/start`,

  // Diagnostic: returns the exact redirect_uri the backend will send for
  // every OAuth platform, plus whether each one's client ID/secret env vars
  // are actually set. Use this instead of guessing why a provider rejects
  // the redirect_uri (Google "redirect_uri_mismatch", Notion "Missing or
  // invalid redirect_uri", etc) — paste the printed redirectUri values
  // directly into that provider's developer console.
  redirectConfig: () => (api as any).get('/integrations/oauth/redirect-config'),
};

// ── Discord (bot-invite flow — not OAuth2, see routes/integrations.js) ────────
// Discord runs on one shared DISCORD_BOT_TOKEN rather than per-user OAuth2,
// so it has its own two-step connect flow instead of the popup-based
// handleOAuth() every other integration uses: (1) open the bot invite link
// so the customer can add the bot to their server, then (2) submit the
// resulting Server ID so the backend can verify the bot is actually there.
export const discordAPI = {
  inviteUrl: () => (api as any).get('/integrations/discord/invite-url'),
  connect:   (guildId: string) => (api as any).post('/integrations/discord/connect', { guildId }),
};

// ── Node Library ───────────────────────────────────────────────────────────────
export const nodeLibraryAPI = {
  list:    () => (api as any).get('/integrations/nodes'),
  get:     (nodeType: string) => (api as any).get(`/integrations/nodes/${nodeType}`),
};

// ── Credential Vault ───────────────────────────────────────────────────────────
export const credentialsAPI = {
  list:    ()                                                          => (api as any).get('/credentials'),
  store:   (platform: string, credentials: any, label?: string)       => (api as any).post('/credentials', { platform, credentials, label }),
  update:  (platform: string, credentials: any)                       => (api as any).put(`/credentials/${platform}`, { credentials }),
  delete:  (platform: string)                                         => (api as any).delete(`/credentials/${platform}`),
  audit:   ()                                                          => (api as any).get('/credentials/audit'),
};

// ── Webhook System ─────────────────────────────────────────────────────────────
export const webhooksAPI = {
  list:         ()                                                 => (api as any).get('/webhooks'),
  generate:     (workflowId: number)                              => (api as any).post('/webhooks/generate', { workflowId }),
  test:         (url: string, body?: any, secret?: string)        => (api as any).post('/webhooks/test', { url, body, secret }),
  replay:       (deliveryId: string)                              => (api as any).post(`/webhooks/replay/${deliveryId}`),
  deliveries:   (workflowId: number)                              => (api as any).get(`/webhooks/deliveries/${workflowId}`),
};

// ── Query keys for React Query ─────────────────────────────────────────────────
export const integrationQueryKeys = {
  catalog:      ['integrations', 'catalog']                   as const,
  detail:       (id: string) => ['integrations', id]          as const,
  categories:   ['integrations', 'categories']                as const,
  nodes:        ['integrations', 'nodes']                     as const,
  node:         (type: string) => ['integrations', 'nodes', type] as const,
  credentials:  ['credentials']                               as const,
  credAudit:    ['credentials', 'audit']                      as const,
  webhooks:     ['webhooks']                                  as const,
  deliveries:   (id: number) => ['webhooks', 'deliveries', id] as const,
};
