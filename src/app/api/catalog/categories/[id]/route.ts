import { NextRequest, NextResponse } from 'next/server';

import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { deleteCategory, getWithBreadcrumb, updateCategory } from '@/catalog/services/categoryService';
import { requirePermission } from '@/lib/auth';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  await connectMongoose();
  const category = await getWithBreadcrumb(params.id);
  if (!category) {
    return jsonError(404, 'Category not found');
  }
  return NextResponse.json(category);
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  await connectMongoose();
  await requirePermission(req, 'catalog:publish');
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }
  try {
    const category = await updateCategory(params.id, payload);
    if (!category) {
      return jsonError(404, 'Category not found');
    }
    return NextResponse.json({ category });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update category';
    return jsonError(400, message);
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  await connectMongoose();
  await requirePermission(req, 'catalog:publish');
  const success = await deleteCategory(params.id);
  if (!success) {
    return jsonError(400, 'Unable to delete category with existing children');
  }
  return NextResponse.json({ ok: true });
}
