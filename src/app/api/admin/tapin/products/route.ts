import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import {
  createTapinProduct,
  listTapinProductCategories,
  listTapinProducts,
} from '@/services/tapin/products';
import { tapinProductInputSchema } from '@/services/tapin/product-validation';
import { TapinError } from '@/services/tapin/client';
import { listTapinShops } from '@/services/tapin/orders';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';

function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json({ error: error.flatten() }, { status: 400 });
  if (error instanceof TapinError)
    return NextResponse.json(
      { error: error.message, details: error.data },
      { status: error.status },
    );
  return NextResponse.json({ error: 'عملیات محصولات تاپین ناموفق بود.' }, { status: 502 });
}

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const productId = Number(params.get('productId')) || undefined;
  const shopId = params.get('shopId')?.trim() || undefined;
  try {
    const [products, categories, shops] = await Promise.all([
      listTapinProducts(page, 20, {
        title: params.get('title')?.trim().slice(0, 100) || undefined,
        productId,
        categoryId: params.get('categoryId') || undefined,
        shopId,
      }),
      listTapinProductCategories(shopId),
      listTapinShops(),
    ]);
    return NextResponse.json({
      data: { products, categories: categories.list, shops: shops.list },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'orders:write');
  try {
    const input = tapinProductInputSchema.parse(await request.json());
    const shopId = new URL(request.url).searchParams.get('shopId')?.trim() || undefined;
    const data = await createTapinProduct(input, shopId);
    logAuditLater({
      action: 'create',
      entity: 'tapinProduct',
      entityId: String(data.product_id ?? ''),
      entityLabel: input.title,
      summary: 'ثبت محصول در تاپین',
      actor: actorFromUser(user),
      metadata: { shopId },
      ...requestContext(request),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
