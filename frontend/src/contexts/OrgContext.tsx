/**
 * OrgContext — Phase 6
 *
 * Manages organization state for the authenticated user.
 * Provides:
 *   - list of orgs the user belongs to
 *   - active org selection + persistence
 *   - member/role helpers
 *   - org CRUD operations
 */
import {
  createContext, useContext, useState,
  useEffect, useCallback, useMemo, type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

const API_BASE = (import.meta.env?.VITE_API_URL || "https://autoflowng-backend-production-dfa9.up.railway.app")
  .replace(/\/$/, "");

async function apiFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${path} → ${res.status}`);
  }
  return res.json();
}

/* ── Types ───────────────────────────────────────────────────────────── */
export type OrgRole = "owner" | "admin" | "operator" | "viewer";

export interface OrgMember {
  user_id:    number;
  user_name:  string;
  email:      string;
  role:       OrgRole;
  accepted_at: string | null;
  avatar_url: string | null;
}

export interface PendingInvitation {
  id:         number;
  email:      string;
  role:       OrgRole;
  expires_at: string;
  created_at: string;
}

export interface Org {
  id:           number;
  name:         string;
  slug:         string;
  plan:         string;
  owner_id:     number;
  member_count: number;
  workflow_count?: number;
  role:         OrgRole;
  created_at:   string;
}

export interface OrgContextValue {
  orgs:          Org[];
  activeOrg:     Org | null;
  myRole:        OrgRole | null;
  isLoading:     boolean;
  setActiveOrg:  (org: Org | null) => void;
  createOrg:     (name: string) => Promise<Org>;
  refreshOrgs:   () => Promise<void>;
  canDo:         (action: OrgAction) => boolean;
  // BUGFIX: the backend (routes/organizations.js) already has a complete,
  // working member-management API — list/invite/change-role/remove — but
  // nothing in the frontend ever called it. There was no Invite UI at all.
  getMembers:    (orgId: number) => Promise<{ members: OrgMember[]; pending_invitations: PendingInvitation[] }>;
  inviteMember:  (orgId: number, email: string, role: OrgRole) => Promise<{ token: string; invite_url: string; expires_at: string }>;
  changeRole:    (orgId: number, userId: number, role: OrgRole) => Promise<void>;
  removeMember:  (orgId: number, userId: number) => Promise<void>;
  acceptInvite:  (token: string) => Promise<{ org_id: number; role: OrgRole }>;
  resendInvite:  (orgId: number, invId: number) => Promise<{ token: string; invite_url: string; expires_at: string }>;
  revokeInvite:  (orgId: number, invId: number) => Promise<void>;
}

type OrgAction = "manage_members" | "invite" | "view_audit" | "delete_org" | "create_workflow" | "trigger_workflow" | "view_executions";

const ACTION_MIN_ROLE: Record<OrgAction, OrgRole> = {
  manage_members:   "admin",
  invite:           "admin",
  view_audit:       "admin",
  delete_org:       "owner",
  create_workflow:  "operator",
  trigger_workflow: "operator",
  view_executions:  "viewer",
};

const ROLE_RANK: Record<OrgRole, number> = { owner: 4, admin: 3, operator: 2, viewer: 1 };

const STORAGE_KEY = "af_active_org_id";

/* ── Context ─────────────────────────────────────────────────────────── */
const OrgContext = createContext<OrgContextValue | null>(null);

/* ── Provider ────────────────────────────────────────────────────────── */
export function OrgProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token } = useAuth();
  const [orgs,      setOrgs]     = useState<Org[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Org | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrgs = useCallback(async () => {
    if (!isAuthenticated) return;
    const tok = token();
    if (!tok) return;
    setIsLoading(true);
    try {
      const data = await apiFetch("/orgs", tok);
      const fetched: Org[] = data.orgs || [];
      setOrgs(fetched);

      // Restore persisted active org
      const savedId = sessionStorage.getItem(STORAGE_KEY);
      if (savedId) {
        const found = fetched.find(o => String(o.id) === savedId);
        if (found) { setActiveOrgState(found); return; }
      }
      // Default to first org if any
      if (fetched.length > 0 && !activeOrg) setActiveOrgState(fetched[0]);
    } catch (e) {
      console.warn("[OrgContext]", e);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const setActiveOrg = useCallback((org: Org | null) => {
    setActiveOrgState(org);
    if (org) sessionStorage.setItem(STORAGE_KEY, String(org.id));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const createOrg = useCallback(async (name: string): Promise<Org> => {
    const tok = token();
    if (!tok) throw new Error("Not authenticated");
    const data = await apiFetch("/orgs", tok, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    await fetchOrgs();
    return data.org;
  }, [token, fetchOrgs]);

  // BUGFIX: these five didn't exist anywhere on the frontend. The backend
  // routes (GET/:orgId/members, POST /:orgId/invite, PATCH /:orgId/members/
  // :memberId, DELETE /:orgId/members/:memberId, POST /invitations/:token/
  // accept) were fully built and working, but unreachable — there was no
  // Invite Member button, no member list, and no /accept-invite page.
  const getMembers = useCallback(async (orgId: number) => {
    const tok = token();
    if (!tok) throw new Error("Not authenticated");
    return apiFetch(`/orgs/${orgId}/members`, tok);
  }, [token]);

  const inviteMember = useCallback(async (orgId: number, email: string, role: OrgRole) => {
    const tok = token();
    if (!tok) throw new Error("Not authenticated");
    return apiFetch(`/orgs/${orgId}/invite`, tok, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  }, [token]);

  const changeRole = useCallback(async (orgId: number, userId: number, role: OrgRole) => {
    const tok = token();
    if (!tok) throw new Error("Not authenticated");
    await apiFetch(`/orgs/${orgId}/members/${userId}`, tok, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }, [token]);

  const removeMember = useCallback(async (orgId: number, userId: number) => {
    const tok = token();
    if (!tok) throw new Error("Not authenticated");
    await apiFetch(`/orgs/${orgId}/members/${userId}`, tok, { method: "DELETE" });
  }, [token]);

  const acceptInvite = useCallback(async (inviteToken: string) => {
    const tok = token();
    if (!tok) throw new Error("Not authenticated");
    const data = await apiFetch(`/orgs/invitations/${inviteToken}/accept`, tok, { method: "POST" });
    await fetchOrgs();
    return data;
  }, [token, fetchOrgs]);

  const resendInvite = useCallback(async (orgId: number, invId: number) => {
    const tok = token();
    if (!tok) throw new Error("Not authenticated");
    return apiFetch(`/orgs/${orgId}/invite/resend/${invId}`, tok, { method: "POST" });
  }, [token]);

  const revokeInvite = useCallback(async (orgId: number, invId: number) => {
    const tok = token();
    if (!tok) throw new Error("Not authenticated");
    await apiFetch(`/orgs/${orgId}/invite/${invId}`, tok, { method: "DELETE" });
  }, [token]);

  const myRole: OrgRole | null = activeOrg?.role ?? null;

  const canDo = useCallback((action: OrgAction): boolean => {
    if (!myRole) return false;
    const minRole = ACTION_MIN_ROLE[action];
    return (ROLE_RANK[myRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0);
  }, [myRole]);

  const value = useMemo<OrgContextValue>(() => ({
    orgs, activeOrg, myRole, isLoading,
    setActiveOrg, createOrg,
    refreshOrgs: fetchOrgs,
    canDo,
    getMembers, inviteMember, changeRole, removeMember, acceptInvite,
    resendInvite, revokeInvite,
  }), [orgs, activeOrg, myRole, isLoading, setActiveOrg, createOrg, fetchOrgs, canDo, getMembers, inviteMember, changeRole, removeMember, acceptInvite, resendInvite, revokeInvite]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

/* ── Consumer hooks ──────────────────────────────────────────────────── */
export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}

export function useOrgRole(): OrgRole | null {
  return useOrg().myRole;
}
