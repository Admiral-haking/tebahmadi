import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { connectMongoose } from './mongoose';
import UserModel, { UserDocument } from '@/models/User';
import type { Permission, UserRole } from '@/types';

export const AUTH_COOKIE_NAME = 'auth_token';
const DEFAULT_JWT_TTL_SECONDS = 3600;

export interface AuthTokenPayload {
  sub: string;
  phone: string;
  roles: UserRole[];
  iat?: number;
  exp?: number;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

const ALL_PERMISSIONS: Permission[] = [
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
];

const ROLE_PERMISSION_MAP: Record<UserRole, Permission[]> = {
  admin: ALL_PERMISSIONS,
  manager: ALL_PERMISSIONS.filter((perm) => perm !== 'users:write'),
  staff: ['products:read', 'orders:read', 'media:read', 'media:write'],
  customer: ['media:read', 'orders:read', 'orders:write'],
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

function getJwtTtlSeconds(override?: number): number {
  if (override && override > 0) {
    return override;
  }
  const configured = Number(process.env.JWT_TTL_SECONDS ?? DEFAULT_JWT_TTL_SECONDS);
  if (Number.isNaN(configured) || configured <= 0) {
    return DEFAULT_JWT_TTL_SECONDS;
  }
  return configured;
}

export function signJwt(payload: AuthTokenPayload, ttlSeconds?: number): string {
  const secret = getJwtSecret();
  const expiresIn = getJwtTtlSeconds(ttlSeconds);
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyJwt(token: string): AuthTokenPayload {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as AuthTokenPayload;
}

export function setAuthCookie(response: NextResponse, token: string, ttlSeconds?: number): void {
  const maxAge = getJwtTtlSeconds(ttlSeconds);
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function getAuth(req: NextRequest): AuthTokenPayload | null {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    return verifyJwt(token);
  } catch {
    return null;
  }
}

export function requireAuth(req: NextRequest): AuthTokenPayload {
  const auth = getAuth(req);
  if (!auth) {
    throw new HttpError(401, 'Unauthorized');
  }
  return auth;
}

export function permissionsForRoles(roles: UserRole[]): Set<Permission> {
  const perms = new Set<Permission>();
  roles.forEach((role) => {
    const rolePerms = ROLE_PERMISSION_MAP[role] ?? [];
    rolePerms.forEach((perm) => perms.add(perm));
  });
  return perms;
}

export function hasPermission(
  user: Pick<UserDocument, 'roles' | 'permissions'>,
  perm: Permission,
): boolean {
  const rolePerms = permissionsForRoles(user.roles ?? ['customer']);
  if (rolePerms.has(perm)) {
    return true;
  }

  const explicitPerms = user.permissions ?? [];
  return explicitPerms.includes(perm);
}

export async function requirePermission(
  req: NextRequest,
  perm: Permission,
): Promise<UserDocument> {
  const auth = requireAuth(req);
  if (!Types.ObjectId.isValid(auth.sub)) {
    throw new HttpError(401, 'Unauthorized');
  }
  await connectMongoose();

  const user = await UserModel.findById(new Types.ObjectId(auth.sub)).exec();
  if (!user) {
    throw new HttpError(401, 'Unauthorized');
  }

  if (!hasPermission(user, perm)) {
    throw new HttpError(403, 'Forbidden');
  }

  return user;
}

export async function getAuthCookieValue(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}
