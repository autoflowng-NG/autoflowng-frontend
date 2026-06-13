/**
 * AutoFlowNG — Workspace Context (Phase 6.5)
 *
 * Provides the active workspace + org context to the entire app.
 * Handles workspace switching, membership loading, and persistence.
 *
 * Architecture:
 *   - Single fetch on mount to load all user workspaces + active state
 *   - switchWorkspace() updates backend + local state atomically
 *   - Consumed by: WorkspaceSwitcher, Dashboard, Analytics, Execution views
 *   - Compatible with WebSocketContext (sends org_id on WS auth)
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface Workspace {
  id:             number;
  name:           string;
  slug:           string;
  description:    string | null;
  is_default:     boolean;
  org_id:         number;
  org_name:       string;
  org_slug:       string;
  org_role:       string;
  workspace_role: string;
  member_count:   number;
  settings:       Record<string, unknown>;
  created_at:     string;
  updated_at:     string;
}

export interface WorkspaceContextValue {
  workspaces:         Workspace[];
  activeWorkspace:    Workspace | null;
  activeOrgId:        number | null;
  activeWorkspaceId:  number | null;
  loading:            boolean;
  error:              string | null;
  /** Switch to a different workspace by ID */
  switchWorkspace:    (workspaceId: number, orgId: number) => Promise<void>;
  /** Switch to an org's default workspace */
  switchOrg:          (orgId: number) => Promise<void>;
  /** Refresh the workspace list from the server */
  refresh:            () => Promise<void>;
}

/* ── Context ─────────────────────────────────────────────────────────────── */

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces:        [],
  activeWorkspace:   null,
  activeOrgId:       null,
  activeWorkspaceId: null,
  loading:           true,
  error:             null,
  switchWorkspace:   async () => {},
  switchOrg:         async () => {},
  refresh:           async () => {},
});

/* ── API base ────────────────────────────────────────────────────────────── */

const API = (
  import.meta.env?.VITE_API_URL ||
  'https://autoflowng-backend-production-dfa9.up.railway.app'
).replace(/\/$/, '');

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('autoflowng_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
}

/* ── Provider ────────────────────────────────────────────────────────────── */

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [workspaces,        setWorkspaces]        = useState<Workspace[]>([]);
  const [activeOrgId,       setActiveOrgId]       = useState<number | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) { setWorkspaces([]); setLoading(false); return; }
    try {
      setError(null);
      const res = await fetch(`${API}/api/workspaces`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setWorkspaces(data.workspaces ?? []);
      setActiveOrgId(data.active_org_id ?? null);
      setActiveWorkspaceId(data.active_workspace_id ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const switchWorkspace = useCallback(async (workspaceId: number, orgId: number) => {
    try {
      const res = await fetch(`${API}/api/workspaces/activate`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ workspace_id: workspaceId, org_id: orgId }),
      });
      if (!res.ok) throw new Error(`Switch failed: ${res.status}`);
      const data = await res.json();
      setActiveOrgId(data.active_org_id ?? orgId);
      setActiveWorkspaceId(data.active_workspace_id ?? workspaceId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, []);

  const switchOrg = useCallback(async (orgId: number) => {
    try {
      const res = await fetch(`${API}/api/workspaces/activate`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ org_id: orgId }),
      });
      if (!res.ok) throw new Error(`Switch failed: ${res.status}`);
      const data = await res.json();
      setActiveOrgId(data.active_org_id ?? orgId);
      setActiveWorkspaceId(data.active_workspace_id ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, []);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspace,
      activeOrgId,
      activeWorkspaceId,
      loading,
      error,
      switchWorkspace,
      switchOrg,
      refresh: fetchWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/* ── Hook ────────────────────────────────────────────────────────────────── */

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export default WorkspaceContext;
