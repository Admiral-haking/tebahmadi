import ProductModel from "@/catalog/models/Product";
import { updateProduct } from "@/catalog/services/productService";
import DgkVariantModel from "@/digikala/models/variants";
import { connectMongoose } from "@/lib/mongoose";
import { syncServiceStock } from "@/sync/service-stock";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ product_id: string }> };

type VariantFormValue = {
    sku?: string;
    active?: boolean;
    priceModel?: 'fixed' | 'per_unit';
    priceAmount?: number;
    priceUnit?: string;
    inventoryTracking?: string;
    inventoryQuantity?: number;
    inventoryLowStock?: number;
    minimumOrderQuantity?: number;
    maximumOrderQuantity?: number;
    barcode?: string;
    offerEnabled?: boolean;
    offerAmount?: number;
    offerStartsAt?: string;
    offerEndsAt?: string;
    offerLabel?: string;
    mediaIds?: string[];
    attributeValues?: Record<string, unknown>;
};

type DgkVariantInput = {
    product_variant_id: number;
    product_id: number;
    supplier_code?: string;
    marketplace_seller_stock?: number;
    price_sale?: number;
    title?: string;
};

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^$\{}()|[\]\\]/g, "\$&");
}

function buildDgkSlugPattern(productId: string): RegExp {
    return new RegExp("^" + escapeRegex(productId) + "(?:-|$)", "i");
}

function attributeRecordToArray(record?: Record<string, unknown>) {
    return Object.entries(record || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => ({ key, value }));
}

function formVariantToPayload(variant: VariantFormValue) {
    const offerEnabled = Boolean(variant.offerEnabled);
    const offer = offerEnabled
        ? {
            amount: variant.offerAmount ?? 0,
            startsAt: variant.offerStartsAt || undefined,
            endsAt: variant.offerEndsAt || undefined,
            label: variant.offerLabel || undefined
        }
        : undefined;

    return {
        sku: `${variant.sku || ''}`.trim(),
        attributeValues: attributeRecordToArray(variant.attributeValues),
        price: {
            model: variant.priceModel || 'fixed',
            amount: variant.priceAmount ?? 0,
            unitOfMeasure: variant.priceUnit || undefined
        },
        inventory: {
            trackingUnit: variant.inventoryTracking || 'unit',
            quantity: variant.inventoryQuantity ?? 0,
            lowStockThreshold: variant.inventoryLowStock
        },
        minimumOrderQuantity: variant.minimumOrderQuantity,
        maximumOrderQuantity: variant.maximumOrderQuantity,
        barcode: variant.barcode?.trim() || undefined,
        mediaIds: Array.isArray(variant.mediaIds) && variant.mediaIds.length ? variant.mediaIds : undefined,
        offer,
        active: variant.active ?? true
    };
}

function existingVariantToPayload(variant: any) {
    return {
        sku: variant.sku,
        attributeValues: variant.attributeValues || [],
        price: variant.price,
        offer: variant.offer,
        inventory: variant.inventory,
        minimumOrderQuantity: variant.minimumOrderQuantity,
        maximumOrderQuantity: variant.maximumOrderQuantity,
        barcode: variant.barcode,
        mediaIds: Array.isArray(variant.mediaIds) ? variant.mediaIds.map((id: unknown) => `${id}`) : undefined,
        active: variant.active ?? true
    };
}

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const { product_id } = await context.params;

    await connectMongoose();

    let body: { vendorId?: string; variants?: VariantFormValue[]; dgkVariants?: DgkVariantInput[] };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });
    if (!Array.isArray(body.variants) || !body.variants.length) {
        return NextResponse.json({ error: "variants is needed" }, { status: 400 });
    }

    const dgkProductId = Number(product_id);
    if (!Number.isFinite(dgkProductId)) {
        return NextResponse.json({ error: "Invalid product_id" }, { status: 400 });
    }

    const mappedRow = await DgkVariantModel.findOne(
        { vendorId: body.vendorId, dgkProductId, productId: { $ne: null } },
        { productId: 1 },
    ).lean();

    let product = mappedRow?.productId
        ? await ProductModel.findById(mappedRow.productId)
        : null;

    if (!product) {
        product = await ProductModel.findOne({ slug: buildDgkSlugPattern(product_id) });
    }

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const existingKeys = new Set<string>();
    for (const variant of product.variants || []) {
        if (variant.barcode) existingKeys.add(variant.barcode);
        if (variant.sku) existingKeys.add(variant.sku);
    }

    const newVariants = body.variants
        .map(formVariantToPayload)
        .filter((variant) => variant.sku)
        .filter((variant) => {
            const keys = [variant.sku, variant.barcode].filter(Boolean) as string[];
            if (keys.some((key) => existingKeys.has(key))) return false;
            keys.forEach((key) => existingKeys.add(key));
            return true;
        });

    if (!newVariants.length) {
        return NextResponse.json({ error: "No new variants to import" }, { status: 400 });
    }

    const payload = {
        productTypeId: product.productTypeId.toString(),
        title: product.title,
        slug: product.slug,
        description: product.description,
        brand: product.brand,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        status: product.status,
        showInCart: product.showInCart,
        attributeValues: product.attributeValues || [],
        categories: (product.categories || []).map((id) => id.toString()),
        variants: [
            ...(product.variants || []).map(existingVariantToPayload),
            ...newVariants
        ]
    };

    const updated = await updateProduct(product._id.toString(), payload);
    if (!updated) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const importedVariants = updated.variants.filter((variant) =>
        newVariants.some((item) => item.sku === variant.sku || item.barcode === variant.barcode)
    );

    await Promise.all(importedVariants.map((variant) => {
        const dgkVariant = body.dgkVariants?.find((item) =>
            item.supplier_code === variant.barcode ||
            `${item.product_variant_id}` === variant.sku
        );

        if (!dgkVariant) return Promise.resolve();

        return DgkVariantModel.updateOne(
            {
                vendorId: body.vendorId,
                dgkProductId: dgkVariant.product_id,
                dgkVariantId: dgkVariant.product_variant_id,
            },
            {
                $set: {
                    productId: updated._id,
                    variantId: variant._id,
                    barcode: variant.barcode || dgkVariant.supplier_code,
                    quantity: dgkVariant.marketplace_seller_stock || 0,
                    displayName: dgkVariant.title || updated.title,
                    vendorId: body.vendorId,
                    price: (dgkVariant.price_sale || 0) / 10
                }
            },
            { upsert: true }
        );
    }));

    const initialSyncPayload = importedVariants
        .map((variant) => ({
            barcode: typeof variant.barcode === "string" ? variant.barcode.trim() : "",
            stock: Math.max(0, Number(variant.inventory?.quantity ?? 0) || 0),
        }))
        .filter((item) => item.barcode.length > 0);

    if (initialSyncPayload.length > 0) {
        void syncServiceStock(initialSyncPayload).catch((error) => {
            console.error("Initial stock sync for imported Digikala variants failed", error);
        });
    }

    return NextResponse.json({
        product: {
            id: updated._id.toString(),
            variantCount: updated.variants.length
        },
        importedCount: importedVariants.length
    });
}
