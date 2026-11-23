import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from './client-ip';

type Bucket = { count: number; resetAt: number };
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 2_000;
const buckets = new Map<string, Bucket>();

function noStoreHeaders() {
  return { 'Cache-Control': 'no-store, max-age=0' };
}

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function expectedOrigin(request: NextRequest): string {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  return new URL(configured).origin;
}

function isRateLimited(request: NextRequest, source: string, maxEvents: number): boolean {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }
  const key = `${source}:${getClientIp(request)}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > maxEvents;
}

export function noStoreJson(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { ...noStoreHeaders(), ...(init?.headers ?? {}) },
  });
}

export function guardPublicWrite(request: NextRequest, source: string, maxEvents = 60): NextResponse | null {
  const rawOrigin = request.headers.get('origin');
  const origin = normalizeOrigin(rawOrigin);
  if ((rawOrigin && !origin) || (origin && origin !== expectedOrigin(request))) {
    return noStoreJson({ error: 'Forbidden origin' }, { status: 403 });
  }
  if (isRateLimited(request, source, maxEvents)) {
    return noStoreJson({ error: 'Too many requests' }, { status: 429 });
  }
  return null;
}
