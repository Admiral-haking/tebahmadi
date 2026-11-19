import { connectMongoose } from "@/lib/mongoose";
import { jsonError } from "@/lib/http";
import ServiceInfoModel from "@/settings/models/serviceInfo";
import { getVendors } from "@/settings/services/vendorService";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    try {
        const vendors = await getVendors("dgk");
        const response: Record<string, unknown> = {};

        for (const vendorId of vendors) {
            const data = await ServiceInfoModel.find({ service: "dgk", vendorId }).lean();
            const token = data.find((x) => x.id === "auth_token");
            response[vendorId] = {
                keys: data.some((x) => x.id === "keys"),
                validated: !!token,
                expires: token?.data?.refresh_token_expires_at?.date ?? null,
            };
        }

        return NextResponse.json(response);
    } catch (err) {
        console.error("Failed to load Digikala vendors", err);
        return jsonError(500, "Could not load vendor list");
    }
}
