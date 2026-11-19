import BslVariantModel from "@/basalaam/models/variants";
import { bslGetVendorStatus } from "@/basalaam/services/auth";
import { bslVariantSkuUpdate, bslVariantUpdate } from "@/basalaam/services/updateVarinat";
import ProductModel from "@/catalog/models/Product";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { getVendors } from "@/settings/services/vendorService";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const vendors = await getVendors("basalaam");
    const response: Record<string, any> = {};

    for (let index = 0; index < vendors.length; index++) {
        const vendorId = vendors[index];
        try {
            response[vendorId] = await bslGetVendorStatus(vendorId);
        } catch (err: any) {
            response[vendorId] = { status: "خطا", desc: err?.message || "خطا در بررسی وضعیت" };
        }
    }
    return NextResponse.json(response);
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return jsonError(400, 'Invalid JSON body');
    }

    const vendorId = typeof payload?.vendorId === "string" ? payload.vendorId.trim() : "";
    const barcode = typeof payload?.barcode === "string" ? payload.barcode.trim() : "";
    const bslProductId = Number(payload?.product_id);
    const bslVariantIdRaw = Number(payload?.variant_id);
    const bslVariantId = Number.isFinite(bslVariantIdRaw) && bslVariantIdRaw > 0 ? bslVariantIdRaw : null;

    if (!vendorId || !barcode || !Number.isFinite(bslProductId) || bslProductId <= 0) {
        return jsonError(400, 'Invalid payload');
    }

    try {
        // Update BSL API sku — non-critical; DB link is updated regardless
        try {
            await bslVariantSkuUpdate(vendorId, barcode, bslProductId, bslVariantId ?? 0);
        } catch (bslErr: any) {
            console.warn("[BSL link] bslVariantSkuUpdate failed (non-fatal):", bslErr?.message);
        }

        const product = await ProductModel.findOne({
            $or: [
                { "variants.barcode": barcode },
                { "variants.sku": barcode },
            ],
        }).select({ variants: 1 }).exec();

        const matchedVariant = product?.variants.find((variant) => variant.barcode === barcode || variant.sku === barcode);
        const siteStock = Math.max(0, Number(matchedVariant?.inventory?.quantity ?? 0) || 0);

        await BslVariantModel.updateOne(
            {
                vendorId,
                bslProductId,
                ...(bslVariantId === null ? { bslVariantId: null } : { bslVariantId }),
            },
            {
                $set: {
                    barcode,
                    sku: barcode,
                    ...(product?._id ? { productId: product._id } : {}),
                    ...(matchedVariant?._id ? { variantId: matchedVariant._id } : {}),
                    quantity: siteStock,
                },
            },
            { upsert: true },
        );

        if (matchedVariant?._id) {
            await bslVariantUpdate(vendorId, barcode, siteStock);
        }

        return NextResponse.json({ status: "ok", synced: Boolean(matchedVariant?._id), siteStock });
    } catch (err: any) {
        const status = err?.code === "BSL_TOKEN_NOT_FOUND" ? 401 : (err?.status || 500);
        return NextResponse.json({ error: err?.message || "خطا در به‌روزرسانی" }, { status });
    }
}
