import { NextRequest, NextResponse } from 'next/server';

import ProductModel, { type ProductDocument } from '@/catalog/models/Product';
import { effectiveUnitPrice } from '@/catalog/services/productService';
import { connectMongoose } from '@/lib/mongoose';
import { resolveSiteBaseUrl, toAbsoluteUrl } from '@/seo/utils/url';

export const runtime = 'nodejs';

const MIN_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

type LeanVariant = ProductDocument['variants'][number];

function toStringId(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof (value as { toString: () => string }).toString === 'function') {
    return (value as { toString: () => string }).toString();
  }
  return '';
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizePageSize(raw: string | null): number {
  const parsed = parsePositiveInt(raw, MIN_PAGE_SIZE);
  if (parsed < MIN_PAGE_SIZE) {
    return MIN_PAGE_SIZE;
  }
  if (parsed > MAX_PAGE_SIZE) {
    return MAX_PAGE_SIZE;
  }
  return parsed;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();

  const params = req.nextUrl.searchParams;
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = normalizePageSize(
    params.get('page_size') ?? params.get('pageSize') ?? params.get('limit'),
  );
  const skip = (page - 1) * pageSize;

  const baseUrl = resolveSiteBaseUrl();
  const now = new Date();
  const query = { status: 'active' as const };

  const [products, total] = await Promise.all([
    ProductModel.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean()
      .exec(),
    ProductModel.countDocuments(query),
  ]);

  const items = products.map((product) => {
    const productId = toStringId(product._id);
    const slug = typeof product.slug === 'string' ? product.slug : '';
    const productPath = slug ? `/product/${slug}` : '';
    const pageUrl = productPath ? toAbsoluteUrl(productPath, baseUrl) : '';

    const variants = Array.isArray(product.variants) ? product.variants : [];
    let availability: 'instock' | 'outofstock' = 'outofstock';
    let price: number | null = null;
    let oldPrice: number | null = null;
    let inventoryTotal = 0;

    variants
      .filter((variant) => variant?.active !== false)
      .forEach((variant) => {
        const leanVariant = variant as LeanVariant;
        const basePrice = Number(leanVariant?.price?.amount ?? Number.NaN);
        if (!Number.isFinite(basePrice)) {
          return;
        }

        const finalPrice = effectiveUnitPrice(leanVariant, now);
        if (!Number.isFinite(finalPrice)) {
          return;
        }

        if (price === null || finalPrice < price) {
          price = finalPrice;
        }

        const quantity = Number(leanVariant?.inventory?.quantity ?? Number.NaN);
        if (Number.isFinite(quantity)) {
          inventoryTotal += quantity;
        }

        if (leanVariant.offer && finalPrice < basePrice) {
          if (oldPrice === null || basePrice < oldPrice) {
            oldPrice = basePrice;
          }
        }
      });

    if (inventoryTotal > 0) {
      availability = 'instock';
    }

    return {
      product_id: productId || slug,
      page_url: pageUrl,
      price,
      availability,
      old_price: oldPrice,
    };
  });

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return NextResponse.json({
    products: items,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  });
}
