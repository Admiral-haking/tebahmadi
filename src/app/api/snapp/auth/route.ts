import { bslAuth, bslGetVendorStatus } from "@/basalaam/services/auth";
import { connectMongoose } from "@/lib/mongoose";
import { snpSetToken } from "@/snapp/services/token";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {

    await connectMongoose();

    const args = await req.json();


    const res = await snpSetToken(args.vendorId, args.token, args.client_secret);

    if (typeof res === 'string') return NextResponse.json({ message: res }, { status: 401 })

    return NextResponse.json(res);
}