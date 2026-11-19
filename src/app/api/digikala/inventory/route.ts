import { getDgkInventory } from "@/digikala/services/inventory";
import { updateDgkVariantStockById } from "@/digikala/services/veriant-update";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {

    await connectMongoose();

    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');
    const pageParam = url.searchParams.get('page');

    const page = pageParam ? Number(pageParam) : 1
    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    try {
        const res = await getDgkInventory(vendorId, page);

        const response = NextResponse.json(res);
        response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
        return response;
    } catch (err) {
        console.error("Failed to load Digikala inventory", { vendorId, page }, err);
        logErrorLater({
            category: "marketplace",
            source: "digikala.inventory",
            error: err,
            statusCode: 502,
            route: req.nextUrl.pathname,
            method: req.method,
            metadata: { vendorId, page },
        });
        return jsonError(502, "Digikala inventory could not be loaded");
    }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    let payload: { vendorId?: string; dgkVariantId?: number; stock?: number };
    try {
        payload = await req.json();
    } catch {
        return jsonError(400, "Invalid JSON body");
    }

    const vendorId = typeof payload.vendorId === "string" ? payload.vendorId.trim() : "";
    const dgkVariantId = Number(payload.dgkVariantId);
    const stock = Number(payload.stock);

    if (!vendorId) return jsonError(400, "vendorId is needed");
    if (!Number.isFinite(dgkVariantId) || dgkVariantId <= 0) return jsonError(400, "dgkVariantId is needed");
    if (!Number.isFinite(stock) || stock < 0) return jsonError(400, "stock is invalid");

    try {
        const result = await updateDgkVariantStockById(vendorId, Math.floor(dgkVariantId), Math.floor(stock));
        return NextResponse.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update Digikala stock";
        logErrorLater({
            category: "marketplace",
            source: "digikala.inventory.update",
            error: err,
            statusCode: 400,
            route: req.nextUrl.pathname,
            method: req.method,
            metadata: { vendorId, dgkVariantId, stock },
        });
        return jsonError(400, message);
    }
}
