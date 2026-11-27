import type { AuthStatus } from '@/auth/types';

/** Cart mutations require an authenticated customer session. */
export function requiresCartLogin(status: AuthStatus, hasUser: boolean): boolean {
  return status !== 'authenticated' || !hasUser;
}
