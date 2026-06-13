/**
 * AutoFlowNG — Integrations API Client
 * Phase 13: Frontend API bindings for the Integration Ecosystem.
 *
 * Extends the existing api.ts with Phase 13 endpoints.
 * Import from here rather than constructing URLs manually.
 */

import { api } from './api';

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
