import { NextRequest, NextResponse } from "next/server";

import ProductModel from "@/catalog/models/Product";
import {
    accountingPrefix,
    getPrefixSidegroupMap,
    listHolooSideGroups,
    setPrefixSidegroupMap,
    type PrefixSidegroupMap,
} from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";

export const runtime = "nodejs";

/**
 * Scan every variant barcode and collect the distinct accounting prefixes
 * (the part before the first "-"), with a sample barcode + count for each.
 */
async function collectPrefixes(): Promise<Array<{ prefix: string; sample: string; count: number }>> {
    const products = await ProductModel.find(
        {},
        { "variants.barcode": 1 },
    ).limit(5000).lean();

    const acc = new Map<string, { sample: string; count: number }>();
    for (const p of products as Array<{ variants?: Array<{ barcode?: string }> }>) {
        for (const v of p.variants ?? []) {
            const prefix = accountingPrefix(v.barcode);
            if (!prefix) continue;
            const cur = acc.get(prefix);
            if (cur) cur.count += 1;
            else acc.set(prefix, { sample: String(v.barcode).trim(), count: 1 });
        }
    }
    return [...acc.entries()]
        .map(([prefix, info]) => ({ prefix, ...info }))
        .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

/**
 * GET /api/holoo/prefix-map — everything the admin needs to link accounting
 * prefixes to Holoo side-groups: the side-group list, the prefixes found in the
 * catalog, and the current prefix → side-group ErpCode map.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        await connectMongoose();
        const [sideGroups, prefixes, map] = await Promise.all([
            listHolooSideGroups(),
            collectPrefixes(),
            getPrefixSidegroupMap(),
        ]);
        return NextResponse.json({ sideGroups, prefixes, map });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}

/**
 * POST — link a prefix to a side-group. Accepts either:
 *   { prefix, erpcode }  — set/clear one link
 *   { map }              — replace the whole map
 * Never creates side-groups; the admin picks from existing ones. Idempotent:
 * re-linking the same prefix→erpcode leaves the map unchanged.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }

    const current = await getPrefixSidegroupMap();
    let next: PrefixSidegroupMap = { ...current };

    if (body?.map && typeof body.map === "object") {
        next = {};
        for (const [k, v] of Object.entries(body.map as Record<string, unknown>)) {
            const erp = String(v ?? "").trim();
            if (k && erp) next[String(k).trim()] = erp;
        }
    } else if (body?.prefix) {
        const prefix = String(body.prefix).trim();
        const erp = String(body?.erpcode ?? "").trim();
        if (erp) next[prefix] = erp;
        else delete next[prefix];
    } else {
        return jsonError(400, "prefix یا map لازم است");
    }

    await setPrefixSidegroupMap(next);
    return NextResponse.json({ ok: true, map: next });
}
