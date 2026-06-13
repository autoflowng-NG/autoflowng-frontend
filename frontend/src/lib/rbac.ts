/**
 * AutoFlowNG — Frontend RBAC Utilities (Phase 10A)
 *
 * Single source of truth for role-based access control on the client.
 * Mirrors the backend RBAC system but enforces display/navigation only —
 * real authorization is always enforced server-side.
 *
 * ROLE HIERARCHY (highest → lowest):
 *   super_admin > admin > operator > support > viewer > user
 */

export type PlatformRole = 'super_admin' | 'admin' | 'operator' | 'support' | 'viewer' | 'user';

export const ROLE_RANK: Record<PlatformRole, number> = {
  super_admin: 100,
  admin:        80,
  operator:     60,
  support:      40,
  viewer:       20,
  user:          0,
};

export const ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  operator:    'Operator',
  support:     'Support',
  viewer:      'Viewer',
  user:        'User',
};

export const ROLE_COLORS: Record<PlatformRole, string> = {
  super_admin: '#F59E0B',   // amber
  admin:       '#FB7185',   // pink/red
  operator:    '#A78BFA',   // purple
  support:     '#38BDF8',   // sky blue
  viewer:      '#94A3B8',   // slate
  user:        '#64748B',   // muted slate
};

export const ROLE_BG_COLORS: Record<PlatformRole, string> = {
  super_admin: 'rgba(245,158,11,0.12)',
  admin:       'rgba(251,113,133,0.12)',
  operator:    'rgba(167,139,250,0.12)',
  support:     'rgba(56,189,248,0.12)',
  viewer:      'rgba(148,163,184,0.12)',
  user:        'rgba(100,116,139,0.08)',
};

/** Returns true if the user's role meets or exceeds minRole */
export function hasRole(userRole: string | undefined, minRole: PlatformRole): boolean {
  const userRank = ROLE_RANK[(userRole as PlatformRole) ?? 'user'] ?? 0;
  const minRank  = ROLE_RANK[minRole] ?? 0;
  return userRank >= minRank;
}

/** Returns true if user is super_admin */
export function isSuperAdmin(role?: string): boolean {
  return role === 'super_admin';
}

/** Returns true if user is admin or above */
export function isPlatformAdmin(role?: string): boolean {
  return hasRole(role, 'admin');
}

/** Returns true if user is operator or above */
export function isOperator(role?: string): boolean {
  return hasRole(role, 'operator');
}

/** Returns true if user is support or above */
export function isSupport(role?: string): boolean {
  return hasRole(role, 'support');
}

/** Returns true if user is a regular user (no elevated role) */
export function isRegularUser(role?: string): boolean {
  return !role || role === 'user';
}

export type Permission =
  | 'manage_staff'
  | 'view_all_admin'
  | 'manage_users'
  | 'manage_plans'
  | 'manage_withdrawals'
  | 'broadcast_messages'
  | 'view_payments'
  | 'view_users'
  | 'view_automations'
  | 'view_system_health'
  | 'admin_ai_chat'
  | 'view_audit_log'
  | 'suspend_users'
  | 'delete_users';

export const PERMISSIONS: Record<Permission, PlatformRole[]> = {
  manage_staff:        ['super_admin'],
  view_all_admin:      ['super_admin', 'admin'],
  manage_users:        ['super_admin', 'admin'],
  manage_plans:        ['super_admin', 'admin'],
  manage_withdrawals:  ['super_admin', 'admin'],
  broadcast_messages:  ['super_admin', 'admin'],
  view_payments:       ['super_admin', 'admin', 'support'],
  view_users:          ['super_admin', 'admin', 'operator', 'support'],
  view_automations:    ['super_admin', 'admin', 'operator', 'support'],
  view_system_health:  ['super_admin', 'admin', 'operator'],
  admin_ai_chat:       ['super_admin', 'admin'],
  view_audit_log:      ['super_admin', 'admin'],
  suspend_users:       ['super_admin', 'admin'],
  delete_users:        ['super_admin'],
};

/** Returns true if the given role has the named permission */
export function canDo(role: string | undefined, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] ?? [];
  return allowed.includes((role ?? 'user') as PlatformRole);
}

/** Returns the badge config for a role */
export function getRoleBadge(role: string | undefined) {
  const r = (role ?? 'user') as PlatformRole;
  return {
    label:   ROLE_LABELS[r]  ?? role ?? 'Unknown',
    color:   ROLE_COLORS[r]  ?? '#64748B',
    bg:      ROLE_BG_COLORS[r] ?? 'rgba(100,116,139,0.08)',
  };
}

/** Sorted list of staff-level roles for dropdowns */
export const STAFF_ROLES: PlatformRole[] = ['admin', 'operator', 'support', 'viewer'];
export const ALL_PLATFORM_ROLES: PlatformRole[] = ['super_admin', 'admin', 'operator', 'support', 'viewer', 'user'];
