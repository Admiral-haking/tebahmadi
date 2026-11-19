import { NextRequest, NextResponse } from 'next/server';
import { importSPKI, jwtVerify } from 'jose';
import ProductModel, { type ProductDocument } from '@/catalog/models/Product';
import { effectiveUnitPrice } from '@/catalog/services/productService';
import { connectMongoose } from '@/lib/mongoose';
import { resolveSiteBaseUrl, toAbsoluteUrl, buildMediaUrl } from '@/seo/utils/url';

export const runtime = 'nodejs';

// Torob EdDSA Public Key (ed25519)
const TOROB_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----`;

const API_HOSTNAME = 'tebahmadi.ir';
const API_VERSION = 'torob_api_v3';
const PAGE_SIZE = 100;

type LeanVariant = ProductDocument['variants'][number];

function toStringId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof (value as { toString: () => string }).toString === 'function') {
    return (value as { toString: () => string }).toString();
  }
  return '';
}

function encodeSlug(slug: string): string {
  return encodeURIComponent(slug);
}

function getProductPageUrl(slug: string, baseUrl?: URL): string {
  const path = slug ? `/product/${encodeSlug(slug)}/` : '';
  return path && baseUrl ? toAbsoluteUrl(path, baseUrl) : '';
}

function getPageUnique(product: ProductDocument, variantIndex = 0): string {
  const id = toStringId(product._id);
  return variantIndex > 0 ? `${id}_${variantIndex}` : id;
}

function getImageLinks(product: ProductDocument, baseUrl?: URL): string[] {
  const links: string[] = [];
  const variants = Array.isArray(product.variants) ? product.variants : [];
  for (const variant of variants) {
    if (!variant?.active) continue;
    const mediaIds = Array.isArray(variant.mediaIds) ? variant.mediaIds : [];
    for (const mediaId of mediaIds) {
      const id = toStringId(mediaId);
      if (id) {
        const url = buildMediaUrl(id, baseUrl);
        if (url && !links.includes(url)) links.push(url);
      }
    }
  }
  return links;
}

function getSpec(product: ProductDocument): Record<string, string | number> {
  const spec: Record<string, string | number> = {};
  
  // Add brand if exists
  if (product.brand) spec.brand = product.brand;
  
  // Add attributes from attributeValues
  const attrs = Array.isArray(product.attributeValues) ? product.attributeValues : [];
  for (const attr of attrs) {
    if (attr.key && attr.value !== undefined && attr.value !== null) {
      spec[attr.key] = String(attr.value);
    }
  }
  
  return spec;
}

function getCategoryName(product: ProductDocument): string | undefined {
  // Try to get from attrs map first
  if (product.attrs && typeof product.attrs === 'object') {
    const attrsMap = product.attrs as Map<string, unknown> | Record<string, unknown>;
    const category = attrsMap instanceof Map 
      ? attrsMap.get('category') 
      : (attrsMap as Record<string, unknown>).category;
    if (category && typeof category === 'string') return category;
  }
  return undefined;
}

async function validateToken(token: string): Promise<boolean> {
  try {
    const publicKey = await importSPKI(TOROB_PUBLIC_KEY, 'EdDSA');
    const { payload } = await jwtVerify(token, publicKey, {
      audience: API_HOSTNAME,
    });

    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (payload.exp && now > payload.exp) return false;
    // Check not before
    if (payload.nbf && now < payload.nbf) return false;
    
    return true;
  } catch {
    return false;
  }
}

async function getProductsByPage(page: number, sort: string, baseUrl?: URL, now?: Date) {
  const skip = (page - 1) * PAGE_SIZE;
  const currentDate = now || new Date();

  let sortQuery: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'date_updated_desc') {
    sortQuery = { updatedAt: -1 };
  }

  // Find all products that have at least one active variant with price
  const query = {
    variants: {
      $elemMatch: {
        active: true,
        'price.amount': { $gt: 0, $exists: true },
      }
    }
  };

  const [products, total] = await Promise.all([
    ProductModel.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(PAGE_SIZE)
      .lean()
      .exec(),
    ProductModel.countDocuments(query),
  ]);

  const resultProducts = products.flatMap((product) => {
    const variants = Array.isArray(product.variants) ? product.variants.filter(v => v?.active) : [];
    if (variants.length === 0) return [];

    const slug = typeof product.slug === 'string' ? product.slug : '';
    const pageUnique = getPageUnique(product as unknown as ProductDocument);
    const pageUrl = getProductPageUrl(slug, baseUrl);
    const imageLinks = getImageLinks(product as unknown as ProductDocument, baseUrl);
    const spec = getSpec(product as unknown as ProductDocument);

    let minPrice: number | null = null;
    let minOldPrice: number | null = null;
    let totalStock = 0;

    for (const v of variants) {
      const basePrice = Number(v?.price?.amount ?? NaN);
      if (!Number.isFinite(basePrice)) continue;
      const finalPrice = effectiveUnitPrice(v as LeanVariant, currentDate);
      if (!Number.isFinite(finalPrice)) continue;

      if (minPrice === null || finalPrice < minPrice) minPrice = finalPrice;
      if (v.offer && finalPrice < basePrice) {
        if (minOldPrice === null || basePrice < minOldPrice) minOldPrice = basePrice;
      }
      totalStock += Number(v?.inventory?.quantity ?? 0);
    }

    return [{
      page_unique: pageUnique,
      page_url: pageUrl,
      title: product.title || '',
      current_price: minPrice !== null ? Math.round(minPrice) : 0,
      old_price: minOldPrice !== null ? Math.round(minOldPrice) : undefined,
      availability: totalStock > 0,
      image_links: imageLinks.length > 0 ? imageLinks : [],
      spec,
      category_name: getCategoryName(product as unknown as ProductDocument),
      date_added: product.createdAt 
        ? new Date(product.createdAt).toISOString()
        : new Date().toISOString(),
      date_updated: product.updatedAt
        ? new Date(product.updatedAt).toISOString()
        : undefined,
    }];
  });

  const maxPages = Math.ceil(total / PAGE_SIZE);

  return {
    api_version: API_VERSION,
    current_page: page,
    total,
    max_pages: maxPages,
    products: resultProducts,
  };
}

async function getProductsByUrls(pageUrls: string[], baseUrl?: URL, now?: Date) {
  const currentDate = now || new Date();
  const slugs = pageUrls
    .map((url) => {
      try {
        const u = new URL(url);
        // Support both /product/{slug}/ and /store/{slug}/ paths
        const match = u.pathname.match(/^\/(?:product|store)\/(.+?)\/?$/);
        return match ? decodeURIComponent(match[1]) : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as string[];

  if (slugs.length === 0) {
    return {
      api_version: API_VERSION,
      current_page: 1,
      total: 0,
      max_pages: 1,
      products: [],
    };
  }

  const products = await ProductModel.find({ slug: { $in: slugs } })
    .lean()
    .exec();

  const resultProducts = products.flatMap((product) => {
    const slug = typeof product.slug === 'string' ? product.slug : '';
    const variants = Array.isArray(product.variants) ? product.variants.filter(v => v?.active) : [];
    if (variants.length === 0) return [];

    const pageUnique = getPageUnique(product as unknown as ProductDocument);
    const pageUrl = getProductPageUrl(slug, baseUrl);
    const imageLinks = getImageLinks(product as unknown as ProductDocument, baseUrl);
    const spec = getSpec(product as unknown as ProductDocument);

    let minPrice: number | null = null;
    let minOldPrice: number | null = null;
    let totalStock = 0;

    for (const v of variants) {
      const basePrice = Number(v?.price?.amount ?? NaN);
      if (!Number.isFinite(basePrice)) continue;
      const finalPrice = effectiveUnitPrice(v as LeanVariant, currentDate);
      if (!Number.isFinite(finalPrice)) continue;

      if (minPrice === null || finalPrice < minPrice) minPrice = finalPrice;
      if (v.offer && finalPrice < basePrice) {
        if (minOldPrice === null || basePrice < minOldPrice) minOldPrice = basePrice;
      }
      totalStock += Number(v?.inventory?.quantity ?? 0);
    }

    return [{
      page_unique: pageUnique,
      page_url: pageUrl,
      title: product.title || '',
      current_price: minPrice !== null ? Math.round(minPrice) : 0,
      old_price: minOldPrice !== null ? Math.round(minOldPrice) : undefined,
      availability: totalStock > 0,
      image_links: imageLinks.length > 0 ? imageLinks : [],
      spec,
      category_name: getCategoryName(product as unknown as ProductDocument),
      date_added: product.createdAt
        ? new Date(product.createdAt).toISOString()
        : new Date().toISOString(),
      date_updated: product.updatedAt
        ? new Date(product.updatedAt).toISOString()
        : undefined,
    }];
  });

  return {
    api_version: API_VERSION,
    current_page: 1,
    total: resultProducts.length,
    max_pages: 1,
    products: resultProducts,
  };
}

async function getProductsByUniques(pageUniques: string[], baseUrl?: URL, now?: Date) {
  // Extract product IDs from page_uniques (format: "productId" or "productId_variantIndex")
  const productIds = pageUniques
    .map((u) => u.split('_')[0])
    .filter(Boolean);

  if (productIds.length === 0) {
    return {
      api_version: API_VERSION,
      current_page: 1,
      total: 0,
      max_pages: 1,
      products: [],
    };
  }

  const { default: mongoose } = await import('mongoose');
  const objectIds = productIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const products = await ProductModel.find({ _id: { $in: objectIds } })
    .lean()
    .exec();

  // Reuse the same formatting logic
  const slugs = products.map((p) => p.slug).filter(Boolean) as string[];
  return getProductsByUrls(
    slugs.map((s) => getProductPageUrl(s, baseUrl)),
    baseUrl,
    now
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();

  // Validate JWT token
  const token = req.headers.get('X-Torob-Token');
  const tokenVersion = req.headers.get('X-Torob-Token-Version');

  if (!token) {
    return NextResponse.json({ error: 'Missing X-Torob-Token header' }, { status: 401 });
  }

  if (!(await validateToken(token))) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const baseUrl = resolveSiteBaseUrl();
  const now = new Date();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Option 1: Fetch by page_urls
  if (body.page_urls && Array.isArray(body.page_urls) && body.page_urls.length > 0) {
    const result = await getProductsByUrls(body.page_urls as string[], baseUrl, now);
    return NextResponse.json(result);
  }

  // Option 2: Fetch by page_uniques
  if (body.page_uniques && Array.isArray(body.page_uniques) && body.page_uniques.length > 0) {
    const result = await getProductsByUniques(body.page_uniques as string[], baseUrl, now);
    return NextResponse.json(result);
  }

  // Option 3: Fetch paginated list
  if (body.page !== undefined && body.sort) {
    const page = typeof body.page === 'number' && body.page > 0 ? Math.floor(body.page) : 1;
    const sort = typeof body.sort === 'string' ? body.sort : 'date_added_desc';

    if (!['date_added_desc', 'date_updated_desc'].includes(sort)) {
      return NextResponse.json({ error: 'Invalid sort parameter' }, { status: 400 });
    }

    const result = await getProductsByPage(page, sort, baseUrl, now);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
}
