import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
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

const updateUserSchema = z
  .object({
    phone: z.string().trim().min(1).optional(),
    fname: z.string().trim().max(100).optional(),
    lname: z.string().trim().max(100).optional(),
    age: z.coerce.number().int().min(0).max(120).optional(),
    state: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    address: z.string().trim().max(255).optional(),
    avatar: z.union([avatarSchema, z.null()]).optional(),
    roles: z.array(z.enum(ROLE_VALUES)).min(1).optional(),
    permissions: z.array(z.enum(PERMISSION_VALUES)).optional(),
  })
  .strict();

function sanitizeString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toAvatarDocument(avatar: AvatarVariantIds) {
  return {
    originalId: new Types.ObjectId(avatar.originalId),
    mobileId: new Types.ObjectId(avatar.mobileId),
    thumbId: new Types.ObjectId(avatar.thumbId),
    groupId: new Types.ObjectId(avatar.groupId),
  };
}

function buildUpdatePayload(parsed: z.infer<typeof updateUserSchema>) {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};

  if (parsed.phone !== undefined) {
    set.phone = parsed.phone.trim();
  }

  const fname = sanitizeString(parsed.fname);
  if (fname !== undefined) set.fname = fname;

  const lname = sanitizeString(parsed.lname);
  if (lname !== undefined) set.lname = lname;

  if (parsed.age !== undefined) set.age = parsed.age;

  const state = sanitizeString(parsed.state);
  if (state !== undefined) set.state = state;

  const city = sanitizeString(parsed.city);
  if (city !== undefined) set.city = city;

  const address = sanitizeString(parsed.address);
  if (address !== undefined) set.address = address;

  if (parsed.avatar !== undefined) {
    if (parsed.avatar === null) {
      unset.avatar = '';
    } else {
      set.avatar = toAvatarDocument(parsed.avatar);
    }
  }

  if (parsed.roles !== undefined) {
    set.roles = Array.from(new Set(parsed.roles));
  }

  if (parsed.permissions !== undefined) {
    set.permissions = Array.from(new Set(parsed.permissions));
  }

  return { set, unset };
}

function buildUpdateDocument(parsed: z.infer<typeof updateUserSchema>) {
  const { set, unset } = buildUpdatePayload(parsed);
  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) {
    update.$set = set;
  }
  if (Object.keys(unset).length > 0) {
    update.$unset = unset;
  }
  return update;
}

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  await requirePermission(request, 'users:read');

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const user = await UserModel.findById(new Types.ObjectId(id)).lean();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

export async function PATCH(request: NextRequest, context: Context) {
  await requirePermission(request, 'users:write');

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  let parsed: z.infer<typeof updateUserSchema>;
  try {
    const body = await request.json();
    parsed = updateUserSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const update = buildUpdateDocument(parsed);
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  try {
    const updated = await UserModel.findByIdAndUpdate(new Types.ObjectId(id), update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'Phone number already exists' }, { status: 409 });
    }
    console.error('Failed to update user', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  await requirePermission(request, 'users:write');

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const deleted = await UserModel.findByIdAndDelete(new Types.ObjectId(id)).lean();
  if (!deleted) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ data: { deleted: true } });
}
