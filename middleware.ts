import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';
import type { Permission } from './src/types';
import { requiredSnappPermission } from './src/auth/snapp-permissions';
import {
  disabledPaymentGatewayForApiPath,
  disabledAdminFeatureForApiPath,
  isDisabledMarketplaceIntegrationApiPath,
  MARKETPLACE_INTEGRATIONS_ENABLED,
} from './src/config/admin-features';

type Role = 'admin' | 'manager' | 'staff' | 'customer';
type Perm = Permission;

const rolePerms: Record<Role, Perm[]> = {
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
    'accounting:read',
    'accounting:write',
    'accounting:admin',
    'holoo:read',
    'holoo:write',
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
    'accounting:read',
    'accounting:write',
    'accounting:admin',
    'holoo:read',
    'holoo:write',
    'promotions:write',
    'catalog:publish',
  ],
  staff: ['media:read', 'media:write', 'products:read', 'orders:read'],
  customer: ['media:read', 'orders:read', 'orders:write'],
};

function getSecretKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }
  return new TextEncoder().encode(secret);
}

interface AuthPayload extends JWTPayload {
  sub?: string;
  phone?: string;
  roles?: Role[];
  permissions?: Perm[];
}

const PUBLIC_WRITE_PATHS = new Set(['/api/offers/apply', '/api/transport/quote']);

function hasPerm(roles: Role[], needed: Perm, tokenPerms: Perm[]): boolean {
  return roles.some((role) => rolePerms[role]?.includes(needed)) || tokenPerms.includes(needed);
}

function requiredPermFor(pathname: string, method: string): Perm | null {
  const upper = method.toUpperCase();

  if (pathname.startsWith('/api/reviews') && upper === 'GET') {
    return 'orders:read';
  }

  if (pathname.startsWith('/api/holoo')) {
    if (upper === 'GET') return 'holoo:read';
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(upper)) return 'holoo:write';
    return null;
  }

  if (!['POST', 'PATCH', 'DELETE', 'PUT'].includes(upper)) {
    return null;
  }

  if (PUBLIC_WRITE_PATHS.has(pathname)) {
    return null;
  }

  if (pathname.startsWith('/api/catalog/product-types')) return 'catalog:publish';
  if (pathname.startsWith('/api/catalog/products')) return 'products:write';
  if (pathname.startsWith('/api/catalog/categories')) return 'catalog:publish';

  if (pathname.startsWith('/api/blog/categories')) return 'catalog:publish';
  if (pathname.startsWith('/api/blog/posts')) return 'catalog:publish';
  if (pathname.startsWith('/api/pages')) return 'catalog:publish';

  if (pathname.startsWith('/api/seo/meta-overrides')) return 'catalog:publish';
  if (pathname.startsWith('/api/settings/site-info')) return 'users:write';
  if (pathname.startsWith('/api/settings/site-config')) return 'users:write';

  if (pathname.startsWith('/api/media/upload')) return 'media:write';

  if (pathname.startsWith('/api/offers') && !pathname.startsWith('/api/offers/apply')) {
    return 'promotions:write';
  }
  if (pathname.startsWith('/api/transport') && !pathname.startsWith('/api/transport/quote')) {
    return 'orders:write';
  }

  if (pathname.startsWith('/api/invoices')) return 'orders:write';
  if (pathname.startsWith('/api/reviews')) return 'orders:write';
  if (pathname.startsWith('/api/digikala')) return 'orders:write';
  if (pathname.startsWith('/api/sync')) return 'orders:write';
  if (pathname.startsWith('/api/basalaam')) return 'orders:write';
  if (pathname.startsWith('/api/snapp')) return requiredSnappPermission(pathname, upper);
  return null;
}

function isPublic(pathname: string, method: string): boolean {
  const upper = method.toUpperCase();

  if (pathname.startsWith('/api/auth/')) {
    return true;
  }

  if (pathname.startsWith('/api/reviews/verify') || pathname.startsWith('/api/reviews/submit')) {
    return true;
  }

  if (pathname.startsWith('/api/media/') && (upper === 'GET' || upper === 'HEAD')) {
    return true;
  }
  if (pathname.startsWith('/api/slides') && (upper === 'GET' || upper === 'HEAD')) {
    return true;
  }

  if (pathname.startsWith('/api/offers/apply') && (upper === 'GET' || upper === 'POST')) {
    return true;
  }

  if (pathname.startsWith('/api/transport/quote') && (upper === 'GET' || upper === 'POST')) {
    return true;
  }

  if (pathname === '/api/transport' && upper === 'GET') {
    return true;
  }

  if (pathname.startsWith('/api/cart/suggestions') && (upper === 'GET' || upper === 'POST')) {
    return true;
  }

  if (pathname === '/api/store/buy-link' && upper === 'GET') {
    return true;
  }

  if (upper === 'GET') {
    if (pathname.startsWith('/api/blog/')) return true;
    if (pathname.startsWith('/api/pages')) return true;
    if (pathname.startsWith('/api/catalog/products')) return true;
    if (pathname.startsWith('/api/marketplace/products')) return true;
    if (pathname.startsWith('/api/catalog/categories')) return true;
    if (pathname.startsWith('/api/seo/meta-overrides')) return true;
  }

  if (pathname === '/api/me') {
    return false;
  }

  return false;
}

