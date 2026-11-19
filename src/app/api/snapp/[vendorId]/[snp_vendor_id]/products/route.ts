import ProductModel, { ProductSchema } from "@/catalog/models/Product";
import { connectMongoose } from "@/lib/mongoose";
import { snpGetProducts } from "@/snapp/api";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';


type RouteContext = { params: Promise<{ vendorId: string, snp_vendor_id: string }> };

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {

    await connectMongoose();

    const url = new URL(req.url);
    const { vendorId, snp_vendor_id } = await context.params;
    const page = Number(url.searchParams.get('page') || "1") ?? 1;


    const res = await snpGetProducts(decodeURIComponent(vendorId), decodeURIComponent(snp_vendor_id), page);

    for (let index = 0; index < res.data.length; index++) {
        const snpProduct = res.data[index];
        const product = await ProductModel.findOne({
            'variants.barcode': snpProduct.sku
        }).lean<ProductSchema>();
        res.data[index].match = product
    }

    return NextResponse.json(res);
}
