import { NextRequest, NextResponse } from "next/server";

import { listHolooProducts } from "@/holoo";
import { HOLOO_CONNECTION_ID } from "@/holoo/constants/config";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import ProductModel from "@/catalog/models/Product";
import ServiceInfoModel from "@/settings/models/serviceInfo";

export const runtime = "nodejs";

const KEY_PREFIX = "product:sku:";

/** GET — list saved SKU→Holoo ErpCode mappings. */
export async function GET(): Promise<NextResponse> {
    await connectMongoose();
    const docs = await ServiceInfoModel.find(
        { service: "holoo", id: { $regex: "^product:sku:" }, vendorId: HOLOO_CONNECTION_ID },
        { id: 1, data: 1 },
    ).lean();
    const mappings = docs.map((d) => ({
        sku: String((d as { id?: string }).id ?? "").replace(KEY_PREFIX, ""),
        erpcode: String(((d as { data?: { erpcode?: string } }).data ?? {})?.erpcode ?? ""),
    }));
    return NextResponse.json({ mappings });
}

/**
 * POST — save a mapping { sku, erpcode } OR bulk auto-map { auto: true } by
 * matching each site variant SKU against a Holoo product Code.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }

    if (body?.auto) {
        // Collect distinct site variant SKUs not yet mapped.
        const existing = await ServiceInfoModel.find(
            { service: "holoo", id: { $regex: "^product:sku:" }, vendorId: HOLOO_CONNECTION_ID },
            { id: 1 },
        ).lean();
        const mapped = new Set(existing.map((d) => String((d as { id?: string }).id ?? "").replace(KEY_PREFIX, "")));

        const products = await ProductModel.find({}, { "variants.sku": 1, "variants.barcode": 1 }).limit(2000).lean();
        // Candidate (sku → barcode) pairs for variants not yet mapped. The Holoo
        // product Code is the variant's BARCODE (not the site SKU), so we must
        // look Holoo up by barcode — looking up by SKU always returns "not found".
        const candidates: Array<{ sku: string; barcode: string }> = [];
        const seen = new Set<string>();
        for (const p of products as Array<{ variants?: Array<{ sku?: string; barcode?: string }> }>) {
            for (const v of p.variants ?? []) {
                const sku = String(v.sku ?? "").trim();
                const barcode = String(v.barcode ?? "").trim();
                if (!sku || !barcode || mapped.has(sku) || seen.has(sku)) continue;
                seen.add(sku);
                candidates.push({ sku, barcode });
            }
        }

        let matched = 0;
        let checked = 0;
        let errors = 0;
        let notFound = 0;
        let lastError: string | undefined;
        const MAX = 60; // bounded per call to stay under the HTTP timeout
        for (const { sku, barcode } of candidates) {
            if (checked >= MAX) break;
            checked += 1;
            try {
                const found = await listHolooProducts({ code: barcode });
                const erpcode = found.find((p) => p.ErpCode)?.ErpCode;
                if (erpcode) {
                    await ServiceInfoModel.updateOne(
                        { service: "holoo", id: `${KEY_PREFIX}${sku}`, vendorId: HOLOO_CONNECTION_ID },
                        { $set: { data: { erpcode } } },
                        { upsert: true },
                    );
                    matched += 1;
                } else {
                    notFound += 1; // Holoo has no product with this barcode yet
                }
            } catch (err) {
                errors += 1;
                lastError = (err as { message?: string })?.message || String(err);
            }
        }

        // Surface why a run matched nothing instead of silently returning 0.
        // - all errors  → likely auth/config/connectivity, not a data problem.
        // - all not-found → the products simply don't exist in Holoo yet
        //   (create them first via «ارسال گروهی کالا»), or their Holoo code is
        //   the barcode, not the SKU.
        let note: string | undefined;
        if (matched === 0 && checked > 0) {
            if (errors === checked) {
                note = `هیچ کالایی بررسی نشد چون همه فراخوانی‌ها خطا دادند${lastError ? `: ${lastError}` : ""}. اتصال/احراز هویت هلو را بررسی کنید.`;
            } else if (notFound > 0) {
                note = "این کدها در هلو پیدا نشدند. احتمالاً کالاها هنوز در هلو ساخته نشده‌اند — ابتدا با «ارسال گروهی کالا به هلو» آن‌ها را بسازید.";
            }
        }

        return NextResponse.json({
            ok: true,
            checked,
            matched,
            notFound,
            errors,
            remaining: Math.max(0, candidates.length - checked),
            ...(note ? { note } : {}),
        });
    }

    const sku = String(body?.sku ?? "").trim();
    const erpcode = String(body?.erpcode ?? "").trim();
    if (!sku || !erpcode) return jsonError(400, "sku و erpcode الزامی است");

    await ServiceInfoModel.updateOne(
        { service: "holoo", id: `${KEY_PREFIX}${sku}`, vendorId: HOLOO_CONNECTION_ID },
        { $set: { data: { erpcode } } },
        { upsert: true },
    );
    return NextResponse.json({ ok: true, sku, erpcode });
}

/** DELETE — remove a mapping by ?sku=. */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const sku = (req.nextUrl.searchParams.get("sku") || "").trim();
    if (!sku) return jsonError(400, "sku الزامی است");
    await ServiceInfoModel.deleteOne({ service: "holoo", id: `${KEY_PREFIX}${sku}`, vendorId: HOLOO_CONNECTION_ID });
    return NextResponse.json({ ok: true });
}
