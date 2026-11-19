import { getDgkPriceUpdate } from "@/digikala/services/price-update";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest): Promise<NextResponse> {

    await connectMongoose();
    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return jsonError(400, 'Invalid JSON body');
    }
    try {
        const res = await getDgkPriceUpdate(payload.vendorId, payload.barcode, payload.price);
        return NextResponse.json(res);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update variant';
        return jsonError(400, message);
    }
}