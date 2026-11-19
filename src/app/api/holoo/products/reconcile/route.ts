import { NextRequest, NextResponse } from "next/server";

import { listHolooProducts } from "@/holoo";
import { holooVariantName } from "@/holoo/services/variant-name";
import { holooErrorResponse } from "@/holoo/http";
import ProductModel from "@/catalog/models/Product";
import { connectMongoose } from "@/lib/mongoose";

export const runtime = "nodejs";

/** Site price (toman) → Holoo price (rial). */
const toRial = (toman: number) => Math.round((Number(toman) || 0) * 10);

type Status = "missing" | "mismatch" | "ok";

type Row = {
    ref: string; // sku
    barcode: string;
    name: string;
    status: Status;
    erpcode: string | null;
    sitePrice: number; // ریال
    holooPrice: number | null; // ریال
    siteFew: number;
    holooFew: number | null;
    diffs: string[]; // human reasons for mismatch
};

/**
 * GET /api/holoo/products/reconcile — compare site catalog against Holoo so the
 * admin can recover from a partial batch (e.g. after a 504): which products are
 * MISSING in Holoo, which have MISMATCHED price/stock, and which are OK.
 *
 * Read-only. Fixing is done by re-running the batch endpoint with the rows the
 * admin chooses (it creates missing and updates existing few/price).
 *
 * query: status (active|draft|archived, default active), limit, skip
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const sp = req.nextUrl.searchParams;
    // status="all" (default) reconciles every product regardless of publish state.
    const statusRaw = sp.get("status") || "all";
    const statusFilter = ["active", "draft", "archived"].includes(statusRaw)
        ? { status: statusRaw }
        : {};
    const limit = Math.min(10000, Math.max(1, Number(sp.get("limit")) || 2000));
    const skip = Math.max(0, Number(sp.get("skip")) || 0);

    try {
        await connectMongoose();

        // Site catalog: active variants with a barcode.
        const products = await ProductModel.find(
            { ...statusFilter, "variants.barcode": { $exists: true, $ne: "" } },
            { title: 1, "variants.barcode": 1, "variants.sku": 1, "variants.price": 1, "variants.active": 1, "variants.inventory": 1, "variants.attributeValues": 1 },
        )
            .skip(skip)
            .limit(limit)
            .lean();

        // Holoo products, mapped by accounting code (= barcode).
        const holooProducts = await listHolooProducts({});
        const holooByCode = new Map<string, { ErpCode: string; SellPrice?: string; Few?: string }>();
        for (const p of holooProducts) {
            const code = String(p.Code || "").trim();
            if (code) holooByCode.set(code, p);
        }

        const rows: Row[] = [];
        for (const p of products as any[]) {
            for (const v of p.variants ?? []) {
                const barcode = String(v?.barcode ?? "").trim();
                if (!barcode) continue; // include inactive variants (they appear in invoices)

                const sitePrice = toRial(Number(v?.price?.amount ?? 0));
                const siteFew = Math.max(0, Number(v?.inventory?.quantity ?? 0) || 0);
                const holoo = holooByCode.get(barcode);

                const name = holooVariantName(String(p?.title ?? ""), v);

                if (!holoo) {
                    rows.push({
                        ref: String(v?.sku ?? barcode), barcode, name,
                        status: "missing", erpcode: null,
                        sitePrice, holooPrice: null, siteFew, holooFew: null, diffs: ["در هلو موجود نیست"],
                    });
                    continue;
                }

                const holooPrice = Math.round(Number(holoo.SellPrice ?? 0) || 0);
                const holooFew = Math.round(Number(holoo.Few ?? 0) || 0);
                const diffs: string[] = [];
                if (holooPrice !== sitePrice) diffs.push(`قیمت: سایت ${sitePrice} / هلو ${holooPrice} (ریال)`);
                if (holooFew !== siteFew) diffs.push(`موجودی: سایت ${siteFew} / هلو ${holooFew}`);

                rows.push({
                    ref: String(v?.sku ?? barcode), barcode, name,
                    status: diffs.length ? "mismatch" : "ok", erpcode: holoo.ErpCode,
                    sitePrice, holooPrice, siteFew, holooFew, diffs,
                });
            }
        }

        const summary = {
            total: rows.length,
            missing: rows.filter((r) => r.status === "missing").length,
            mismatch: rows.filter((r) => r.status === "mismatch").length,
            ok: rows.filter((r) => r.status === "ok").length,
            holooTotal: holooByCode.size,
        };

        return NextResponse.json({ summary, rows });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
