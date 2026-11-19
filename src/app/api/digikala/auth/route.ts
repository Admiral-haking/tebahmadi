import { dgk_auth_token } from "@/digikala/services/auth";
import generateDgkKeyPair from "@/digikala/utils/generate-pair";
import { connectMongoose } from "@/lib/mongoose";
import { setServiceInfo } from "@/settings/services/servicesService";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {

    await connectMongoose();

    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');

    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    const { publicKey } = await generateDgkKeyPair(vendorId)

    return NextResponse.json({ publicKey });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    let publicKey: string, privateKey: string, vendorId: string;
    try {
        ({ publicKey, privateKey, vendorId } = await req.json());
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!vendorId || !publicKey || !privateKey) {
        return NextResponse.json({ error: "vendorId, publicKey, and privateKey are required" }, { status: 400 });
    }

    try {
        await setServiceInfo("dgk", "keys", vendorId, { publicKey, privateKey });
        return NextResponse.json({ publicKey });
    } catch (err) {
        console.error("Failed to save Digikala keys", { vendorId }, err);
        return NextResponse.json({ error: "Failed to save keys" }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    let vendorId: string, authorization_code: string;
    try {
        ({ vendorId, authorization_code } = await req.json());
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!vendorId || !authorization_code) {
        return NextResponse.json({ error: "vendorId and authorization_code are required" }, { status: 400 });
    }

    try {
        const { access_token_expires_at, refresh_token_expires_at } = await dgk_auth_token(authorization_code, vendorId);
        return NextResponse.json({ access_token_expires_at, refresh_token_expires_at });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Authentication failed";
        console.error("Digikala auth token failed", { vendorId }, err);
        return NextResponse.json({ error: message }, { status: 502 });
    }
}