import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { createProduct, listProducts } from '@/catalog/services/productService';
import { subtreeIds } from '@/catalog/services/categoryService';
import { requirePermission } from '@/lib/auth';
import ProductTypeModel from '@/catalog/models/ProductType';
import MediaModel from '@/models/Media';
import DgkVariantModel from '@/digikala/models/variants';
import { isMongoConfigured, PREVIEW_PRODUCTS } from '@/lib/preview-fallback';

export const runtime = 'nodejs';

type DgkImportVariant = {
  product_variant_id?: number | string;
  product_id?: number | string;
  supplier_code?: string;
  marketplace_seller_stock?: number;
  price_sale?: number;
  title?: string;
};

type DgkImportPayload = {
  vendorId?: string;
  productId?: number | string;
  variants?: DgkImportVariant[];
};

function extractDgkImport(payload: unknown): DgkImportPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const dgkImport = (payload as { dgkImport?: unknown }).dgkImport;
  if (!dgkImport || typeof dgkImport !== 'object') return null;

  const data = dgkImport as DgkImportPayload;
  const vendorId = typeof data.vendorId === 'string' ? data.vendorId.trim() : '';
  const variants = Array.isArray(data.variants) ? data.variants : [];
  if (!vendorId || variants.length === 0) return null;

  return { ...data, vendorId, variants };
}

