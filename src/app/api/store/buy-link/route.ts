import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import ProductModel from '@/catalog/models/Product';
import { effectiveUnitPrice } from '@/catalog/services/productService';
import { connectMongoose } from '@/lib/mongoose';
import { isMongoConfigured, PREVIEW_PRODUCTS } from '@/lib/preview-fallback';

export const runtime = 'nodejs';

function attributeSummary(values: unknown): string | undefined {
  if (!Array.isArray(values)) return undefined;
  const parts = values.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const value = (entry as { value?: unknown }).value;
    if (value === undefined || value === null) return [];
    if (typeof value === 'string' || typeof value === 'number') return [String(value)];
    if (typeof value === 'object') {
      const record = value as { name?: unknown; label?: unknown; key?: unknown };
      const text = record.name ?? record.label ?? record.key;
      return text === undefined ? [] : [String(text)];
    }
    return [];
  });
  return parts.length ? parts.join(' / ') : undefined;
}

function isActiveOffer(offer: { amount?: number; startsAt?: Date; endsAt?: Date } | undefined, now: Date) {
  if (!offer || !Number.isFinite(Number(offer.amount)) || Number(offer.amount) <= 0) return false;
  if (offer.startsAt && now < new Date(offer.startsAt)) return false;
  if (offer.endsAt && now > new Date(offer.endsAt)) return false;
  return true;
}

function previewLine(variantKey: string) {
  const item = PREVIEW_PRODUCTS.find((candidate) => {
    const variant = candidate.detail.variants[0];
    return variant.id === variantKey || variant.sku === variantKey;
  });
  if (!item) return null;
  const variant = item.detail.variants[0];
  return {
    productId: item.detail.id,
    productSlug: item.detail.slug,
    title: item.detail.title,
    variantId: variant.id,
    sku: variant.sku,
    priceModel: variant.priceModel,
    unitOfMeasure: variant.unitOfMeasure,
    requestedUnit: variant.unitOfMeasure,
    unitPriceBase: variant.unitPrice,
    variantOfferAmount: variant.offerAmount ?? 0,
    mediaThumbId: variant.mediaThumbId,
    attributesSummary: variant.attributesSummary,
  };
}

export async function GET(request: NextRequest) {
  const variantKey = request.nextUrl.searchParams.get('variant')?.trim() ?? '';
  if (!variantKey) {
    return NextResponse.json({ error: 'شناسه واریانت الزامی است.' }, { status: 400 });
  }

  if (!isMongoConfigured()) {
    const line = previewLine(variantKey);
    return line
      ? NextResponse.json({ line })
      : NextResponse.json({ error: 'محصول انتخاب‌شده یافت نشد.' }, { status: 404 });
  }

  await connectMongoose();
  const lookup = Types.ObjectId.isValid(variantKey)
    ? [{ 'variants._id': new Types.ObjectId(variantKey) }, { 'variants.sku': variantKey }]
    : [{ 'variants.sku': variantKey }];
  const product = await ProductModel.findOne(
    { status: 'active', showInCart: { $ne: false }, $or: lookup },
    { title: 1, slug: 1, variants: 1 },
  ).lean();

  const variant = product?.variants?.find((candidate) => {
    const id = candidate?._id?.toString();
    return id === variantKey || candidate?.sku === variantKey;
  });

  if (!product || !variant || variant.active === false) {
    return NextResponse.json({ error: 'محصول انتخاب‌شده یافت نشد.' }, { status: 404 });
  }
  if (!variant._id) {
    return NextResponse.json(
      { error: 'این کالا هنوز شناسهٔ پایدار ندارد و باید یک‌بار همگام‌سازی شود.' },
      { status: 409 },
    );
  }

  const now = new Date();
  const basePrice = Number(variant.price?.amount ?? 0);
  const offerActive = isActiveOffer(variant.offer, now);
  const finalPrice = effectiveUnitPrice(variant, now);
  const mediaThumbId = Array.isArray(variant.mediaIds) && variant.mediaIds[0]
    ? variant.mediaIds[0].toString()
    : undefined;

  return NextResponse.json({
    line: {
      productId: product._id.toString(),
      productSlug: product.slug,
      title: product.title,
      variantId: variant._id.toString(),
      sku: variant.sku,
      priceModel: variant.price.model,
      unitOfMeasure: variant.price.unitOfMeasure,
      requestedUnit: variant.price.unitOfMeasure,
      unitPriceBase: basePrice,
      variantOfferAmount: offerActive ? Math.max(0, basePrice - finalPrice) : 0,
      mediaThumbId,
      attributesSummary: attributeSummary(variant.attributeValues),
      minimumOrderQuantity: variant.minimumOrderQuantity,
      maximumOrderQuantity: variant.maximumOrderQuantity,
    },
  });
}
