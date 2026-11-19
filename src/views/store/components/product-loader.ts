"use server";

import ProductModel, { type ProductDocument } from "@/catalog/models/Product";
import { effectiveUnitPrice } from "@/catalog/services/productService";
import { subtreeIds } from "@/catalog/services/categoryService";
import MediaModel from "@/media/models/Media";
import { connectMongoose } from "@/lib/mongoose";
import type { ProductCardProps } from "@/components/product";
import { Types, type PipelineStage } from "mongoose";
import type { RawSearchParams } from "./search-params";

const STORE_PAGE_SIZE = 24;

type AggregatedProduct = {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  brand?: string;
  activeVariants?: VariantProjection[];
  variants?: VariantProjection[];
  attrs?: Map<string, unknown> | Record<string, unknown>;
  minPrice?: number | null;
  maxPrice?: number | null;
  minPriceMissing?: number;
  createdAt?: Date;
  primaryMediaId?: Types.ObjectId;
};

type VariantProjection = ProductDocument["variants"][number];

type SortOption = "newest" | "expensive" | "cheapest";

type LoadStoreProductsContext = {
  activeCategoryId: string;
  productTypeIds: string[];
};

function singleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parsePage(value: string | string[] | undefined): number {
  const raw = singleValue(value);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

function parseSort(value: string | string[] | undefined): SortOption {
  const raw = singleValue(value);
  if (raw === "expensive" || raw === "cheapest") {
    return raw;
  }
  return "newest";
}

function extractAttrFilters(params: RawSearchParams): Record<string, string[]> {
  const filters: Record<string, string[]> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (!key.startsWith("attr.")) {
      return;
    }
    const attrKey = key.slice(5);
    const list = Array.isArray(value) ? value : value ? [value] : [];
    const sanitized = list
      .map((item) => `${item}`.trim())
      .filter((item) => item.length > 0);
    if (sanitized.length > 0) {
      filters[attrKey] = sanitized;
    }
  });
  return filters;
}

function buildQuery(
  searchParams: RawSearchParams,
  categoryIds: Types.ObjectId[] | undefined,
  options: {
    invalidCategory?: boolean;
    productTypeIds?: Types.ObjectId[];
  } = {},
): { query: Record<string, unknown>; searchTerm?: string } {
  const baseQuery: Record<string, unknown> = {
    status: "active",
  };

  if (options.invalidCategory) {
    return { query: { ...baseQuery, _id: { $exists: false } } };
  }

  const query: Record<string, unknown> = { ...baseQuery };

  if (options.productTypeIds && options.productTypeIds.length > 0) {
    query.productTypeId =
      options.productTypeIds.length === 1
        ? options.productTypeIds[0]
        : { $in: options.productTypeIds };
  }

  if (categoryIds && categoryIds.length > 0) {
    query.categories = { $in: categoryIds };
  }

  const searchTerm = singleValue(searchParams.q)?.trim();
  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }

  const attrFilters = extractAttrFilters(searchParams);
  const andFilters: Record<string, unknown>[] = [];

  Object.entries(attrFilters).forEach(([key, values]) => {
    if (values.length === 0) {
      return;
    }
    if (key === "color") {
      andFilters.push({
        $or: [
          { "variants.colorKey": { $in: values } },
          { [`attrs.${key}`]: { $in: values } },
        ],
      });
      return;
    }
    if (key === "colorFamily") {
      andFilters.push({
        $or: [
          { "variants.colorFamily": { $in: values } },
          { [`attrs.${key}`]: { $in: values } },
        ],
      });
      return;
    }
    if (key === "size") {
      andFilters.push({
        $or: [
          values.length > 1
            ? { [`attrs.${key}`]: { $in: values } }
            : { [`attrs.${key}`]: values[0] },
          {
            variants: {
              $elemMatch: {
                active: true,
                attributeValues: {
                  $elemMatch: {
                    key,
                    value: values.length > 1 ? { $in: values } : values[0],
                  },
                },
              },
            },
          },
        ],
      });
      return;
    }
    if (values.length > 1) {
      query[`attrs.${key}`] = { $in: values };
    } else {
      [query[`attrs.${key}`]] = values;
    }
  });

  if (andFilters.length > 0) {
    query.$and = [
      ...((query.$and as Record<string, unknown>[]) ?? []),
      ...andFilters,
    ];
  }

  return { query, searchTerm };
}

