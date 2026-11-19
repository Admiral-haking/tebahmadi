import { connectMongoose } from "@/lib/mongoose";
import { IServiceType } from "@/settings/models/serviceInfo";
import { getVendors, setVendors } from "@/settings/services/vendorService";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {

    await connectMongoose();

    const url = new URL(req.nextUrl);

    const service = url.searchParams.get("service") as IServiceType

    const vendors = await getVendors(service);


    return NextResponse.json({ vendors });
}

export async function POST(req: NextRequest): Promise<NextResponse> {

    const { vendors, service } = await req.json();

    await connectMongoose();

    await setVendors(service, vendors);


    return NextResponse.json({ vendors });
}
