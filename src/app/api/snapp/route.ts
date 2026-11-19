import { connectMongoose } from "@/lib/mongoose";
import { getVendors } from "@/settings/services/vendorService";
import { snpGetVendors } from "@/snapp/api";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {

    await connectMongoose();

    const vendors = await getVendors("snapp");

    const response: Record<string, any> = {}

    for (let index = 0; index < vendors.length; index++) {
        const vendorId = vendors[index];
        try {
            response[vendorId] = (await snpGetVendors(vendorId)).data
        } catch {
            response[vendorId] = []
        }
    }

    return NextResponse.json(response);
}