// Compute stages: derive active variants, price range and inventory total, then
// drop products that have no in-stock active variants so out-of-stock items
// ("عدم موجودی") never appear in store listings.
function buildComputeStages(): PipelineStage[] {
  return [
    {
      $addFields: {
        activeVariants: {
          $filter: {
            input: "$variants",
            as: "variant",
            cond: { $eq: ["$$variant.active", true] },
          },
        },
      },
    },
    {
      $addFields: {
        minPrice: {
          $min: {
            $map: {
              input: "$activeVariants",
              as: "variant",
              in: "$$variant.price.amount",
            },
          },
        },
        maxPrice: {
          $max: {
            $map: {
              input: "$activeVariants",
              as: "variant",
              in: "$$variant.price.amount",
            },
          },
        },
        inventoryTotal: {
          $sum: {
            $map: {
              input: "$activeVariants",
              as: "variant",
              in: { $ifNull: ["$$variant.inventory.quantity", 0] },
            },
          },
        },
      },
    },
    {
      $addFields: {
        minPriceMissing: {
          $cond: [{ $ifNull: ["$minPrice", false] }, 0, 1],
        },
      },
    },
    {
      $match: { inventoryTotal: { $gt: 0 } },
    },
  ];
}

function buildSortStage(sort: SortOption, hasSearch: boolean): PipelineStage {
  if (hasSearch) {
    return {
      $sort: {
        textScore: { $meta: "textScore" },
        createdAt: -1,
      } as PipelineStage.Sort["$sort"],
    };
  }

  if (sort === "expensive") {
    return { $sort: { minPriceMissing: 1, minPrice: -1, createdAt: -1 } };
  }

  if (sort === "cheapest") {
    return { $sort: { minPriceMissing: 1, minPrice: 1, createdAt: -1 } };
  }

  return { $sort: { createdAt: -1 } };
}

function toPlainAttrs(
  value: Map<string, unknown> | Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  return value;
}

export async function formatFinalProduct(
  product: AggregatedProduct,
  mediaMap: Map<
    string,
    {
      originalId?: Types.ObjectId;
      mobileId?: Types.ObjectId;
      thumbId?: Types.ObjectId;
    }
  >,
): Promise<ProductCardProps> {
  const variants = Array.isArray(product.activeVariants)
    ? product.activeVariants
    : [];
  const now = new Date();
  let selectedFinalPrice = Number.POSITIVE_INFINITY;
  let selectedBasePrice: number | undefined;
  let selectedDiscountPercent: number | undefined;
  let inventoryTotal = 0;

  variants.forEach((variant) => {
    const basePrice = Number(variant?.price?.amount ?? Number.NaN);
    const finalPrice = effectiveUnitPrice(variant, now);
    const quantity = Number(variant?.inventory?.quantity ?? 0);
    if (!Number.isNaN(quantity)) {
      inventoryTotal += quantity;
    }
    if (Number.isNaN(basePrice)) {
      return;
    }
    if (finalPrice < selectedFinalPrice) {
      selectedFinalPrice = finalPrice;
      selectedBasePrice = basePrice;
      if (variant.offer && finalPrice < basePrice) {
        const discount = variant.offer.amount ?? 0;
        if (discount > 0 && basePrice > 0) {
          selectedDiscountPercent = Math.round((discount / basePrice) * 100);
        } else {
          selectedDiscountPercent = undefined;
        }
      } else {
        selectedDiscountPercent = undefined;
      }
    }
  });

  if (!Number.isFinite(selectedFinalPrice)) {
    selectedFinalPrice = product.minPrice ?? 0;
  }

  const attrs = toPlainAttrs(product.attrs);
  const sizesRaw = attrs.size;
  const sizes: string[] = Array.isArray(sizesRaw)
    ? sizesRaw.map((item) => `${item}`).filter((item) => item.length > 0)
    : typeof sizesRaw === "string"
      ? [sizesRaw]
      : [];

  const colorEntries = variants
    .filter(
      (variant) =>
        Array.isArray(variant.colorSwatches) &&
        variant.colorSwatches.length > 0,
    )
    .map((variant) => ({
      key: variant.colorKey ?? variant.sku,
      swatches: variant.colorSwatches ?? [],
    }));
  const uniqueColors = Array.from(
    new Map(colorEntries.map((entry) => [entry.key, entry])).values(),
  ).slice(0, 4);

  const primaryVariantWithMedia = variants.find(
    (variant) => Array.isArray(variant.mediaIds) && variant.mediaIds.length > 0,
  );
  const primaryMediaId = primaryVariantWithMedia?.mediaIds?.[0]?.toString();
  const mediaDoc = primaryMediaId ? mediaMap.get(primaryMediaId) : undefined;
  const imageId =
    mediaDoc?.thumbId ?? mediaDoc?.mobileId ?? mediaDoc?.originalId;
  const imageUrl = imageId ? `/api/media/${imageId.toString()}` : undefined;

  return {
    id: product._id.toString(),
    slug: product.slug,
    title: product.title,
    finalPrice: selectedFinalPrice,
    originalPrice:
      selectedBasePrice && selectedFinalPrice < selectedBasePrice
        ? selectedBasePrice
        : undefined,
    discountPercent: selectedDiscountPercent,
    inStock: inventoryTotal > 0,
    stockCount: inventoryTotal,
    imageUrl,
    colors: uniqueColors.map((item) => item.swatches[0]).filter(Boolean),
    sizes,
  };
}

