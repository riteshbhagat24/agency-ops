import type { UserRole } from '@/types/database.types';

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  management: 'Management',
  accounts: 'Accounts',
  client_servicing: 'Client Servicing',
  operations: 'Operations',
  video_team: 'Video Team',
  design_team: 'Design Team',
};

const STAFF_ROLES: UserRole[] = ['super_admin', 'management', 'accounts'];
const APPROVER_ROLES: UserRole[] = ['super_admin', 'management'];
const CS_ROLES: UserRole[] = ['super_admin', 'management', 'client_servicing'];
const FINANCE_ROLES: UserRole[] = ['super_admin', 'management', 'accounts'];

export function isStaff(role: UserRole | null | undefined) {
  return !!role && STAFF_ROLES.includes(role);
}

export function canApprove(role: UserRole | null | undefined) {
  return !!role && APPROVER_ROLES.includes(role);
}

export function canClassify(role: UserRole | null | undefined) {
  return !!role && CS_ROLES.includes(role);
}

export function canSeeFinance(role: UserRole | null | undefined) {
  return !!role && FINANCE_ROLES.includes(role);
}

export function canManageClients(role: UserRole | null | undefined) {
  return role === 'super_admin' || role === 'management';
}

export function canManageUsers(role: UserRole | null | undefined) {
  return role === 'super_admin';
}

// Route → required role(s)
const ROUTE_GUARDS: Array<{ pattern: RegExp; roles: UserRole[] }> = [
  { pattern: /^\/settings\/users/, roles: ['super_admin'] },
  { pattern: /^\/analytics/, roles: ['super_admin', 'management', 'accounts'] },
  { pattern: /^\/billing/, roles: ['super_admin', 'management', 'accounts', 'client_servicing'] },
  { pattern: /^\/approvals/, roles: ['super_admin', 'management', 'client_servicing'] },
  { pattern: /^\/clients/, roles: [
      'super_admin', 'management', 'accounts', 'client_servicing',
      'operations', 'video_team', 'design_team',
    ] },
];

export function routeAllowedForRole(path: string, role: UserRole | null | undefined): boolean {
  if (!role) return false;
  const guard = ROUTE_GUARDS.find((g) => g.pattern.test(path));
  if (!guard) return true; // public-to-authed routes
  return guard.roles.includes(role);
}
