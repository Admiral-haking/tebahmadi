import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import ImagePromptModel from "@/ai/models/ImagePrompt";
import { connectMongoose } from "@/lib/mongoose";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_: NextRequest, context: RouteContext): Promise<NextResponse> {
    const id = (await context.params)?.id ?? "";

    if (!id || !isValidObjectId(id)) {
        return jsonError(400, "شناسه پرامپت معتبر نیست.");
    }

    try {
        await connectMongoose();
        const deleted = await ImagePromptModel.findByIdAndDelete(id);
        if (!deleted) {
            return jsonError(404, "پرامپت یافت نشد.");
        }
        return NextResponse.json({ deleted: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete prompt";
        return jsonError(500, message);
    }
}
