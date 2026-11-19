import { NextRequest, NextResponse } from 'next/server';

import ProductModel from '@/catalog/models/Product';
import CategoryModel from '@/catalog/models/Category';
import MediaModel from '@/media/models/Media';
import { effectiveUnitPrice } from '@/catalog/services/productService';
import { connectMongoose } from '@/lib/mongoose';
import { resolveSiteBaseUrl, toAbsoluteUrl } from '@/seo/utils/url';
import { Types } from 'mongoose';

/**
 * API ذره‌بین (Torob) جهت استخراج محصولات
 *
 * پارامترهای ورودی (QueryString):
 *   - product_id: (اختیاری) شناسه یکتای محصول
 *   - page: (اختیاری) شماره صفحه - پیش‌فرض 1
 *
 * خروجی:
 *   - اگر product_id ارسال شود: فقط همان محصول برگردانده می‌شود
 *   - در غیر این صورت: لیست محصولات با صفحه‌بندی (100 محصول در هر صفحه)
 */

export const runtime = 'nodejs';

const PAGE_SIZE = 100;
const MAX_TITLE_LENGTH = 500;
const MAX_SUBTITLE_LENGTH = 500;
const MAX_IMAGE_LINK_LENGTH = 1000;

/**
 * تبدیل یک مقدار به رشته
 */
function toStringId(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof (value as { toString: () => string }).toString === 'function') {
    return (value as { toString: () => string }).toString();
  }
  return '';
}

/**
 * تبدیل یک مقدار به عدد صحیح مثبت
 */
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

/**
 * بررسی اعتبار یک ObjectId
 */
function isValidObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

/**
 * ساخت آدرس کامل تصویر از روی mediaId
 */
function buildMediaUrl(mediaId: string, baseUrl: URL | undefined): string {
  const path = `/api/media/${mediaId}`;
  return toAbsoluteUrl(path, baseUrl);
}

/**
 * تشخیص اینکه یک مقدار ObjectId دیتای مونگو است یا یک شناسه متنی (slug/custom id)
 */
function isMongoObjectId(value: string): boolean {
  try {
    return Types.ObjectId.isValid(value) && new Types.ObjectId(value).toString() === value;
  } catch {
    return false;
  }
}

/**
 * نرمال‌سازی متن با محدودیت کاراکتر
 */
