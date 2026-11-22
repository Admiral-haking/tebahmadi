import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import ProductModel from '@/catalog/models/Product';
import { requirePermission } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';
import { TapinError } from '@/services/tapin/client';
import { ensureTapinIndexes } from '@/services/tapin/indexes';
import { syncCatalogVariantToTapin } from '@/services/tapin/catalog-sync';

const schema = z.object({
  variantIds: z.array(z.string().trim().min(1)).min(1).max(50),
  categoryId: z.string().trim().min(1).max(120),
  shopId: z.string().uuid().optional(),
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  await connectMongoose();
  const q = request.nextUrl.searchParams.get('q')?.trim().slice(0, 100) || '';
  const safeQuery = q ? escapeRegex(q) : '';
  const match = safeQuery
    ? {
        $or: [
          { title: { $regex: safeQuery, $options: 'i' } },
          { 'variants.sku': { $regex: safeQuery, $options: 'i' } },
        ],
      }
    : {};
  const rows = await ProductModel.aggregate([
    { $match: match },
    { $unwind: '$variants' },
    { $match: { 'variants.active': true } },
    { $sort: { 'variants.updatedAt': -1 } },
    { $limit: 100 },
    {
      $project: {
        _id: 0,
        variantId: { $toString: '$variants._id' },
        title: 1,
        sku: '$variants.sku',
        price: '$variants.price.amount',
        tapinProductId: '$variants.tapinProductId',
        tapinCategoryId: '$variants.tapinCategoryId',
        tapinMappings: '$variants.tapinMappings',
        weight: {
          $let: {
            vars: {
              item: {
                $first: {
                  $filter: {
                    input: '$variants.attributeValues',
                    cond: { $eq: ['$$this.key', 'weightGrams'] },
                  },
                },
              },
            },
            in: '$$item.value',
          },
        },
      },
    },
  ]);
  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'orders:write');
  try {
    const input = schema.parse(await request.json());
    await connectMongoose();
    await ensureTapinIndexes();
    const results = [] as Array<Record<string, unknown>>;
    for (const variantId of input.variantIds) {
      try {
        results.push({ ok: true, ...(await syncCatalogVariantToTapin(variantId, input.categoryId, input.shopId)) });
      } catch (error) {
        results.push({
          ok: false,
          variantId,
          error: error instanceof Error ? error.message : 'خطای نامشخص',
        });
      }
    }
    const succeeded = results.filter((item) => item.ok === true).length;
    logAuditLater({
      action: 'update',
      entity: 'tapinCatalog',
      summary: 'همگام‌سازی کاتالوگ با تاپین',
      actor: actorFromUser(user),
      metadata: {
        variantIds: input.variantIds,
        categoryId: input.categoryId,
        shopId: input.shopId,
        succeeded,
        failed: results.length - succeeded,
      },
      ...requestContext(request),
    });
    return NextResponse.json({ data: { results, succeeded } });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'همگام‌سازی کاتالوگ با تاپین ناموفق بود.' }, { status: 502 });
  }
}
