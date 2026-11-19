import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import UserModel from '@/models/User';
import type { AvatarVariantIds } from '@/types';
import { requirePermission } from '@/lib/auth';

const ROLE_VALUES = ['admin', 'manager', 'staff', 'customer'] as const;
const PERMISSION_VALUES = [
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
] as const;

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

const avatarSchema = z.object({
  originalId: objectIdSchema,
  mobileId: objectIdSchema,
  thumbId: objectIdSchema,
  groupId: objectIdSchema,
});

const baseUserSchema = {
  phone: z.string().trim().min(1),
  fname: z.string().trim().max(100).optional(),
  lname: z.string().trim().max(100).optional(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(255).optional(),
  avatar: avatarSchema.optional(),
  roles: z.array(z.enum(ROLE_VALUES)).min(1).default(['customer']),
  permissions: z.array(z.enum(PERMISSION_VALUES)).optional(),
};

const createUserSchema = z.object(baseUserSchema);

const queryParamsSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().min(1).optional(),
});

function sanitizeString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toAvatarDocument(avatar: AvatarVariantIds | undefined) {
  if (!avatar) {
    return undefined;
  }
  return {
    originalId: new Types.ObjectId(avatar.originalId),
    mobileId: new Types.ObjectId(avatar.mobileId),
    thumbId: new Types.ObjectId(avatar.thumbId),
    groupId: new Types.ObjectId(avatar.groupId),
  };
}

function buildUserPayload(parsed: z.infer<typeof createUserSchema>) {
  const payload: Record<string, unknown> = {
    phone: parsed.phone.trim(),
    roles: Array.from(new Set(parsed.roles ?? ['customer'])),
  };

  const fname = sanitizeString(parsed.fname);
  if (fname !== undefined) payload.fname = fname;

  const lname = sanitizeString(parsed.lname);
  if (lname !== undefined) payload.lname = lname;

  if (parsed.age !== undefined) payload.age = parsed.age;

  const state = sanitizeString(parsed.state);
  if (state !== undefined) payload.state = state;

  const city = sanitizeString(parsed.city);
  if (city !== undefined) payload.city = city;

  const address = sanitizeString(parsed.address);
  if (address !== undefined) payload.address = address;

  const avatarDoc = toAvatarDocument(parsed.avatar);
  if (avatarDoc) payload.avatar = avatarDoc;

  if (parsed.permissions) {
    payload.permissions = Array.from(new Set(parsed.permissions));
  }

  return payload;
}

export async function GET(request: NextRequest) {
  await requirePermission(request, 'users:read');

  const url = new URL(request.url);
  const queryParse = queryParamsSchema.safeParse({
    limit: url.searchParams.get('limit'),
    search: url.searchParams.get('search'),
  });

  if (!queryParse.success) {
    return NextResponse.json({ error: queryParse.error.flatten() }, { status: 400 });
  }

  const { limit = 50, search } = queryParse.data;
  const mongoQuery: Record<string, unknown> = {};

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    mongoQuery.$or = [
      { phone: regex },
      { fname: regex },
      { lname: regex },
    ];
  }

  const users = await UserModel.find(mongoQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  await requirePermission(request, 'users:write');

  try {
    const body = await request.json();
    const parsed = createUserSchema.parse(body);

    const payload = buildUserPayload(parsed);

    const created = await UserModel.create(payload);
    return NextResponse.json({ data: created.toJSON() }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'Phone number already exists' }, { status: 409 });
    }
    console.error('Failed to create user', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
