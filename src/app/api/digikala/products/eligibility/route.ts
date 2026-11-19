import {
  dgkGetProductVariantsPage,
  type ProductImportEligibility,
} from "@/digikala/services/products";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_PRODUCTS_PER_REQUEST = 50;
const CACHE_TTL_MS = 90_000;
const FETCH_CONCURRENCY = 2;
const VARIANTS_PAGE_SIZE = 50;
const MAX_QUICK_VARIANT_PAGES = 1;

type EligibilityCacheEntry = {
  expiresAt: number;
  value: ProductImportEligibility;
};

declare global {  var __dgkEligibilityCache: Map<string, EligibilityCacheEntry> | undefined;
}

function getEligibilityCache(): Map<string, EligibilityCacheEntry> {
  if (!globalThis.__dgkEligibilityCache) {
    globalThis.__dgkEligibilityCache = new Map();
  }
  return globalThis.__dgkEligibilityCache;
}

function buildCacheKey(vendorId: string, productId: number): string {
  return vendorId + ":" + productId;
}

function parseProductIds(raw: string | null): number[] {
  if (!raw) return [];

  const seen = new Set<number>();
  const ids: number[] = [];

  raw.split(",")
    .map((item) => Number(item.trim()))
    .forEach((id) => {
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    });

  return ids;
}

async function computeEligibility(vendorId: string, productId: number): Promise<ProductImportEligibility> {
  try {
    const firstPage = await dgkGetProductVariantsPage(vendorId, String(productId), 1, VARIANTS_PAGE_SIZE);
    const firstItems = Array.isArray(firstPage?.data?.items) ? firstPage.data.items : [];
    const pager = firstPage?.data?.pager;
    const totalPages = Math.max(1, Number(pager?.total_pages ?? 1) || 1);
    const totalRows = Math.max(firstItems.length, Number(pager?.total_rows ?? firstItems.length) || 0);

    let activeVariantCount = 0;
    let activeInStockVariantCount = 0;
    let inactiveVariantCount = 0;
    let zeroStockVariantCount = 0;
    let inStockVariantCount = 0;

    const countVariants = (items: typeof firstItems) => {
      const counts = {
        active: 0,
        inactive: 0,
        activeInStock: 0,
        zeroStock: 0,
        inStock: 0,
      };
      items.forEach((variant) => {
        const isActive = variant?.active === true;
        const stock = Number(variant?.marketplace_seller_stock ?? 0);

        if (isActive) counts.active += 1;
        else counts.inactive += 1;

        if (Number.isFinite(stock) && stock > 0) {
          counts.inStock += 1;
          if (isActive) counts.activeInStock += 1;
        } else {
          counts.zeroStock += 1;
        }
      });
      return counts;
    };

    const firstCounts = countVariants(firstItems);
    activeVariantCount = firstCounts.active;
    inactiveVariantCount = firstCounts.inactive;
    activeInStockVariantCount = firstCounts.activeInStock;
    zeroStockVariantCount = firstCounts.zeroStock;
    inStockVariantCount = firstCounts.inStock;

    const pagesToInspect = Math.min(totalPages, MAX_QUICK_VARIANT_PAGES);

    if (activeInStockVariantCount === 0 && pagesToInspect > 1) {
      const remainingPages = await Promise.all(
        Array.from({ length: pagesToInspect - 1 }, (_, index) => index + 2).map((page) =>
          dgkGetProductVariantsPage(vendorId, String(productId), page, VARIANTS_PAGE_SIZE),
        ),
      );

      const remainingCounts = remainingPages.reduce((total, pageResponse) => {
        const items = Array.isArray(pageResponse?.data?.items) ? pageResponse.data.items : [];
        const counts = countVariants(items);
        total.active += counts.active;
        total.inactive += counts.inactive;
        total.activeInStock += counts.activeInStock;
        total.zeroStock += counts.zeroStock;
        total.inStock += counts.inStock;
        return total;
      }, { active: 0, inactive: 0, activeInStock: 0, zeroStock: 0, inStock: 0 });

      activeVariantCount += remainingCounts.active;
      inactiveVariantCount += remainingCounts.inactive;
      activeInStockVariantCount += remainingCounts.activeInStock;
      zeroStockVariantCount += remainingCounts.zeroStock;
      inStockVariantCount += remainingCounts.inStock;
    }

    const totalVariants = totalRows;
    const canImport = totalVariants > 0;

    let reason: string | undefined;
    if (!canImport) {
      if (totalVariants === 0) {
        reason = "واریانت ندارد";
      }
    } else if (activeInStockVariantCount === 0) {
      reason = "واریانت فعالِ دارای موجودی ندارد؛ افزودن/تکمیل دستی فعال است";
    }

    return {
      canImport,
      totalVariants,
      activeVariantCount,
      activeInStockVariantCount,
      inactiveVariantCount,
      zeroStockVariantCount,
      inStockVariantCount,
      updatedAt: new Date().toISOString(),
      reason,
    };
  } catch {
    return {
      canImport: false,
      totalVariants: 0,
      activeVariantCount: 0,
      activeInStockVariantCount: 0,
      inactiveVariantCount: 0,
      zeroStockVariantCount: 0,
      inStockVariantCount: 0,
      updatedAt: new Date().toISOString(),
      reason: "خطا در دریافت واریانت‌ها",
    };
  }
}

async function fetchWithConcurrency(
  vendorId: string,
  productIds: number[],
): Promise<Map<number, ProductImportEligibility>> {
  const results = new Map<number, ProductImportEligibility>();

  if (!productIds.length) return results;

  const concurrency = Math.max(1, Math.min(FETCH_CONCURRENCY, productIds.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < productIds.length) {
        const index = cursor;
        cursor += 1;

        const productId = productIds[index];
        const eligibility = await computeEligibility(vendorId, productId);
        results.set(productId, eligibility);
      }
    }),
  );

  return results;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const vendorId = (url.searchParams.get("vendorId") ?? "").trim();
  const productIds = parseProductIds(url.searchParams.get("productIds"));

  if (!vendorId) {
    return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });
  }

  if (!productIds.length) {
    return NextResponse.json({ error: "At least one productId is required" }, { status: 400 });
  }

  if (productIds.length > MAX_PRODUCTS_PER_REQUEST) {
    return NextResponse.json({ error: "Too many productIds" }, { status: 400 });
  }

  const now = Date.now();
  const cache = getEligibilityCache();
  const responseMap = new Map<number, ProductImportEligibility>();
  const toFetch: number[] = [];

  productIds.forEach((productId) => {
    const cached = cache.get(buildCacheKey(vendorId, productId));
    if (cached && cached.expiresAt > now) {
      responseMap.set(productId, cached.value);
      return;
    }
    toFetch.push(productId);
  });

  if (toFetch.length) {
    const fetched = await fetchWithConcurrency(vendorId, toFetch);
    fetched.forEach((value, productId) => {
      cache.set(buildCacheKey(vendorId, productId), {
        value,
        expiresAt: now + CACHE_TTL_MS,
      });
      responseMap.set(productId, value);
    });
  }

  const items = Object.fromEntries(
    productIds.map((productId) => [String(productId), responseMap.get(productId) ?? null]),
  );

  return NextResponse.json({ items });
}