export async function loadStoreProducts(
  searchParams: RawSearchParams,
  context: LoadStoreProductsContext,
) {
  await connectMongoose();

  const sort = parseSort(searchParams.sort);
  const page = parsePage(searchParams.page);

  const { activeCategoryId, productTypeIds } = context;
  let categoryIds: Types.ObjectId[] | undefined;
  let invalidCategory = false;
  if (Types.ObjectId.isValid(activeCategoryId)) {
    try {
      categoryIds = await subtreeIds(activeCategoryId);
    } catch {
      invalidCategory = true;
    }
  } else {
    invalidCategory = true;
  }

  const productTypeObjectIds = Array.isArray(productTypeIds)
    ? productTypeIds
        .map((id) =>
          Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null,
        )
        .filter((id): id is Types.ObjectId => id !== null)
    : [];

  const { query, searchTerm } = buildQuery(searchParams, categoryIds, {
    invalidCategory,
    productTypeIds: productTypeObjectIds,
  });
  const hasSearch = typeof searchTerm === "string" && searchTerm.length > 0;

  // Base stages shared by both the count and data queries. The inventory filter
  // lives inside the compute stages, so the total must also be computed through
  // the aggregation (countDocuments would over-count out-of-stock products).
  const baseStages: PipelineStage[] = [{ $match: query }];
  if (hasSearch) {
    baseStages.push({ $addFields: { textScore: { $meta: "textScore" } } });
  }
  baseStages.push(...buildComputeStages());

  const countResult = (await ProductModel.aggregate([
    ...baseStages,
    { $count: "total" },
  ])) as Array<{ total: number }>;
  const total = countResult[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / STORE_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pages);
  const skip = (currentPage - 1) * STORE_PAGE_SIZE;

  const pipeline: PipelineStage[] = [
    ...baseStages,
    buildSortStage(sort, hasSearch),
    { $skip: skip },
    { $limit: STORE_PAGE_SIZE },
  ];

  const aggregated = (await ProductModel.aggregate(
    pipeline,
  )) as AggregatedProduct[];

  const mediaIds = new Set<string>();
  aggregated.forEach((product) => {
    const variants = Array.isArray(product.activeVariants)
      ? product.activeVariants
      : [];
    variants.forEach((variant) => {
      if (!Array.isArray(variant.mediaIds) || variant.mediaIds.length === 0) {
        return;
      }
      const mediaId = variant.mediaIds[0];
      if (mediaId instanceof Types.ObjectId) {
        mediaIds.add(mediaId.toString());
      } else if (typeof mediaId === "string") {
        mediaIds.add(mediaId);
      }
    });
  });

  let mediaMap = new Map<
    string,
    {
      originalId?: Types.ObjectId;
      mobileId?: Types.ObjectId;
      thumbId?: Types.ObjectId;
    }
  >();
  if (mediaIds.size > 0) {
    const idsToFetch = Array.from(mediaIds)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (idsToFetch.length > 0) {
      const docs = await MediaModel.find({ _id: { $in: idsToFetch } })
        .select({ originalId: 1, mobileId: 1, thumbId: 1 })
        .lean();
      mediaMap = new Map(
        docs.map((doc) => {
          const key =
            doc._id instanceof Types.ObjectId
              ? doc._id.toString()
              : `${doc._id}`;
          return [key, doc];
        }),
      );
    }
  }

  const products: ProductCardProps[] = await Promise.all(
    aggregated.map(
      async (product) => await formatFinalProduct(product, mediaMap),
    ),
  );

  return {
    products,
    total,
    pages,
    currentPage,
    pageSize: STORE_PAGE_SIZE,
  };
}
