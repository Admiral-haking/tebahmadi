import DgkOrder from "@/digikala/models/orders";
import { dgkCancelOrder } from "@/digikala/services/order-cancel";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');
    const pageParam = url.searchParams.get('page');

    const page = pageParam ? Number(pageParam) : 1;
    if (!vendorId) return jsonError(400, "vendorId is needed");

    try {
        const res = await DgkOrder.find({}, null, {
            sort: { _id: -1 },
            skip: (page - 1) * 50,
            limit: 50,
        });
        return NextResponse.json(res);
    } catch (err) {
        console.error("Failed to load local Digikala orders", { vendorId, page }, err);
        return jsonError(502, "Orders could not be loaded");
    }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {

    await connectMongoose();
    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return jsonError(400, 'Invalid JSON body');
    }
    if (!payload?.vendorId || payload?.order_item_id == null) {
        return jsonError(400, "vendorId و order_item_id لازم است");
    }
    const reasonId = Number(payload?.cancellation_reason_id);
    if (!Number.isFinite(reasonId)) {
        return jsonError(400, "دلیل لغو (cancellation_reason_id) لازم است");
    }
    const count = Math.max(1, Number(payload?.count) || 1);
    try {
        const res = await dgkCancelOrder(payload.vendorId, Number(payload.order_item_id), count, reasonId);
        return NextResponse.json(res);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'لغو سفارش ناموفق بود';
        return jsonError(400, message);
    }
}