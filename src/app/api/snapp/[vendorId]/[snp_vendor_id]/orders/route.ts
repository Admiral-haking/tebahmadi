import { connectMongoose } from "@/lib/mongoose";
import { snpGetOrders } from "@/snapp/api";
import { buildSnappItemMap } from "@/snapp/services/enrich-items";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';


type RouteContext = { params: Promise<{ vendorId: string, snp_vendor_id: string }> };

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {

    await connectMongoose();

    const url = new URL(req.url);
    const { vendorId, snp_vendor_id } = await context.params;
    const cursor = url.searchParams.get('cursor') ?? undefined;

    const res = await snpGetOrders(decodeURIComponent(vendorId), decodeURIComponent(snp_vendor_id), cursor);

    // Enrich each line with the local product title + image (Snapp only returns
    // the sku), keyed by sku so the panel and copy text show real names/photos.
    const itemMeta = await buildSnappItemMap(res?.data ?? []);

    return NextResponse.json({ ...res, itemMeta });
}
