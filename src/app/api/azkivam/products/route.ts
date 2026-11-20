import { NextRequest, NextResponse } from 'next/server';

import CategoryModel from '@/catalog/models/Category';
import ProductModel, { type ProductDocument } from '@/catalog/models/Product';
import { effectiveUnitPrice } from '@/catalog/services/productService';
import { connectMongoose } from '@/lib/mongoose';
import { SiteInfoModel } from '@/settings/models/SiteInfo';
import { resolveSiteBaseUrl, toAbsoluteUrl } from '@/seo/utils/url';

export const runtime = 'nodejs';

const DEFAULT_PAGE_SIZE = 100;
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
  const parsed = parsePositiveInt(raw, DEFAULT_PAGE_SIZE);
  return Math.min(Math.max(parsed, 1), MAX_PAGE_SIZE);
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readFirstMediaId(product: { variants?: unknown }): string {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  for (const variant of variants) {
    const mediaIds = (variant as { mediaIds?: unknown[] })?.mediaIds;
    const mediaId = Array.isArray(mediaIds) ? toStringId(mediaIds[0]) : '';
    if (mediaId) {
      return mediaId;
    }
  }

  return '';
}

function resolveProductPricing(product: { variants?: unknown }, now: Date) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  let selected:
    | {
      basePrice: number;
      finalPrice: number;
    }
    | null = null;
  let inventoryTotal = 0;

  for (const variant of variants) {
    const leanVariant = variant as LeanVariant;
    if (!leanVariant || leanVariant.active === false) {
      continue;
    }

    const basePrice = Number(leanVariant.price?.amount ?? Number.NaN);
    if (!Number.isFinite(basePrice)) {
      continue;
    }

    const finalPrice = effectiveUnitPrice(leanVariant, now);
    if (!Number.isFinite(finalPrice)) {
      continue;
    }

    if (!selected || finalPrice < selected.finalPrice) {
      selected = {
        basePrice: Math.max(0, Math.floor(basePrice)),
        finalPrice: Math.max(0, Math.floor(finalPrice)),
      };
    }

    const quantity = Number(leanVariant.inventory?.quantity ?? Number.NaN);
    if (Number.isFinite(quantity)) {
      inventoryTotal += quantity;
    }
  }

  return {
    availability: inventoryTotal > 0 ? 'instock' : 'outofstock',
    priceBeforeDiscount: selected?.basePrice ?? null,
    totalPrice: selected?.finalPrice ?? null,
  };
}

async function resolveMerchantName(): Promise<string> {
  const envName = cleanText(process.env.AZKIVAM_MERCHANT_NAME);
  if (envName) {
    return envName;
  }

  const siteInfo = await SiteInfoModel.findOne({}, { appName: 1 }).lean().exec();
    return cleanText(siteInfo?.appName) || 'طب احمدی';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();

  const params = req.nextUrl.searchParams;
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = normalizePageSize(
    params.get('page_size') ?? params.get('pageSize') ?? params.get('limit'),
  );
  const skip = (page - 1) * pageSize;
  const now = new Date();
  const baseUrl = resolveSiteBaseUrl();

  const [merchant, products, total] = await Promise.all([
    resolveMerchantName(),
    ProductModel.find({ status: 'active' })
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean()
      .exec(),
    ProductModel.countDocuments({ status: 'active' }),
  ]);

  const categoryIds = Array.from(
    new Set(
      products.flatMap((product) =>
        (Array.isArray(product.categories) ? product.categories : [])
          .map((categoryId) => toStringId(categoryId))
          .filter(Boolean),
      ),
    ),
  );

  const categories = categoryIds.length
    ? await CategoryModel.find({ _id: { $in: categoryIds } }, { name: 1 }).lean().exec()
    : [];
  const categoryMap = new Map(categories.map((category) => [toStringId(category._id), cleanText(category.name)]));

  const items = products.map((product) => {
    const productId = toStringId(product._id);
    const slug = cleanText(product.slug);
    const listingUrl = slug ? toAbsoluteUrl(`/product/${slug}`, baseUrl) : '';
    const mediaId = readFirstMediaId(product);
    const categoryName =
      (Array.isArray(product.categories)
        ? product.categories
          .map((categoryId) => categoryMap.get(toStringId(categoryId)))
          .find((name): name is string => Boolean(name))
        : undefined) ?? '';
    const pricing = resolveProductPricing(product, now);

    return {
      merchant,
      name: cleanText(product.title),
      category_name: categoryName,
      description: cleanText(product.description) || cleanText(product.seoDescription) || cleanText(product.title),
      image_url: mediaId ? toAbsoluteUrl(`/api/media/${mediaId}?type=original`, baseUrl) : '',
      listing_url: listingUrl,
      ads_id: productId || slug,
      availability: pricing.availability,
      price_before_discount: pricing.priceBeforeDiscount,
      total_price: pricing.totalPrice,
    };
  });

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return NextResponse.json(
    {
      products: items,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
