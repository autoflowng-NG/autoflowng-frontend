/**
 * useOrgWorkflows — Phase 6.5
 *
 * Org-aware React Query hooks that:
 *   1. Include orgId in query keys → cache invalidates on workspace switch
 *   2. Pass X-Org-Id header to backend so queries are org-scoped
 *   3. Expose org execution feed + org-scoped replay
 *
 * Drop-in alongside existing useWorkflows — Workflows page will prefer
 * org-aware hooks when an active org is set.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrg } from "../contexts/OrgContext";
import { useAuth } from "../contexts/AuthContext";
import { queryClient } from "../lib/queryClient";

const API_BASE = (import.meta.env?.VITE_API_URL || "https://autoflowng-backend-production-dfa9.up.railway.app")
  .replace(/\/$/, "");

async function orgFetch(path: string, token: string, orgId: number | null, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${token}`,
    ...(orgId ? { "X-Org-Id": String(orgId) } : {}),
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${API_BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${path} → ${res.status}`);
  }
  return res.json();
}

/* ── useOrgWorkflows — org-scoped workflow list ──────────────────────── */
export function useOrgWorkflows() {
  const { activeOrg } = useOrg();
  const { token }     = useAuth();
  const orgId         = activeOrg?.id ?? null;

  return useQuery({
    // orgId in key — cache invalidates when workspace switches
    queryKey: ["workflows", "org", orgId],
    queryFn:  async () => {
      const tok = token();
      if (!tok) return [];
      if (orgId) {
        // Org-scoped: includes health metrics per workflow
        const d = await orgFetch(`/orgs/${orgId}/workflows`, tok, orgId);
        return d.workflows || [];
      } else {
        // Personal workspace
        const d = await orgFetch("/workflows", tok, null);
        return d.workflows || [];
      }
    },
    staleTime: 30_000,
  });
}

/* ── useOrgExecutionFeed — org execution stream ──────────────────────── */
export function useOrgExecutionFeed(limit = 50) {
  const { activeOrg } = useOrg();
  const { token }     = useAuth();
  const orgId         = activeOrg?.id ?? null;

  return useQuery({
    queryKey: ["executions", "org", orgId, limit],
    queryFn:  async () => {
      if (!orgId) return [];
      const tok = token();
      if (!tok) return [];
      const d = await orgFetch(`/orgs/${orgId}/executions?limit=${limit}`, tok, orgId);
      return d.executions || [];
    },
    enabled:  !!orgId,
    refetchInterval: 15_000, // poll every 15s for team feed
  });
}

/* ── useOrgAlertRules ────────────────────────────────────────────────── */
export function useOrgAlertRules() {
  const { activeOrg }  = useOrg();
  const { token }      = useAuth();
  const orgId          = activeOrg?.id ?? null;
  const qc             = useQueryClient();

  const query = useQuery({
    queryKey: ["alert-rules", "org", orgId],
    queryFn:  async () => {
      if (!orgId) return [];
      const tok = token();
      if (!tok) return [];
      const d = await orgFetch(`/orgs/${orgId}/alerts/rules`, tok, orgId);
      return d.rules || [];
    },
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: async (rule: {
      workflow_id: number; name: string; metric: string;
      operator: string; threshold: number; severity?: string;
    }) => {
      const tok = token();
      if (!tok || !orgId) throw new Error("Not authenticated or no active org");
      return orgFetch(`/orgs/${orgId}/alerts/rules`, tok, orgId, {
        method: "POST",
        body: JSON.stringify(rule),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-rules", "org", orgId] }),
  });

  return { ...query, createRule: create };
}

/* ── invalidateOrgWorkflows — call on workspace switch ───────────────── */
export function invalidateOrgWorkflows(orgId: number | null) {
  queryClient.invalidateQueries({ queryKey: ["workflows", "org", orgId] });
  queryClient.invalidateQueries({ queryKey: ["executions", "org", orgId] });
  queryClient.invalidateQueries({ queryKey: ["alert-rules", "org", orgId] });
}

/* ── useWorkspaceSwitch — triggers cache invalidation on org change ──── */
export function useWorkspaceSwitch() {
  const { setActiveOrg } = useOrg();

  return (org: Parameters<typeof setActiveOrg>[0]) => {
    setActiveOrg(org);
    // Invalidate all org-keyed queries so new workspace data loads
    const orgId = org?.id ?? null;
    invalidateOrgWorkflows(orgId);
    // Also invalidate personal workflow cache in case they overlap
    queryClient.invalidateQueries({ queryKey: ["workflows"] });
  };
}
