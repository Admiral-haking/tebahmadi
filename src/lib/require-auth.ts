import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AUTH_COOKIE_NAME, type AuthTokenPayload, verifyJwt } from '@/lib/auth';

function normalizeReturnPath(path: string | null | undefined): string {
  if (!path) {
    return '/';
  }
  const trimmed = path.trim();
  if (!trimmed) {
    return '/';
  }
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/';
  }
  return trimmed;
}

function redirectToAuth(returnPath: string) {
  const safePath = normalizeReturnPath(returnPath);
  const search = safePath === '/' ? '' : `?redirect=${encodeURIComponent(safePath)}`;
  redirect(`/auth${search}`);
}

export async function requireAuthenticatedUser(returnPath: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return redirectToAuth(returnPath);
  }
  try {
    return verifyJwt(token);
  } catch {
    redirectToAuth(returnPath);
  }
}
