import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { connectMongoose } from '@/lib/mongoose';
import ProductModel from '@/catalog/models/Product';
import { isMongoConfigured, PREVIEW_PRODUCTS } from '@/lib/preview-fallback';

export const runtime = 'nodejs';

const MAX_LIMIT = 20;

type LeanAttributeValue = {
  key: string;
  value: unknown;
};

type LeanOffer = {
  amount?: number;
  startsAt?: Date | string;
  endsAt?: Date | string;
};

type LeanInventory = {
  quantity?: number;
  trackingUnit?: string;
};

type LeanVariant = {
  _id?: Types.ObjectId;
  sku: string;
  attributeValues?: LeanAttributeValue[];
  price: {
    model: 'fixed' | 'per_unit';
    amount: number;
    unitOfMeasure?: string;
  };
  offer?: LeanOffer;
  inventory?: LeanInventory;
  mediaIds?: Types.ObjectId[];
  active?: boolean;
};

type LeanProduct = {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  variants?: LeanVariant[];
};

const PRICE_FALLBACK_IMAGE = '/product-placeholder.svg';

function isOfferActive(offer: LeanOffer | null | undefined, now: Date): boolean {
  if (!offer) return false;
  const { startsAt, endsAt, amount } = offer;
  if (!amount || amount <= 0) return false;
  const starts = startsAt ? new Date(startsAt) : null;
  const ends = endsAt ? new Date(endsAt) : null;
  if (starts && now < starts) return false;
  if (ends && now > ends) return false;
  return true;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function computeFinalPrice(variant: LeanVariant, now: Date): { final: number; original: number; discountPercent?: number } | null {
  const amount = toNumber(variant.price?.amount);
  if (amount === null) {
    return null;
  }
  const offerActive = isOfferActive(variant.offer, now);
  const discount = offerActive ? toNumber(variant.offer?.amount) ?? 0 : 0;
  const finalPrice = Math.max(0, amount - discount);
  let discountPercent: number | undefined;
  if (offerActive && discount > 0 && amount > 0) {
    discountPercent = Math.round((discount / amount) * 100);
  }
  return {
    final: finalPrice,
    original: amount,
    discountPercent: discountPercent && discountPercent > 0 ? discountPercent : undefined,
  };
}

function stringifyAttribute(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${value}` : null;
  }
  if (typeof value === 'object') {
    const maybeRecord = value as { name?: unknown; label?: unknown; value?: unknown };
    if (typeof maybeRecord.name === 'string') {
      return maybeRecord.name.trim();
    }
    if (typeof maybeRecord.label === 'string') {
      return maybeRecord.label.trim();
    }
    if (typeof maybeRecord.value === 'string') {
      return maybeRecord.value.trim();
    }
  }
  return null;
}

function buildAttributesSummary(values: LeanAttributeValue[] | undefined): string | undefined {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }
  const parts = values
    .map((item) => stringifyAttribute(item?.value))
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(' / ');
}

function pickPrimaryVariant(variants: LeanVariant[] | undefined, now: Date): (LeanVariant & { finalPrice: number; originalPrice: number; discountPercent?: number }) | null {
  if (!Array.isArray(variants) || variants.length === 0) {
    return null;
  }
  const active = variants.filter((variant) => variant?.active !== false);
  const candidates = active.length > 0 ? active : variants;
  let selected: (LeanVariant & { finalPrice: number; originalPrice: number; discountPercent?: number }) | null = null;
  candidates.forEach((variant) => {
    const pricing = computeFinalPrice(variant, now);
    if (!pricing) {
      return;
    }
    const finalPrice = pricing.final;
    if (!Number.isFinite(finalPrice)) {
      return;
    }
    if (!selected || finalPrice < selected.finalPrice) {
      selected = {
        ...variant,
        finalPrice,
        originalPrice: pricing.original,
        discountPercent: pricing.discountPercent,
      };
    }
  });
  return selected;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const limitParam = searchParams.get('limit');
  const parsedLimit = limitParam ? Number(limitParam) : MAX_LIMIT;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), MAX_LIMIT) : MAX_LIMIT;

  if (!isMongoConfigured()) {
    const products = PREVIEW_PRODUCTS.slice(0, limit).map((item) => {
      const variant = item.detail.variants[0];
      return {
        id: item.card.id,
        slug: item.card.slug,
        title: item.card.title,
        finalPrice: item.card.finalPrice,
        originalPrice: item.card.originalPrice ?? item.card.finalPrice,
        discountPercent: item.card.discountPercent,
        inStock: item.card.inStock,
        imageUrl: item.card.imageUrl ?? PRICE_FALLBACK_IMAGE,
        line: {
          productId: item.card.id,
          productSlug: item.card.slug,
          title: item.card.title,
          variantId: variant.id,
          sku: variant.sku,
          priceModel: variant.priceModel,
          unitOfMeasure: variant.unitOfMeasure,
          requestedUnit: variant.unitOfMeasure,
          unitPriceBase: variant.unitPrice,
          variantOfferAmount: variant.offerAmount ?? 0,
          mediaThumbId: undefined,
          attributesSummary: variant.attributesSummary,
        },
      };
    });
    return NextResponse.json({ products });
  }

  await connectMongoose();

  const now = new Date();

  const rawProducts = await ProductModel.find(
    { showInCart: true, status: 'active' },
    {
      slug: 1,
      title: 1,
      variants: 1,
    },
  )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean<LeanProduct[]>();

  const products = rawProducts
    .map((product) => {
      const variant = pickPrimaryVariant(product.variants, now);
      if (!variant || !variant._id) {
        // Legacy raw imports may contain variants without Mongo subdocument
        // ids. Do not emit an SKU as variantId: checkout requires a stable
        // ObjectId and otherwise the cart would fail later with a 500.
        return null;
      }
      const inventoryQty = toNumber(variant.inventory?.quantity) ?? 0;
      const inStock = inventoryQty > 0;

      const mediaId =
        Array.isArray(variant.mediaIds) && variant.mediaIds.length > 0
          ? variant.mediaIds[0]?.toString()
          : undefined;
      const imageUrl = mediaId ? `/api/media/${mediaId}` : PRICE_FALLBACK_IMAGE;

      return {
        id: product._id.toString(),
        slug: product.slug,
        title: product.title,
        finalPrice: variant.finalPrice,
        originalPrice: variant.originalPrice,
        discountPercent: variant.discountPercent,
        inStock,
        imageUrl,
        line: {
          productId: product._id.toString(),
          productSlug: product.slug,
          title: product.title,
          variantId: variant._id.toString(),
          sku: variant.sku,
          priceModel: variant.price.model,
          unitOfMeasure: variant.price.unitOfMeasure,
          requestedUnit: variant.price.unitOfMeasure,
          unitPriceBase: variant.originalPrice,
          variantOfferAmount: isOfferActive(variant.offer, now)
            ? toNumber(variant.offer?.amount) ?? 0
            : 0,
          mediaThumbId: mediaId,
          attributesSummary: buildAttributesSummary(variant.attributeValues),
        },
      };
    })
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return NextResponse.json({ products });
}
