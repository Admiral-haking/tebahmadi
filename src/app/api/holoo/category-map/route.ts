import { NextRequest, NextResponse } from "next/server";

import ProductTypeModel from "@/catalog/models/ProductType";
import { HOLOO_CONNECTION_ID } from "@/holoo/constants/config";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService";

export const runtime = "nodejs";

const KEY = "config:category_map";

/**
 * GET — the store's product types plus the current productType→Holoo side-group
 * map used when auto-creating products during invoice sync.
 */
export async function GET(): Promise<NextResponse> {
    await connectMongoose();
    const [types, cfg] = await Promise.all([
        ProductTypeModel.find({}, { name: 1 }).sort({ name: 1 }).lean(),
        getServiceInfo<Record<string, string>>("holoo", KEY, HOLOO_CONNECTION_ID),
    ]);
    return NextResponse.json({
        types: (types as Array<{ _id: unknown; name?: string }>).map((t) => ({ id: String(t._id), name: t.name || "—" })),
        map: cfg || {},
    });
}

/** POST { map } (full) or { productTypeId, erpcode } (single) — save the mapping. */
export async function POST(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }

    const current = (await getServiceInfo<Record<string, string>>("holoo", KEY, HOLOO_CONNECTION_ID)) || {};
    let next: Record<string, string> = { ...current };

    if (body?.map && typeof body.map === "object") {
        next = {};
        for (const [k, v] of Object.entries(body.map as Record<string, unknown>)) {
            if (v) next[k] = String(v);
        }
    } else if (body?.productTypeId) {
        const id = String(body.productTypeId);
        const erp = String(body?.erpcode ?? "").trim();
        if (erp) next[id] = erp;
        else delete next[id];
    } else {
        return jsonError(400, "map یا productTypeId لازم است");
    }

    await setServiceInfo("holoo", KEY, HOLOO_CONNECTION_ID, next);
    return NextResponse.json({ ok: true, map: next });
}