function truncateText(text: string | undefined | null, maxLength: number): string | undefined {
  if (!text) {
    return undefined;
  }
  const str = String(text).trim();
  if (str.length === 0) {
    return undefined;
  }
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();

  const params = req.nextUrl.searchParams;
  const productId = params.get('product_id');
  const page = parsePositiveInt(params.get('page'), 1);
  const skip = (page - 1) * PAGE_SIZE;

  const baseUrl = resolveSiteBaseUrl();
  const now = new Date();

  // ساخت کور محصولات فعال
  const baseQuery: Record<string, unknown> = { status: 'active' };

  // اگر product_id ارسال شده باشد، محصول خاص را جستجو می‌کنیم
  let products;
  let total = 0;

  if (productId) {
    // جستجو بر اساس product_id (می‌تواند ObjectId یا slug باشد)
    const trimmedId = productId.trim();
    if (isMongoObjectId(trimmedId)) {
      baseQuery._id = new Types.ObjectId(trimmedId);
    } else {
      baseQuery.slug = trimmedId;
    }

    const product = await ProductModel.findOne(baseQuery).lean().exec();
    products = product ? [product] : [];
    total = product ? 1 : 0;
  } else {
    // لیست محصولات با صفحه‌بندی
    const [foundProducts, foundTotal] = await Promise.all([
      ProductModel.find(baseQuery)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .lean()
        .exec(),
      ProductModel.countDocuments(baseQuery),
    ]);
    products = foundProducts;
    total = foundTotal;
  }

  if (products.length === 0) {
    return NextResponse.json({
      count: '0',
      total_pages_count: '0',
      products: [],
    });
  }

  // جمع‌آوری شناسه‌های دسته‌بندی و مدیا برای کوئری یکپارچه
  const categoryIds = new Set<string>();
  const mediaIds = new Set<string>();

  for (const product of products) {
    // دسته‌بندی‌ها
    if (Array.isArray(product.categories)) {
      for (const catId of product.categories) {
        const idStr = toStringId(catId);
        if (idStr) categoryIds.add(idStr);
      }
    }

    // تصاویر واریانت‌ها
    if (Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (Array.isArray(variant.mediaIds)) {
          for (const mediaId of variant.mediaIds) {
            const idStr = toStringId(mediaId);
            if (idStr) mediaIds.add(idStr);
          }
        }
      }
    }
  }

  // دریافت اطلاعات دسته‌بندی‌ها
  const categoryMap = new Map<string, string>();
  if (categoryIds.size > 0) {
    const categoryDocs = await CategoryModel.find({
      _id: { $in: Array.from(categoryIds).map((id) => new Types.ObjectId(id)) },
    })
      .select('name slug')
      .lean()
      .exec();

    for (const cat of categoryDocs) {
      categoryMap.set(toStringId(cat._id), (cat as any).name || (cat as any).slug || '');
    }
  }

  // دریافت اطلاعات مدیا (تصاویر)
  const mediaMap = new Map<string, { originalId: string; mobileId?: string; thumbId?: string }>();
  if (mediaIds.size > 0) {
    const mediaDocs = await MediaModel.find({
      _id: { $in: Array.from(mediaIds).map((id) => new Types.ObjectId(id)) },
    })
      .select('originalId mobileId thumbId')
      .lean()
      .exec();

    for (const media of mediaDocs) {
      const m = media as any;
      mediaMap.set(toStringId(m._id), {
        originalId: toStringId(m.originalId),
        mobileId: m.mobileId ? toStringId(m.mobileId) : undefined,
        thumbId: m.thumbId ? toStringId(m.thumbId) : undefined,
      });
    }
  }

  // ساخت خروجی نهایی
  const items = products.map((product) => {
    const productIdStr = toStringId(product._id);
    const slug = typeof product.slug === 'string' ? product.slug : '';
    const productPath = slug ? `/product/${slug}` : '';
    const pageUrl = productPath ? toAbsoluteUrl(productPath, baseUrl) : '';

    // --- قیمت و موجودی ---
    const variants = Array.isArray(product.variants) ? product.variants : [];
    let availability: 'instock' | 'outofstock' = 'outofstock';
    let currentPrice: number | null = null;
    let oldPrice: number | null = null;
    let inventoryTotal = 0;

    // جمع‌آوری تصاویر از همه واریانت‌ها
    const allImageLinks: string[] = [];
    const seenMediaUrls = new Set<string>();

    for (const variant of variants) {
      if (variant.active === false) continue;

      const basePrice = Number((variant as any).price?.amount ?? Number.NaN);
      if (!Number.isFinite(basePrice)) continue;

      const finalPrice = effectiveUnitPrice(variant as any, now);
      if (!Number.isFinite(finalPrice)) continue;

      // کمترین قیمت
      if (currentPrice === null || finalPrice < currentPrice) {
        currentPrice = finalPrice;
      }

      // مجموع موجودی
      const quantity = Number((variant as any).inventory?.quantity ?? Number.NaN);
      if (Number.isFinite(quantity)) {
        inventoryTotal += quantity;
      }

      // قیمت قبل از تخفیف
      if ((variant as any).offer && finalPrice < basePrice) {
        if (oldPrice === null || basePrice < oldPrice) {
          oldPrice = basePrice;
        }
      }

      // جمع‌آوری لینک تصاویر از mediaIds واریانت
      if (Array.isArray((variant as any).mediaIds)) {
        for (const mediaId of (variant as any).mediaIds) {
          const mediaIdStr = toStringId(mediaId);
          const mediaInfo = mediaMap.get(mediaIdStr);
          if (mediaInfo) {
            const imgUrl = buildMediaUrl(mediaInfo.originalId, baseUrl);
            if (imgUrl && !seenMediaUrls.has(imgUrl) && imgUrl.length <= MAX_IMAGE_LINK_LENGTH) {
              seenMediaUrls.add(imgUrl);
              allImageLinks.push(imgUrl);
            }
          }
        }
      }
    }

    if (inventoryTotal > 0) {
      availability = 'instock';
    }

    // --- دسته‌بندی‌ها ---
    const categories: string[] = [];
    if (Array.isArray(product.categories)) {
      for (const catId of product.categories) {
        const catName = categoryMap.get(toStringId(catId));
        if (catName) {
          categories.push(catName);
        }
      }
    }

    // --- مشخصات (spec) از attributeValues ---
    const spec: Record<string, string> = {};
    if (Array.isArray((product as any).attributeValues)) {
      for (const attr of (product as any).attributeValues) {
        if (attr.key && attr.value !== undefined && attr.value !== null) {
          const value = Array.isArray(attr.value)
            ? attr.value.map((v: unknown) => String(v)).join('، ')
            : String(attr.value);
          spec[attr.key] = value;
        }
      }
    }

    // --- فیلدهای registry و guarantee از attrs یا attributeValues ---
    let registry: string | undefined;
    let guarantee: string | undefined;

    if ((product as any).attrs && typeof (product as any).attrs === 'object') {
      const attrs = (product as any).attrs as Map<string, unknown> | Record<string, unknown>;
      if (attrs instanceof Map) {
        const registryVal = attrs.get('registry');
        if (registryVal) registry = String(registryVal);
        const guaranteeVal = attrs.get('guarantee');
        if (guaranteeVal) guarantee = String(guaranteeVal);
      } else {
        const registryVal = (attrs as Record<string, unknown>)['registry'];
        if (registryVal) registry = String(registryVal);
        const guaranteeVal = (attrs as Record<string, unknown>)['guarantee'];
        if (guaranteeVal) guarantee = String(guaranteeVal);
      }
    }

    // اگر در attrs نبود، از attributeValues چک کن
    if (!registry || !guarantee) {
      if (Array.isArray((product as any).attributeValues)) {
        for (const attr of (product as any).attributeValues) {
          if (attr.key === 'registry' && !registry) {
            registry = String(attr.value);
          }
          if (attr.key === 'guarantee' && !guarantee) {
            guarantee = String(attr.value);
          }
        }
      }
    }

    // --- توضیحات مختصر ---
    const shortDesc = (product as any).description
      ? truncateText((product as any).description, 500)
      : undefined;

    // --- ساختن آبجکت نهایی محصول ---
    const result: Record<string, unknown> = {
      id: productIdStr,
      title: truncateText(product.title, MAX_TITLE_LENGTH) ?? '',
      current_price: currentPrice !== null ? String(Math.round(currentPrice)) : '0',
      availability,
      categories,
      image_link: allImageLinks.length > 0 ? allImageLinks[0] : '',
      image_links: allImageLinks.length > 0 ? allImageLinks : [],
      page_url: pageUrl,
    };

    // فیلدهای اختیاری
    if (oldPrice !== null && oldPrice !== currentPrice) {
      result.old_price = String(Math.round(oldPrice));
    }

    const subtitle = truncateText((product as any).brand, MAX_SUBTITLE_LENGTH);
    if (subtitle) {
      result.subtitle = subtitle;
    }

    if (Object.keys(spec).length > 0) {
      result.spec = spec;
    }

    if (shortDesc) {
      result.short_desc = shortDesc;
    }

    if (registry) {
      result.registry = registry;
    }

    if (guarantee) {
      result.guarantee = guarantee;
    }

    return result;
  });

  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;

  return NextResponse.json({
    count: String(total),
    total_pages_count: String(totalPages),
    products: items,
  });
}
