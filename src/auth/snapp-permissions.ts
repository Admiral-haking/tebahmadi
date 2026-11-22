import type { Permission } from '@/types';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Keep the edge permission gate aligned with the operation performed by each
 * SnappShop endpoint. Credential registration and catalog reconciliation are
 * product operations; order mutations remain order operations.
 */
export function requiredSnappPermission(pathname: string, method: string): Permission | null {
  const upper = method.toUpperCase();
  if (!WRITE_METHODS.has(upper)) return null;

  if (pathname === '/api/snapp/auth' || pathname.endsWith('/reconcile')) {
    return 'products:write';
  }

  if (pathname.includes('/orders/')) return 'orders:write';

  // Fail closed for future SnappShop mutations until their route has a more
  // specific permission requirement.
  return 'products:write';
}
