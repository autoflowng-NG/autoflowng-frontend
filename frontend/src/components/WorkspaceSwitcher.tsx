/**
 * AutoFlowNG — Workspace Switcher (Phase 6.5)
 *
 * Cinematic workspace switching component for the navigation bar.
 * Shows active org/workspace badge and a dropdown to switch context.
 *
 * Features:
 *   - Grouped by organisation
 *   - Active workspace highlighted
 *   - Animated transitions (framer-motion)
 *   - Keyboard navigation
 *   - Loading states during switch
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ChevronDown, Check, Layers, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useWorkspace, type Workspace } from '../contexts/WorkspaceContext';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function groupByOrg(workspaces: Workspace[]): Record<string, Workspace[]> {
  return workspaces.reduce((acc, ws) => {
    const key = String(ws.org_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ws);
    return acc;
  }, {} as Record<string, Workspace[]>);
}

const ROLE_COLORS: Record<string, string> = {
  owner:    'text-amber-400',
  admin:    'text-blue-400',
  operator: 'text-emerald-400',
  viewer:   'text-zinc-400',
  member:   'text-zinc-400',
};

/* ── Component ───────────────────────────────────────────────────────────── */

interface WorkspaceSwitcherProps {
  className?: string;
}

export default function WorkspaceSwitcher({ className = '' }: WorkspaceSwitcherProps) {
  const {
    workspaces, activeWorkspace, activeOrgId, loading, error,
    switchWorkspace, switchOrg, refresh,
  } = useWorkspace();

  const [open,       setOpen]       = useState(false);
  const [switching,  setSwitching]  = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSwitch = useCallback(async (ws: Workspace) => {
    if (ws.id === activeWorkspace?.id) { setOpen(false); return; }
    setSwitching(ws.id);
    try {
      await switchWorkspace(ws.id, ws.org_id);
      setOpen(false);
    } finally {
      setSwitching(null);
    }
  }, [activeWorkspace, switchWorkspace]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }, [refresh]);

  const grouped = groupByOrg(workspaces);
  const orgIds  = Object.keys(grouped);

  const displayName = activeWorkspace
    ? (activeWorkspace.is_default ? activeWorkspace.org_name : activeWorkspace.name)
    : (loading ? 'Loading…' : 'Select workspace');

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-zinc-900 border border-zinc-800 hover:border-zinc-600
          text-sm text-zinc-200 font-medium
          transition-all duration-150 min-w-0 max-w-[220px]
          ${open ? 'border-amber-500/50 bg-zinc-800' : ''}
        `}
        aria-label="Switch workspace"
      >
        <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="truncate">{displayName}</span>
        {loading
          ? <Loader2 className="w-3 h-3 text-zinc-500 animate-spin shrink-0 ml-auto" />
          : <ChevronDown className={`w-3 h-3 text-zinc-500 shrink-0 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{    opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="
              absolute top-full mt-2 left-0 z-50
              w-64 rounded-xl
              bg-zinc-900 border border-zinc-800
              shadow-2xl shadow-black/60
              overflow-hidden
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Workspaces
              </span>
              <button
                onClick={handleRefresh}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Error state */}
            {error && (
              <div className="px-3 py-2 text-xs text-red-400 bg-red-900/20">
                {error}
              </div>
            )}

            {/* Empty state */}
            {!loading && workspaces.length === 0 && (
              <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                No workspaces found. Create or join an organisation.
              </div>
            )}

            {/* Workspace list grouped by org */}
            <div className="max-h-72 overflow-y-auto">
              {orgIds.map(orgId => {
                const orgWorkspaces = grouped[orgId];
                const orgName = orgWorkspaces[0].org_name;
                const orgRole = orgWorkspaces[0].org_role;
                return (
                  <div key={orgId}>
                    {/* Org header */}
                    <div className="flex items-center gap-2 px-3 py-1.5 mt-1">
                      <Building2 className="w-3 h-3 text-zinc-600 shrink-0" />
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate">
                        {orgName}
                      </span>
                      <span className={`ml-auto text-[9px] font-medium ${ROLE_COLORS[orgRole] ?? 'text-zinc-500'}`}>
                        {orgRole}
                      </span>
                    </div>

                    {/* Workspaces in org */}
                    {orgWorkspaces.map(ws => {
                      const isActive = ws.id === activeWorkspace?.id;
                      const isSwitching = switching === ws.id;
                      return (
                        <button
                          key={ws.id}
                          onClick={() => handleSwitch(ws)}
                          disabled={isSwitching}
                          className={`
                            w-full flex items-center gap-2.5 px-4 py-2
                            text-sm text-left transition-colors duration-100
                            ${isActive
                              ? 'bg-amber-500/10 text-amber-300'
                              : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                            }
                            ${isSwitching ? 'opacity-60 cursor-wait' : ''}
                          `}
                        >
                          <Layers className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-zinc-600'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">
                              {ws.is_default ? `${ws.org_name} (default)` : ws.name}
                            </div>
                            {!ws.is_default && (
                              <div className={`text-[10px] ${ROLE_COLORS[ws.workspace_role] ?? 'text-zinc-500'}`}>
                                {ws.workspace_role} · {ws.member_count} member{ws.member_count !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          {isSwitching && <Loader2 className="w-3 h-3 text-zinc-400 animate-spin shrink-0" />}
                          {isActive  && !isSwitching && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-800 px-3 py-2">
              <a
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Manage workspaces & organisations
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
