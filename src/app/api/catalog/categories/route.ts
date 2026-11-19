import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import CategoryModel from '@/catalog/models/Category';
import { createCategory } from '@/catalog/services/categoryService';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { requirePermission } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();
  const params = req.nextUrl.searchParams;
  const q = params.get('q') ?? undefined;
  const parentId = params.get('parentId') ?? undefined;

  const query: Record<string, unknown> = {};
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [{ name: regex }, { path: regex }];
  }
  if (parentId) {
    if (parentId === 'root') {
      query.parentId = null;
    } else if (Types.ObjectId.isValid(parentId)) {
      query.parentId = new Types.ObjectId(parentId);
    }
  }

  const categories = await CategoryModel.find(query)
    .sort({ depth: 1, position: 1, name: 1 })
    .lean({ virtuals: false, getters: false });

  const serialized = categories.map((category) => ({
    id: category._id?.toString() ?? '',
    name: category.name ?? '',
    path: category.path ?? '',
    parentId: category.parentId ? String(category.parentId) : undefined,
    depth: category.depth,
  }));

  return NextResponse.json({ categories: serialized });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();
  await requirePermission(req, 'catalog:publish');
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  try {
    const category = await createCategory(payload);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create category';
    return jsonError(400, message);
  }
}
