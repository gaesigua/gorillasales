// Client-safe role helpers shared by UI and server code.

export type Role = 'ADMIN' | 'MANAGER' | 'SALES_OFFICER' | 'DELIVERY_SUPPORT' | 'DRIVER';

export const ROLES: Role[] = ['ADMIN', 'MANAGER', 'SALES_OFFICER', 'DELIVERY_SUPPORT', 'DRIVER'];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES_OFFICER: 'Sales Officer',
  DELIVERY_SUPPORT: 'Delivery Support',
  DRIVER: 'Driver',
};

export const MANAGER_ROLES: Role[] = ['ADMIN', 'MANAGER'];

export function isManagerRole(role: Role): boolean {
  return MANAGER_ROLES.includes(role);
}
