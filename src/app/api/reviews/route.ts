import { NextRequest, NextResponse } from 'next/server';
import { connectMongoose } from '@/lib/mongoose';
import { requirePermission } from '@/lib/auth';
import { ProductReviewModel } from '@/reviews/models/ProductReview';

const ALLOWED_STATUSES = new Set(['pending', 'published']);

function toIso(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function GET(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'orders:read');

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20));

  const query: Record<string, unknown> = {};
  if (status && ALLOWED_STATUSES.has(status)) {
    query.status = status;
  }

  const [items, total] = await Promise.all([
    ProductReviewModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ProductReviewModel.countDocuments(query),
  ]);

  const data = items.map((item) => ({
    id: item._id.toString(),
    productId: item.productId?.toString?.() ?? '',
    productSlug: item.productSlug,
    productTitle: item.productTitle,
    variantSummary: item.variantSummary ?? undefined,
    rating: item.rating,
    comment: item.comment ?? undefined,
    status: item.status,
    orderNumber: item.orderNumber ?? undefined,
    lineKey: item.lineKey,
    createdAt: toIso(item.createdAt),
    publishedAt: toIso(item.publishedAt),
    publishedBy: item.publishedBy ? item.publishedBy.toString() : undefined,
  }));

  return NextResponse.json({
    data: {
      items: data,
      total,
      page,
      pageSize,
    },
  });
}
