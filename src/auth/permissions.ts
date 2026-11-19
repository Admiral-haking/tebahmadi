import type { AuthUser } from '@/auth/types';
import type { Permission, UserRole } from '@/types';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'users:read',
    'users:write',
    'media:read',
    'media:write',
    'media:read:all',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'promotions:write',
    'catalog:publish',
  ],
  manager: [
    'users:read',
    'media:read',
    'media:write',
    'media:read:all',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'promotions:write',
    'catalog:publish',
  ],
  staff: ['products:read', 'orders:read', 'media:read', 'media:write'],
  customer: ['media:read', 'orders:read', 'orders:write'],
};

export function permissionsForRoles(roles: UserRole[] = []): Set<Permission> {
  const perms = new Set<Permission>();
  roles.forEach((role) => {
    const mapped = ROLE_PERMISSIONS[role] ?? [];
    mapped.forEach((perm) => perms.add(perm));
  });
  return perms;
}

export function userHasPermission(user: AuthUser | null | undefined, permission: Permission): boolean {
  if (!user) {
    return false;
  }
  const rolePerms = permissionsForRoles(user.roles ?? []);
  if (rolePerms.has(permission)) {
    return true;
  }
  const explicit = user.permissions ?? [];
  return explicit.includes(permission);
}

export function userHasAdminAccess(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  const roles = user.roles ?? [];
  if (roles.some((role) => role !== 'customer')) {
    return true;
  }
  return userHasPermission(user, 'users:read') || userHasPermission(user, 'users:write');
}