async function linkDgkImportToProduct(product: any, dgkImport: DgkImportPayload | null): Promise<void> {
  if (!dgkImport?.vendorId || !Array.isArray(dgkImport.variants) || dgkImport.variants.length === 0) {
    return;
  }

  const productId = Number(dgkImport.productId);
  const localVariants = Array.isArray(product?.variants) ? product.variants : [];

  const operations = dgkImport.variants
    .map((dgkVariant, index) => {
      const dgkVariantId = Number(dgkVariant.product_variant_id);
      const dgkProductId = Number(dgkVariant.product_id ?? productId);
      if (!Number.isFinite(dgkVariantId) || !Number.isFinite(dgkProductId)) {
        return null;
      }

      const supplierCode = typeof dgkVariant.supplier_code === 'string' ? dgkVariant.supplier_code.trim() : '';
      const localVariant = localVariants.find((variant: any) => (
        (supplierCode && variant?.barcode === supplierCode) ||
        String(variant?.sku ?? '') === String(dgkVariantId)
      )) || localVariants[index];

      if (!localVariant?._id) {
        return null;
      }

      return {
        updateOne: {
          filter: { dgkVariantId },
          update: {
            $set: {
              productId: product._id,
              variantId: localVariant._id,
              barcode: supplierCode || localVariant.barcode || localVariant.sku || String(dgkVariantId),
              dgkProductId,
              quantity: Math.max(0, Number(dgkVariant.marketplace_seller_stock ?? 0) || 0),
              displayName: dgkVariant.title || product.title || String(dgkVariantId),
              vendorId: dgkImport.vendorId,
              price: Math.max(0, Number(dgkVariant.price_sale ?? 0) || 0) / 10,
            },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  if (operations.length > 0) {
    await DgkVariantModel.bulkWrite(operations as any[], { ordered: false });
  }
}


export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isMongoConfigured()) {
    const params = req.nextUrl.searchParams;
    const q = (params.get('q') ?? '').trim().toLowerCase();
    const limit = Math.max(1, Number(params.get('limit') ?? 20) || 20);
    const skip = Math.max(0, Number(params.get('skip') ?? 0) || 0);
    const filtered = PREVIEW_PRODUCTS.filter((item) => {
      if (!q) return true;
      return (
        item.card.title.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q) ||
        (item.card.variantSubtitle ?? '').toLowerCase().includes(q)
      );
    });
    const sliced = filtered.slice(skip, skip + limit).map((item) => ({
      id: item.card.id,
      title: item.card.title,
      slug: item.card.slug,
      status: 'active',
      productTypeId: item.detail.productTypeId ?? '',
      productTypeName: item.categoryName,
      variantCount: item.detail.variants.length,
      activeInStockVariantCount: item.detail.variants.length,
      inactiveOrOutOfStockVariantCount: 0,
      minPrice: item.card.finalPrice,
      maxPrice: item.card.originalPrice ?? item.card.finalPrice,
      inventoryTotal: item.card.stockCount ?? 10,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
      images: item.card.imageUrl ? [item.card.imageUrl] : [],
    }));
    return NextResponse.json({ products: sliced, total: filtered.length });
  }
  await connectMongoose();
  const params = req.nextUrl.searchParams;
  const productTypeId = params.get('productTypeId') ?? undefined;
  const categoryId = params.get('categoryId') ?? undefined;
  const q = params.get('q') ?? undefined;
  const limitParam = params.get('limit');
  const skipParam = params.get('skip');
  const limit = limitParam ? Number(limitParam) : undefined;
  const skip = skipParam ? Number(skipParam) : undefined;
  if ((limit !== undefined && Number.isNaN(limit)) || (skip !== undefined && Number.isNaN(skip))) {
    return jsonError(400, 'Invalid pagination parameters');
  }
  const statusParam = params
    .getAll('status')
    .filter((value) => ['draft', 'active', 'archived'].includes(value)) as (
      | 'draft'
      | 'active'
      | 'archived'
    )[];
  const status = statusParam.length > 0 ? statusParam : undefined;

  const attrFilters: Record<string, string | string[]> = {};
  params.forEach((value, key) => {
    if (key.startsWith('attr.')) {
      const attrKey = key.slice(5);
      const allValues = params.getAll(key);
      attrFilters[attrKey] = allValues.length > 1 ? allValues : value;
    }
  });

  let categoryIds: Types.ObjectId[] | undefined;
  if (categoryId) {
    if (!/^[0-9a-fA-F]{24}$/.test(categoryId)) {
      return jsonError(400, 'Invalid categoryId');
    }
    try {
      categoryIds = await subtreeIds(categoryId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve category subtree';
      const status = message === 'Category not found' ? 404 : 400;
      return jsonError(status, message);
    }
  }

  const result = await listProducts({
    productTypeId,
    categoryIds,
    q,
    attrFilters,
    limit,
    skip,
    status,
  });

  const serializedProducts = result.items.map((item) => item.toObject({ depopulate: true }));

  const productTypeIds = Array.from(
    new Set(
      serializedProducts
        .map((product) => product.productTypeId?.toString())
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  );

  const productTypes = productTypeIds.length
    ? await ProductTypeModel.find({ _id: { $in: productTypeIds } }, { name: 1 })
      .lean()
      .then((rows) => rows.map((row) => ({ id: row._id.toString(), name: row.name ?? '' })))
    : [];

  const productTypeMap = new Map(productTypes.map((item) => [item.id, item.name]));

  const products = serializedProducts.map((product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    let minPrice: number | undefined;
    let maxPrice: number | undefined;
    let inventoryTotal = 0;
    let activeInStockVariantCount = 0;
    let inactiveOrOutOfStockVariantCount = 0;

    variants.forEach((variant) => {
      const priceAmount = Number((variant?.price as { amount?: unknown })?.amount ?? Number.NaN);
      if (!Number.isNaN(priceAmount)) {
        if (minPrice === undefined || priceAmount < minPrice) {
          minPrice = priceAmount;
        }
        if (maxPrice === undefined || priceAmount > maxPrice) {
          maxPrice = priceAmount;
        }
      }

      const quantity = Number((variant?.inventory as { quantity?: unknown })?.quantity ?? Number.NaN);
      const safeQuantity = Number.isNaN(quantity) ? 0 : quantity;
      inventoryTotal += safeQuantity;

      if (variant?.active !== false && safeQuantity > 0) {
        activeInStockVariantCount += 1;
      } else {
        inactiveOrOutOfStockVariantCount += 1;
      }
    });

    const createdAtValue = product.createdAt;
    const updatedAtValue = product.updatedAt;

    const createdAt = createdAtValue instanceof Date ? createdAtValue.toISOString() : undefined;
    const updatedAt = updatedAtValue instanceof Date ? updatedAtValue.toISOString() : undefined;

    const productTypeIdValue = product.productTypeId?.toString() ?? '';


    const images: string[] = [];

    let i = 0;
    for (const element of product.variants) {
      if (i > 4) break;
      if (element.mediaIds?.[0]) {
        images.push(`/api/media/${element.mediaIds?.[0]}.png?type=`);
        i++;
      }
    }

    return {
      id: product._id?.toString() ?? '',
      title: product.title ?? '',
      slug: product.slug ?? '',
      status: product.status ?? 'draft',
      productTypeId: productTypeIdValue,
      productTypeName: productTypeMap.get(productTypeIdValue) ?? '-',
      variantCount: variants.length,
      activeInStockVariantCount,
      inactiveOrOutOfStockVariantCount,
      minPrice,
      maxPrice,
      inventoryTotal,
      createdAt,
      updatedAt,
      images
    };
  });

  return NextResponse.json({ products, total: result.total });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();
  await requirePermission(req, 'products:write');
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  try {
    const dgkImport = extractDgkImport(payload);
    const product = await createProduct(payload);
    await linkDgkImportToProduct(product, dgkImport);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    return jsonError(400, message);
  }
}