async function verifyToken(token: string): Promise<AuthPayload | null> {
  const secretKey = getSecretKey();
  if (!secretKey) {
    console.warn('JWT_SECRET is not set; rejecting authenticated request');
    return null;
  }
  try {
    const { payload } = await jwtVerify<AuthPayload>(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.warn('JWT verification failed in middleware', error);
    return null;
  }
}

const TOROB_CLID_COOKIE = 'torob_clid';
const TOROB_CLID_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function captureTorobClidFromUrl(req: NextRequest): string | null {
  const clid = req.nextUrl.searchParams.get('torob_clid');
  if (!clid || clid.trim().length === 0) return null;
  return clid.trim();
}

function isValidTorobClid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.trim());
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const method = req.method;

  if (pathname.startsWith('/api')) {
    const disabledFeature = disabledAdminFeatureForApiPath(pathname);
    if (disabledFeature) {
      return NextResponse.json(
        { error: 'feature_disabled', feature: disabledFeature },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!MARKETPLACE_INTEGRATIONS_ENABLED && isDisabledMarketplaceIntegrationApiPath(pathname)) {
      return NextResponse.json(
        { error: 'feature_disabled', feature: 'marketplaceIntegrations' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const disabledPaymentGateway = disabledPaymentGatewayForApiPath(pathname);
    if (disabledPaymentGateway) {
      return NextResponse.json(
        { error: 'feature_disabled', feature: 'paymentGateway', gateway: disabledPaymentGateway },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  // Capture torob_clid from URL query parameter and set as cookie
  const torobClid = captureTorobClidFromUrl(req);
  if (torobClid && isValidTorobClid(torobClid)) {
    const existingCookie = req.cookies.get(TOROB_CLID_COOKIE)?.value;
    if (existingCookie !== torobClid) {
      const response = NextResponse.next();
      response.cookies.set(TOROB_CLID_COOKIE, torobClid, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor(TOROB_CLID_EXPIRY_MS / 1000),
      });
      return response;
    }
  }

  // DGK webhook — external POST from Digikala servers (no auth token available)
  if (pathname === "/api/digikala/webhook" && (method === "POST" || method === "GET")) {
    return NextResponse.next();
  }

  // Prometheus metrics — scraper-reachable; the route enforces METRICS_TOKEN.
  if (pathname.startsWith("/api/sync/metrics") && method === "GET") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/sync")) {
    const syncApiKey = process.env.SYNC_API_KEY;
    if (syncApiKey && (req.headers.get("apiKey") ?? req.headers.get("x-api-key")) === syncApiKey) {
      return NextResponse.next();
    }
    // No matching API key — fall through to the normal cookie/role auth below so
    // a signed-in operator (orders:write) can trigger a sync from the panel.
    // (requiredPermFor maps /api/sync → orders:write.)
  }

  if (
    (pathname.startsWith('/api/marketplace/orders') || pathname.startsWith('/api/marketplace/tracking')) &&
    method === 'POST'
  ) {
    const shopinoApiKey = process.env.SHOPINO_API_KEY;
    if (shopinoApiKey && (req.headers.get("x-api-key") ?? req.headers.get("apiKey")) === shopinoApiKey) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Monitoring endpoints are intentionally public and return no customer data.
  if (pathname === '/api/health' || pathname === '/api/readiness') {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/torob')) {
    return NextResponse.next();
  }
  // Public product feed crawled by the Azkivam bot (read-only catalog, no admin
  // session). Same treatment as the Torob/store feeds.
  if (pathname.startsWith('/api/azkivam/products') && method === 'GET') {
    return NextResponse.next();
  }
  // Basalam webhook receiver — called by Basalam (no admin session).
  if (pathname.startsWith('/api/basalaam/webhook') && method === 'POST') {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/payments')) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/store/products') && req.method.toLowerCase() === 'get') {
    return NextResponse.next();
  }

  if (isPublic(pathname, method)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawRoles = payload.roles as unknown;
  const roles: Role[] = Array.isArray(rawRoles) && (rawRoles as Role[]).length > 0
    ? (rawRoles as Role[])
    : typeof rawRoles === 'string' && rawRoles.length > 0
      ? (rawRoles.split(',') as Role[])
      : ['customer'];

  const rawPerms = payload.permissions as unknown;
  const tokenPerms: Perm[] = Array.isArray(rawPerms)
    ? (rawPerms as Perm[])
    : typeof rawPerms === 'string' && rawPerms.length > 0
      ? (rawPerms.split(',') as Perm[])
      : [];

  const needed = requiredPermFor(pathname, method);
  if (
    needed
    &&
    !hasPerm(roles, needed, tokenPerms)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const headers = new Headers(req.headers);
  headers.set('x-user-id', payload.sub);
  if (payload.phone) {
    headers.set('x-user-phone', String(payload.phone));
  }
  headers.set('x-user-roles', roles.join(','));

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: ['/api/:path*'],
};
