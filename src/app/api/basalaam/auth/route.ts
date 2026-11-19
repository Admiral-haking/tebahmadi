import { bslAuth, bslGetVendorStatus } from "@/basalaam/services/auth";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const args = await req.json();
    const res = await bslAuth({ ...args, expires: Date.now() + (1e3 * 60 * 60 * 24 * 30 * 11) });
    return NextResponse.json(res);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');
    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    try {
        const res = await bslGetVendorStatus(vendorId);
        return NextResponse.json(res);
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "خطا در بررسی وضعیت توکن باسلام", status: "خطا" },
            { status: 400 }
        );
    }
}
