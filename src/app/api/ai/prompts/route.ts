import { NextRequest, NextResponse } from "next/server";

import ImagePromptModel from "@/ai/models/ImagePrompt";
import { connectMongoose } from "@/lib/mongoose";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type ImagePromptPayload = {
    name?: unknown;
    prompt?: unknown;
};

function serializePrompt(prompt: any) {
    const id = typeof prompt._id?.toString === "function" ? prompt._id.toString() : "";
    return {
        id,
        name: prompt.name ?? "",
        prompt: prompt.prompt ?? "",
        createdAt: prompt.createdAt instanceof Date ? prompt.createdAt.toISOString() : undefined,
        updatedAt: prompt.updatedAt instanceof Date ? prompt.updatedAt.toISOString() : undefined,
    };
}

export async function GET(): Promise<NextResponse> {
    try {
        await connectMongoose();
        const prompts = await ImagePromptModel.find().sort({ createdAt: -1 }).lean({ getters: false });
        const serialized = prompts.map(serializePrompt);
        return NextResponse.json({ prompts: serialized });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load prompts";
        return jsonError(500, message);
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    let payload: ImagePromptPayload;
    try {
        payload = (await req.json()) as ImagePromptPayload;
    } catch {
        return jsonError(400, "Invalid JSON body");
    }

    const nameRaw = typeof payload.name === "string" ? payload.name.trim() : "";
    const promptRaw = typeof payload.prompt === "string" ? payload.prompt.trim() : "";

    if (!nameRaw) {
        return jsonError(400, "نام پرامپت الزامی است.");
    }
    if (!promptRaw) {
        return jsonError(400, "متن پرامپت الزامی است.");
    }

    try {
        const created = await ImagePromptModel.create({ name: nameRaw, prompt: promptRaw });
        const serialized = serializePrompt(created);
        return NextResponse.json({ prompt: serialized }, { status: 201 });
    } catch (error: any) {
        if (error?.code === 11000) {
            return jsonError(409, "پرامپتی با این نام از قبل وجود دارد.");
        }
        const message = error instanceof Error ? error.message : "Failed to create prompt";
        return jsonError(500, message);
    }
}
