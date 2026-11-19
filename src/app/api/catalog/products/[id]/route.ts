import { NextRequest, NextResponse } from 'next/server';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { getProduct, updateProduct, archiveProduct } from '@/catalog/services/productService';
import { requirePermission, HttpError } from '@/lib/auth';
import type { Permission } from '@/types';

/** Enforce a permission; translate an auth failure into a clean JSON error. */
async function ensurePermission(
  req: NextRequest,
  permission: Permission,
): Promise<NextResponse | null> {
  try {
    await requirePermission(req, permission);
    return null;
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonError(err.status, err.message);
    }
    throw err;
  }
}

function serializeProduct(product: unknown) {
  if (!product) {
    return null;
  }

  const jsonProduct = JSON.parse(JSON.stringify(product)) as Record<string, unknown>;
  if (typeof jsonProduct !== 'object' || jsonProduct === null) {
    return null;
  }

  const variants = Array.isArray(jsonProduct.variants) ? jsonProduct.variants : [];

  return {
    ...jsonProduct,
    id:
      typeof jsonProduct.id === 'string'
        ? jsonProduct.id
        : typeof jsonProduct._id === 'string'
          ? jsonProduct._id
          : undefined,
    productTypeId:
      typeof jsonProduct.productTypeId === 'string'
        ? jsonProduct.productTypeId
        : undefined,
    categories: Array.isArray(jsonProduct.categories)
      ? (jsonProduct.categories as unknown[]).map((value) => String(value))
      : [],
    variants: variants.map((variant) => {
      const jsonVariant = variant as Record<string, unknown>;
      return {
        ...jsonVariant,
        mediaIds: Array.isArray(jsonVariant.mediaIds)
          ? (jsonVariant.mediaIds as unknown[]).map((value) => String(value))
          : [],
      };
    }),
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
  const product = await getProduct(params.id);
  if (!product) {
    return jsonError(404, 'Product not found');
  }
  const serialized = serializeProduct(product);
  return NextResponse.json({ product: serialized });
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  const denied = await ensurePermission(req, 'products:write');
  if (denied) return denied;
  await connectMongoose();
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }
  try {
    const product = await updateProduct(params.id, payload);
    if (!product) {
      return jsonError(404, 'Product not found');
    }
    return NextResponse.json({ product });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update product';
    return jsonError(400, message);
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  const denied = await ensurePermission(req, 'products:write');
  if (denied) return denied;
  await connectMongoose();
  const product = await archiveProduct(params.id);
  if (!product) {
    return jsonError(404, 'Product not found');
  }
  return NextResponse.json({ product });
}
