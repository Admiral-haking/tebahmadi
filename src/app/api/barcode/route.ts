import BarcodeModel from "@/models/barcode";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

function normalizePrefix(value: unknown): string {
    return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function formatAccountingCode(prefix: string, value: number): string {
    return `${prefix}-${value.toString().padStart(6, "0")}`;
}

export async function GET() {
    await connectMongoose();
    const prefixes = await BarcodeModel.find({}).sort({ prefix: 1 }).lean();
    return NextResponse.json(prefixes);
}

export async function POST(req: NextRequest) {
    await connectMongoose();

    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const prefix = normalizePrefix(payload.prefix);
    const last = Math.max(0, Number(payload.last) || 0);

    if (!name || !prefix) {
        return NextResponse.json({ error: "name and prefix are required" }, { status: 400 });
    }

    try {
        await BarcodeModel.create({ name, prefix, last });
        return NextResponse.json({ status: "ok" }, { status: 201 });
    } catch (error: any) {
        if (error?.code === 11000) {
            return NextResponse.json({ error: "prefix or name already exists" }, { status: 409 });
        }
        throw error;
    }
}

export async function PATCH(req: NextRequest) {
    await connectMongoose();

    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const prefix = normalizePrefix(payload.prefix);
    const inc = Math.max(1, Math.min(1000, Number(payload.inc) || 1));
    if (!prefix) {
        return NextResponse.json({ error: "prefix is required" }, { status: 400 });
    }

    const previous = await BarcodeModel.findOneAndUpdate(
        { prefix },
        { $inc: { last: inc } },
        { new: false, runValidators: true },
    ).lean();

    if (!previous) {
        return NextResponse.json({ error: "prefix not found" }, { status: 404 });
    }

    const start = Math.max(0, Number(previous.last) || 0) + 1;
    const end = start + inc - 1;
    const codes = Array.from({ length: inc }, (_, index) => formatAccountingCode(prefix, start + index));

    return NextResponse.json({ status: "ok", prefix, start, end, codes }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
    await connectMongoose();

    const url = new URL(req.url);
    const prefix = normalizePrefix(url.searchParams.get("prefix"));
    if (!prefix) {
        return NextResponse.json({ error: "prefix is required" }, { status: 400 });
    }

    await BarcodeModel.deleteMany({ prefix });
    return NextResponse.json({ status: "ok" }, { status: 201 });
}
