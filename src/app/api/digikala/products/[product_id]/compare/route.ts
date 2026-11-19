import ProductModel from "@/catalog/models/Product";
import DgkVariantModel from "@/digikala/models/variants";
import { dgkGetProductVariants } from "@/digikala/services/products";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ product_id: string }> };

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^$\{}()|[\]\\]/g, "\\$&");
}

function buildDgkSlugPattern(productId: string): RegExp {
    return new RegExp("^" + escapeRegex(productId) + "(?:-|$)", "i");
}

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const { product_id } = await context.params;

    await connectMongoose();

    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');

    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    const dgkProductId = Number(product_id);
    if (!Number.isFinite(dgkProductId)) {
        return NextResponse.json({ error: "Invalid product_id" }, { status: 400 });
    }

    try {
    const [dgkVariants, mappedRow] = await Promise.all([
        dgkGetProductVariants(vendorId, product_id),
        DgkVariantModel.findOne(
            { vendorId, dgkProductId, productId: { $ne: null } },
            { productId: 1 },
        ).lean(),
    ]);

    let product = mappedRow?.productId
        ? await ProductModel.findById(mappedRow.productId).lean()
        : null;

    if (!product) {
        product = await ProductModel.findOne({ slug: buildDgkSlugPattern(product_id) }).lean();
    }

    if (!product) {
        return NextResponse.json({
            product: null,
            variants: dgkVariants.data.items.map((item) => ({ ...item, exists: false })),
            missingCount: dgkVariants.data.items.length
        });
    }

    const localCodes = new Set<string>();
    for (const variant of product.variants || []) {
        if (variant.barcode) localCodes.add(variant.barcode);
        if (variant.sku) localCodes.add(variant.sku);
    }

    const dgkVariantIds = dgkVariants.data.items.map((item) => item.product_variant_id);
    const serviceVariants = await DgkVariantModel.find(
        {
            vendorId,
            dgkProductId,
            dgkVariantId: { $in: dgkVariantIds },
        },
        { dgkVariantId: 1, variantId: 1, productId: 1 },
    ).lean();

    const serviceVariantMap = new Map<number, { variantId?: unknown; productId?: unknown }>();
    serviceVariants.forEach((item) => {
        serviceVariantMap.set(Number(item.dgkVariantId), {
            variantId: item.variantId,
            productId: item.productId,
        });
    });

    const variants = dgkVariants.data.items.map((item) => {
        const directMatch = Boolean(
            (item.supplier_code && localCodes.has(item.supplier_code)) ||
            localCodes.has(String(item.product_variant_id)),
        );

        const serviceVariant = serviceVariantMap.get(Number(item.product_variant_id));
        const existsByService = Boolean(
            serviceVariant?.variantId &&
            String(serviceVariant.productId ?? "") === String(product._id),
        );

        return { ...item, exists: directMatch || existsByService };
    });

    return NextResponse.json({
        product: {
            id: product._id?.toString(),
            title: product.title,
            slug: product.slug,
            productTypeId: product.productTypeId?.toString(),
            variantCount: product.variants?.length || 0
        },
        variants,
        missingCount: variants.filter((item) => !item.exists).length
    });
    } catch (error: any) {
        logErrorLater({
            category: "marketplace",
            source: "digikala.products.compare",
            error,
            route: req.nextUrl.pathname,
            method: req.method,
            metadata: { vendorId, productId: product_id, status: error?.status },
        });
        const status = error?.status === 429 ? 429 : (error?.status || 502);
        const message = status === 429
            ? "محدودیت تعداد درخواست دیجی‌کالا — کمی بعد دوباره تلاش کنید"
            : "خطا در دریافت واریانت‌های دیجی‌کالا برای مقایسه";
        return NextResponse.json({ error: message }, { status });
    }
}
