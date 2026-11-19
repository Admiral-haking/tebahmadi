import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { requirePermission } from '@/lib/auth';
import { ProductReviewModel } from '@/reviews/models/ProductReview';
import { revalidatePath, revalidateTag, TAGS } from '@/lib/cache';

const schema = z.object({
  status: z.enum(['pending', 'published']),
});

function toIso(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function revalidateProduct(slug?: string | null) {
  if (!slug) {
    return;
  }
  await Promise.allSettled([
    revalidateTag(TAGS.PRODUCT(slug)),
    revalidatePath(`/product/${slug}`),
  ]);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  await connectMongoose();
  const user = await requirePermission(request, 'orders:write');

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const nextStatus = parsed.data.status;
  const update: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'published') {
    update.publishedAt = new Date();
    update.publishedBy = user._id;
  } else {
    update.publishedAt = null;
    update.publishedBy = undefined;
  }

  const review = await ProductReviewModel.findByIdAndUpdate(
    id,
    {
      $set: update,
      ...(nextStatus === 'pending' ? { $unset: { publishedAt: 1, publishedBy: 1 } } : {}),
    },
    { new: true },
  ).lean();

  if (!review) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  void revalidateProduct(review.productSlug);

  return NextResponse.json({
    data: {
      id: review._id.toString(),
      status: review.status,
      rating: review.rating,
      productSlug: review.productSlug,
      publishedAt: toIso(review.publishedAt),
      publishedBy: review.publishedBy ? review.publishedBy.toString() : undefined,
    },
  });
}
