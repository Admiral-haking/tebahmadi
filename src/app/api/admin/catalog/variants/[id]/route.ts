import { patchVariant } from "@/catalog/services/variantsService";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
    req: NextRequest,
    context: RouteContext,
): Promise<NextResponse> {
    const params = await context.params;
    const searchParams = req.nextUrl.searchParams;
    const sync = searchParams.get('sync') ?? undefined;
    await connectMongoose();
    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return jsonError(400, 'Invalid JSON body');
    }
    try {
        const res = await patchVariant({
            variantId: params.id,
            updates: payload
        }, !!sync);
        return NextResponse.json(res);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update variant';
        return jsonError(400, message);
    }
}