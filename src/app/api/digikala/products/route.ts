import ProductModel from "@/catalog/models/Product";
import DgkVariantModel from "@/digikala/models/variants";
import { dgkGetProducts, type DgkProductsResponse } from "@/digikala/services/products";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

type MatchedProduct = {
    id: string;
    title: string;
    slug: string;
};

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^$\{}()|[\]\\]/g, "\\$&");
}

function buildDgkSlugPattern(productId: number): RegExp {
    return new RegExp("^" + escapeRegex(String(productId)) + "(?:-|$)", "i");
}

function normalizeSearch(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

async function buildLocalProductsFallback(vendorId: string, page: number, searchTerm: string): Promise<DgkProductsResponse> {
    const limit = 50;
    const skip = (page - 1) * limit;
    const cleanSearch = normalizeSearch(searchTerm);
    const safeSearch = cleanSearch ? escapeRegex(cleanSearch) : "";
    const searchMatch = safeSearch
        ? {
            $or: [
                { displayName: { $regex: safeSearch, $options: "i" } },
                { barcode: { $regex: safeSearch, $options: "i" } },
                { dgkVariantIdText: { $regex: safeSearch, $options: "i" } },
                { dgkProductIdText: { $regex: safeSearch, $options: "i" } },
            ],
        }
        : {};

    const basePipeline = [
        { $match: { vendorId } },
        {
            $addFields: {
                dgkProductIdText: { $toString: "$dgkProductId" },
                dgkVariantIdText: { $toString: "$dgkVariantId" },
            },
        },
        ...(safeSearch ? [{ $match: searchMatch }] : []),
        {
            $group: {
                _id: "$dgkProductId",
                title: { $first: "$displayName" },
                variants_count: { $sum: 1 },
                active: { $max: { $gt: ["$quantity", 0] } },
                updatedAt: { $max: "$updatedAt" },
                // Keep a linked site-product id so we can resolve a thumbnail —
                // the DGK variant model itself stores no image.
                productObjectId: { $first: "$productId" },
            },
        },
    ];

    const [items, countResult] = await Promise.all([
        DgkVariantModel.aggregate([
            ...basePipeline,
            { $sort: { updatedAt: -1, _id: -1 } },
            { $skip: skip },
            { $limit: limit },
        ]),
        DgkVariantModel.aggregate([
            ...basePipeline,
            { $count: "total" },
        ]),
    ]);

    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Resolve a thumbnail per product from the linked site product's variant
    // media (DGK variants carry no image). Maps site-product _id -> media id.
    const productObjectIds = items
        .map((item) => item.productObjectId)
        .filter((id): id is NonNullable<typeof id> => Boolean(id));
    const imageByProductId = new Map<string, string>();
    if (productObjectIds.length) {
        const linked = await ProductModel.find(
            { _id: { $in: productObjectIds } },
            { mediaIds: 1, "variants.mediaIds": 1 },
        ).lean();
        for (const prod of linked) {
            const productMedia = (prod as { mediaIds?: unknown[] })?.mediaIds;
            const variants = (prod as { variants?: Array<{ mediaIds?: unknown[] }> })?.variants ?? [];
            const firstVariantMedia = variants.find((v) => Array.isArray(v?.mediaIds) && v.mediaIds.length)?.mediaIds;
            const mediaId = (Array.isArray(firstVariantMedia) && firstVariantMedia[0])
                || (Array.isArray(productMedia) && productMedia[0]);
            if (mediaId) imageByProductId.set(String((prod as { _id: unknown })._id), `/api/media/${String(mediaId)}`);
        }
    }

    return {
        status: "local_fallback",
        data: {
            sort_data: {
                sort_column: "updatedAt",
                sort_order: "desc",
                sort_columns: [],
            },
            pager: {
                page,
                item_per_page: limit,
                total_pages: totalPages,
                total_rows: total,
            },
            form_data: {
                moderation_status: "",
            },
            items: items.map((item) => {
                const productId = Number(item._id);
                const title = String(item.title ?? `کالای دیجی‌کالا ${productId}`);
                const localImage = item.productObjectId
                    ? imageByProductId.get(String(item.productObjectId))
                    : undefined;
                return {
                    variants_count: Number(item.variants_count ?? 0),
                    site: "digikala",
                    title,
                    status: "local_fallback",
                    product_id: productId,
                    fake: false,
                    status_data: "local_fallback",
                    is_owner: false,
                    main_category_title: {},
                    active: Boolean(item.active),
                    title_fa: title,
                    title_en: "",
                    brand_id: 0,
                    brand_title_en: "",
                    brand_title_fa: "",
                    product_url: productId ? `https://www.digikala.com/product/dkp-${productId}` : "",
                    image_src: localImage ?? item.image_src ?? "/placeholder.jpg",
                    dimension_level: "",
                    brand_title: "",
                    moderation_status: {
                        title: "اطلاعات محلی",
                        status: "local_fallback",
                        duplicate: null,
                        link: null,
                    },
                    adverge_url: null,
                    product_dimension: {
                        width: 0,
                        length: 0,
                        height: 0,
                        weight: 0,
                    },
                    tags: [],
                    demand_count: 0,
                    isMatch: false,
                    matchedProduct: null,
                    importEligibility: null,
                };
            }),
            meta_data: {
                filters: [],
                filtered: {
                    moderation_status: {},
                },
            },
            rate_limit: {
                max: 0,
                current: 0,
                resetTime: {
                    date: new Date().toISOString(),
                    timezone_type: 3,
                    timezone: "Asia/Tehran",
                },
            },
        },
    };
}

async function attachLocalMatches(res: DgkProductsResponse, vendorId: string) {
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];

    const dgkProductIds = Array.from(
        new Set(
            items
                .map((item) => Number(item.product_id))
                .filter((id) => Number.isFinite(id)),
        ),
    ) as number[];

    const serviceLinks = dgkProductIds.length
        ? await DgkVariantModel.find(
            {
                vendorId,
                dgkProductId: { $in: dgkProductIds },
                productId: { $ne: null },
            },
            { dgkProductId: 1, productId: 1 },
        ).lean()
        : [];

    const productIdsFromLinks = Array.from(
        new Set(
            serviceLinks
                .map((item) => (item.productId ? String(item.productId) : ""))
                .filter(Boolean),
        ),
    );

    const linkedProducts = productIdsFromLinks.length
        ? await ProductModel.find(
            { _id: { $in: productIdsFromLinks } },
            { title: 1, slug: 1 },
        ).lean()
        : [];

    const linkedProductMap = new Map(
        linkedProducts.map((item) => [
            String(item._id),
            {
                id: String(item._id),
                title: String(item.title ?? ""),
                slug: String(item.slug ?? ""),
            } satisfies MatchedProduct,
        ]),
    );

    const matchedByDgkProductId = new Map<number, MatchedProduct>();
    serviceLinks.forEach((item) => {
        const dgkProductId = Number(item.dgkProductId);
        if (!Number.isFinite(dgkProductId) || matchedByDgkProductId.has(dgkProductId)) return;
        const productId = item.productId ? String(item.productId) : "";
        const matched = linkedProductMap.get(productId);
        if (matched) {
            matchedByDgkProductId.set(dgkProductId, matched);
        }
    });

    const unresolvedProductIds = dgkProductIds.filter((id) => !matchedByDgkProductId.has(id));
    if (unresolvedProductIds.length) {
        const slugQuery = unresolvedProductIds.map((id) => ({ slug: buildDgkSlugPattern(id) }));
        const fallbackProducts = await ProductModel.find(
            { $or: slugQuery },
            { title: 1, slug: 1 },
        ).lean();

        unresolvedProductIds.forEach((id) => {
            const regex = buildDgkSlugPattern(id);
            const matched = fallbackProducts.find((product) => regex.test(String(product.slug ?? "")));
            if (!matched) return;
            matchedByDgkProductId.set(id, {
                id: String(matched._id),
                title: String(matched.title ?? ""),
                slug: String(matched.slug ?? ""),
            });
        });
    }

    res.data.items = items.map((item) => {
        const matchedProduct = matchedByDgkProductId.get(Number(item.product_id));
        return {
            ...item,
            isMatch: Boolean(matchedProduct),
            matchedProduct: matchedProduct ?? null,
            importEligibility: null,
        };
    });

    return res;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');
    const pageParam = url.searchParams.get('page');
    const searchTerm = (url.searchParams.get('q') ?? url.searchParams.get('search') ?? "").trim();

    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    const page = pageParam ? Number(pageParam) : 1;
    if (!Number.isFinite(page) || page < 1) {
        return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }

    let res: DgkProductsResponse;
    let usedFallback = false;

    // When a search term is provided, search locally in this vendor's products only
    // instead of sending to Digikala API (which searches globally across all sellers).
    if (searchTerm) {
        res = await buildLocalProductsFallback(vendorId, Math.floor(page), searchTerm);
        usedFallback = true;
    } else {
        try {
            res = await dgkGetProducts(vendorId, Math.floor(page), searchTerm);
        } catch (error) {
            console.error("Failed to load Digikala products", { vendorId, page, searchTerm }, error);
            logErrorLater({
                category: "marketplace",
                source: "digikala.products",
                error,
                statusCode: 502,
                route: req.nextUrl.pathname,
                method: req.method,
                metadata: { vendorId, page, searchTerm },
            });
            res = await buildLocalProductsFallback(vendorId, Math.floor(page), searchTerm);
            usedFallback = true;
        }
    }

    const hydrated = await attachLocalMatches(res, vendorId);
    const response = NextResponse.json({
        ...hydrated,
        meta: {
            ...(hydrated as DgkProductsResponse & { meta?: Record<string, unknown> }).meta,
            source: usedFallback ? "local" : "digikala",
        },
    });
    response.headers.set("Cache-Control", searchTerm ? "private, max-age=20, stale-while-revalidate=40" : "private, max-age=45, stale-while-revalidate=90");
    return response;
}
