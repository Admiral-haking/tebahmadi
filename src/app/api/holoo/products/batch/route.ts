import { NextRequest, NextResponse } from "next/server";

import { batchSyncProductsToHoloo, type HolooBatchProductItem } from "@/holoo";
import { holooVariantName } from "@/holoo/services/variant-name";
import { holooErrorResponse } from "@/holoo/http";
import { jsonError } from "@/lib/http";
import ProductModel from "@/catalog/models/Product";
import { connectMongoose } from "@/lib/mongoose";

export const runtime = "nodejs";

/** Site price (toman) → Holoo price (rial). */
const toRial = (toman: number) => Math.round((Number(toman) || 0) * 10);

/**
 * POST /api/holoo/products/batch — push site products to Holoo in bulk.
 *
 * Body (all optional):
 *   { items: [{ ref, barcode, name, sellprice }] }  — explicit list (sellprice in ریال), or
 *   { status?: "active"|"draft"|"archived", limit?, skip? }  — pull from the
 *     catalog (default: active products with a barcode), converting price to ریال.
 *
 * Each product is processed independently with retry on transient (429/5xx)
 * errors; the response carries a per-item report so one failure never aborts
 * the rest.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        body = {};
    }

    try {
        await connectMongoose();

        let items: HolooBatchProductItem[];

        if (Array.isArray(body?.items) && body.items.length > 0) {
            items = body.items.map((it: any) => ({
                ref: String(it?.ref ?? it?.barcode ?? ""),
                barcode: String(it?.barcode ?? "").trim(),
                name: String(it?.name ?? "").trim(),
                sellprice: Number(it?.sellprice) || undefined,
                few: it?.few !== undefined ? Number(it.few) || 0 : undefined,
                erpcode: it?.erpcode ? String(it.erpcode).trim() : undefined,
            }));
        } else {
            // Pull from the catalog. Only variants with a barcode can be synced.
            // status="all" (default) syncs every product regardless of publish
            // state — drafts/archived can still appear in old invoices, so Holoo
            // needs them to exist.
            const statusRaw = String(body?.status ?? "all");
            const statusFilter = ["active", "draft", "archived"].includes(statusRaw)
                ? { status: statusRaw }
                : {};
            const limit = Math.min(5000, Math.max(1, Number(body?.limit) || 500));
            const skip = Math.max(0, Number(body?.skip) || 0);

            const products = await ProductModel.find(
                { ...statusFilter, "variants.barcode": { $exists: true, $ne: "" } },
                { title: 1, "variants.barcode": 1, "variants.sku": 1, "variants.price": 1, "variants.active": 1, "variants.inventory": 1, "variants.attributeValues": 1 },
            )
                .skip(skip)
                .limit(limit)
                .lean();

            items = [];
            for (const p of products as any[]) {
                for (const v of p.variants ?? []) {
                    const barcode = String(v?.barcode ?? "").trim();
                    // Include inactive variants too: they have a barcode and can
                    // appear in invoices, so Holoo needs the product to exist.
                    if (!barcode) continue;
                    items.push({
                        ref: String(v?.sku ?? barcode),
                        barcode,
                        // Unique per variant (title + size/color) so Holoo doesn't
                        // reject same-named variants of a multi-variant product.
                        name: holooVariantName(String(p?.title ?? ""), v),
                        sellprice: toRial(Number(v?.price?.amount ?? 0)),
                        few: Math.max(0, Number(v?.inventory?.quantity ?? 0) || 0),
                    });
                }
            }
        }

        if (items.length === 0) {
            return jsonError(400, "هیچ کالایی برای ارسال یافت نشد (کالای فعال با بارکد لازم است)");
        }

        const report = await batchSyncProductsToHoloo(items);
        return NextResponse.json(report);
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
