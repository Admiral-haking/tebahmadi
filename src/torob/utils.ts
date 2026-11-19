import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const TOROB_CLID_COOKIE = 'torob_clid';
const TOROB_CLID_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Extracts torob_clid from a request's query parameters and stores it in a cookie.
 * Call this in middleware or layout for incoming traffic.
 */
export function captureTorobClidFromUrl(req: NextRequest): string | null {
  const clid = req.nextUrl.searchParams.get('torob_clid');
  if (!clid || clid.trim().length === 0) return null;
  return clid.trim();
}

/**
 * Gets the torob_clid from a cookie (server-side).
 */
export async function getTorobClidFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const val = cookieStore.get(TOROB_CLID_COOKIE)?.value;
    return val || null;
  } catch {
    return null;
  }
}

/**
 * Returns the cookie name so it can be set client-side too.
 */
export function getTorobClidCookieName(): string {
  return TOROB_CLID_COOKIE;
}

/**
 * Returns expiry date for the torob_clid cookie.
 */
export function getTorobClidCookieExpiry(): Date {
  return new Date(Date.now() + TOROB_CLID_EXPIRY_MS);
}

/**
 * Validates a torob_clid format (UUID-like).
 */
export function isValidTorobClid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.trim());
}
