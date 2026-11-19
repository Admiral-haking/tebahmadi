import BslVariantModel from "@/basalaam/models/variants";
import { connectMongoose } from "@/lib/mongoose";
import { PipelineStage } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');
    const q = url.searchParams.get('q') ?? '';
    const page = Number(url.searchParams.get('page') || "1") ?? 1;

    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safeQ, 'i');
    const baseFilter = safeQ
        ? { vendorId, $or: [{ displayName: regex }, { barcode: regex }, { sku: regex }] }
        : { vendorId };
    const matchPipeline: PipelineStage = { $match: baseFilter };

    try {
        const count = await BslVariantModel.countDocuments(baseFilter);
        const items = await BslVariantModel.aggregate([
            matchPipeline,
            { $sort: { _id: -1 } },
            { $skip: (page - 1) * 50 },
            { $limit: 50 },
            { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "match" } }
        ]);

        return NextResponse.json({ items, page, pages: Math.ceil(count / 50), rows: count });
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "خطا در بارگیری محصولات باسلام" },
            { status: 500 }
        );
    }
}
