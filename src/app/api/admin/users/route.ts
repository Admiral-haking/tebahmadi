import { NextRequest, NextResponse } from 'next/server';

import { connectMongoose } from '@/lib/mongoose';
import { requirePermission } from '@/lib/auth';
import UserModel from '@/models/User';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function buildFilter(query: string | null): Record<string, unknown> {
  const trimmed = query?.trim();
  if (!trimmed) {
    return {};
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  return { $or: [{ fname: regex }, { lname: regex }, { phone: regex }] };
}

function serializeUser(user: any) {
  return {
    ...user,
    _id: user._id?.toString?.() ?? user._id,
    id: user._id?.toString?.() ?? user.id,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
    updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : undefined,
  };
}

export async function GET(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'users:read');

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get('page'));
  const limit = parseLimit(url.searchParams.get('limit'));
  const filter = buildFilter(url.searchParams.get('q'));

  const skip = (page - 1) * limit;

  const [usersRaw, total] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(true),
    UserModel.countDocuments(filter),
  ]);

  const users = usersRaw.map((user) => serializeUser(user));
  const pages = total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

  return NextResponse.json({
    users,
    total,
    page,
    pages,
    limit,
  });
}
