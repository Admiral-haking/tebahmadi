import { NextRequest, NextResponse } from 'next/server';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { getProductType, updateProductType, deleteProductType } from '@/catalog/services/productTypeService';

function serializeProductType(productType: unknown) {
  if (!productType) {
    return null;
  }

  const jsonProductType = JSON.parse(JSON.stringify(productType)) as Record<string, unknown>;
  if (typeof jsonProductType !== 'object' || jsonProductType === null) {
    return null;
  }

  return {
    ...jsonProductType,
    id:
      typeof jsonProductType.id === 'string'
        ? jsonProductType.id
        : typeof jsonProductType._id === 'string'
          ? jsonProductType._id
          : undefined,
  };
}

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  await connectMongoose();
  const productType = await getProductType(params.id);
  if (!productType) {
    return jsonError(404, 'Product type not found');
  }
  const serialized = serializeProductType(productType);
  return NextResponse.json({ productType: serialized });
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  await connectMongoose();
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }
  try {
    const productType = await updateProductType(params.id, payload);
    if (!productType) {
      return jsonError(404, 'Product type not found');
    }
    return NextResponse.json({ productType: serializeProductType(productType) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update product type';
    return jsonError(400, message);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  await connectMongoose();
  const success = await deleteProductType(params.id);
  if (!success) {
    return jsonError(400, 'Cannot delete product type with existing products');
  }
  return NextResponse.json({ ok: true });
}
