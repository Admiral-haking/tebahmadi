import { NextRequest, NextResponse } from 'next/server';

import ProductModel, { type ProductDocument } from '@/catalog/models/Product';
import CategoryModel from '@/catalog/models/Category';
import { effectiveUnitPrice } from '@/catalog/services/productService';
import { connectMongoose } from '@/lib/mongoose';
import { buildMediaUrl, resolveSiteBaseUrl, toAbsoluteUrl } from '@/seo/utils/url';

export const runtime = 'nodejs';

const DEFAULT_PAGE_SIZE = 50;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 500;
const FALLBACK_IMAGE = '/product-placeholder.svg';

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
  const parsed = parsePositiveInt(raw, DEFAULT_PAGE_SIZE);
  if (parsed < MIN_PAGE_SIZE) {
    return MIN_PAGE_SIZE;
  }
  if (parsed > MAX_PAGE_SIZE) {
    return MAX_PAGE_SIZE;
  }
  return parsed;
}

async function loadCategoryNames(categoryIds: string[]): Promise<Map<string, string>> {
  if (categoryIds.length === 0) {
    return new Map();
  }

  const categories = await CategoryModel.find(
    { _id: { $in: categoryIds } },
    { name: 1 },
  ).lean();

  const map = new Map<string, string>();
  categories.forEach((category) => {
    const id = toStringId(category._id);
    if (id) {
      map.set(id, category.name ?? '');
    }
  });

  return map;
}

function pickCategoryName(
  categoryIds: unknown,
  categoryNameMap: Map<string, string>,
): string {
  if (!Array.isArray(categoryIds)) {
    return 'Uncategorized';
  }

  for (const id of categoryIds) {
    const key = toStringId(id);
    const name = categoryNameMap.get(key);
    if (name) {
      return name;
    }
  }

  return 'Uncategorized';
}

function computePricingAndMedia(
  variants: unknown,
  now: Date,
): {
  price: number | null;
  oldPrice: number | null;
  isAvailable: boolean;
  mediaId?: string;
  color?: string;
} {
  if (!Array.isArray(variants)) {
    return {
      price: null,
      oldPrice: null,
      isAvailable: false,
    };
  }

  let price: number | null = null;
  let oldPrice: number | null = null;
  let isAvailable = false;
  let mediaId: string | undefined;
  let color: string | undefined;

  variants
    .filter((variant) => variant?.active !== false)
    .forEach((variant) => {
      const leanVariant = variant as LeanVariant;
      if (!leanVariant?.price || typeof leanVariant.price.amount !== 'number') {
        return;
      }

      const basePrice = Number(leanVariant.price.amount);
      const finalPrice = effectiveUnitPrice(leanVariant, now);

      if (!Number.isFinite(basePrice) || !Number.isFinite(finalPrice)) {
        return;
      }

      const quantity = Number(leanVariant?.inventory?.quantity ?? Number.NaN);
      if (Number.isFinite(quantity) && quantity > 0) {
        isAvailable = true;
      }

      if (price === null || finalPrice < price) {
        price = finalPrice;
        oldPrice = leanVariant.offer && finalPrice < basePrice ? basePrice : null;

        const mediaCandidate = Array.isArray(leanVariant.mediaIds)
          ? leanVariant.mediaIds[0]
          : undefined;
        mediaId = mediaCandidate ? toStringId(mediaCandidate) : undefined;

        if (typeof leanVariant.colorName === 'string' && leanVariant.colorName.trim()) {
          color = leanVariant.colorName.trim();
        } else if (typeof leanVariant.colorKey === 'string' && leanVariant.colorKey.trim()) {
          color = leanVariant.colorKey.trim();
        } else {
          color = undefined;
        }
      }
    });

  return {
    price,
    oldPrice,
    isAvailable,
    mediaId,
    color,
  };
}

async function handle(req: NextRequest): Promise<NextResponse> {
  try {
    await connectMongoose();

    const params = req.nextUrl.searchParams;
    const page = parsePositiveInt(params.get('page'), 1);
    const pageSize = normalizePageSize(
      params.get('item_per_page') ?? params.get('page_size') ?? params.get('limit'),
    );
    const skip = (page - 1) * pageSize;

    const baseUrl = resolveSiteBaseUrl();
    const now = new Date();
    const query = { status: 'active' as const };

    const [products, total] = await Promise.all([
      ProductModel.find(query, {
        _id: 1,
        slug: 1,
        title: 1,
        variants: 1,
        categories: 1,
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      ProductModel.countDocuments(query),
    ]);

    const categoryIds = new Set<string>();
    products.forEach((product) => {
      if (!Array.isArray(product.categories)) {
        return;
      }
      product.categories.forEach((categoryId) => {
        const id = toStringId(categoryId);
        if (id) {
          categoryIds.add(id);
        }
      });
    });

    const categoryNameMap = await loadCategoryNames([...categoryIds]);

    const items = products
      .map((product) => {
        const productId = toStringId(product._id);
        const slug = typeof product.slug === 'string' ? product.slug : '';
        const productPath = slug ? `/product/${slug}` : '';
        const pageUrl = productPath ? toAbsoluteUrl(productPath, baseUrl) : '';

        const { price, oldPrice, isAvailable, mediaId, color } = computePricingAndMedia(
          product.variants,
          now,
        );

        if (price === null) {
          return null;
        }

        const imageUrl = mediaId
          ? buildMediaUrl(mediaId, baseUrl)
          : toAbsoluteUrl(FALLBACK_IMAGE, baseUrl);

        return {
          title: product.title,
          id: productId || slug,
          price,
          old_price: oldPrice ?? undefined,
          category: pickCategoryName(product.categories, categoryNameMap),
          image: imageUrl,
          color: color ?? undefined,
          guarantee: undefined,
          is_available: isAvailable,
          url: pageUrl,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const pagesCount = total > 0 ? Math.ceil(total / pageSize) : 0;

    return NextResponse.json({
      success: true,
      products: items,
      total_items: total,
      pages_count: pagesCount,
      item_per_page: pageSize,
      page_num: page,
    });
  } catch (error) {
    console.warn('Public product list unavailable; returning an empty result', error);
    const params = req.nextUrl.searchParams;
    const page = parsePositiveInt(params.get('page'), 1);
    const pageSize = normalizePageSize(
      params.get('item_per_page') ?? params.get('page_size') ?? params.get('limit'),
    );
    return NextResponse.json({
      success: true,
      products: [],
      total_items: 0,
      pages_count: 0,
      item_per_page: pageSize,
      page_num: page,
    });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
