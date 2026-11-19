import { dgkGetProducts, dgkGetProductVariants } from "@/digikala/services/products";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ product_id: string }> };

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {


    const { product_id } = await context.params;

    await connectMongoose();

    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');

    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    const res = await dgkGetProductVariants(vendorId, product_id);

    return NextResponse.json(res);
}