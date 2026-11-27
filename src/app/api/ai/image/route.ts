import { NextRequest, NextResponse } from "next/server";
import { File as NodeFile } from "node:buffer";
import { DEFAULT_AI_IMAGE_SYSTEM_PROMPT } from "@/ai/constants";
import { getImageBase64 } from "./response-utils";

// Disable Next's default body parser for this route
export const config = {
    api: { bodyParser: false },
};

async function getOpenAIClient() {
    const globals = globalThis as typeof globalThis & { File?: typeof File };
    globals.File ??= NodeFile as unknown as typeof File;
    const { default: OpenAI } = await import("openai");
    return new OpenAI({
        timeout: 1e3 * 60 * 10,
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY
    });
}


export async function POST(req: NextRequest) {
    try {
        const form = await req.formData();
        const file = form.get("file") as File | null;
        if (!file) return new Response(JSON.stringify({ error: "no file" }), { status: 400 });

        const promptField = form.get("prompt");
        const systemPromptField = form.get("systemPrompt");
        const promptText = typeof promptField === "string" ? promptField.trim() : "";
        const systemPromptRaw =
            typeof systemPromptField === "string" ? systemPromptField : DEFAULT_AI_IMAGE_SYSTEM_PROMPT;
        const systemPrompt = systemPromptRaw.trim();

        if (!promptText && !systemPrompt) {
            return NextResponse.json({ error: "prompt is required" }, { status: 400 });
        }

        const finalPrompt = promptText
            ? systemPrompt
                ? `${systemPrompt}\n\n${promptText}`
                : promptText
            : systemPrompt || DEFAULT_AI_IMAGE_SYSTEM_PROMPT;

        // Call OpenAI image edit
        const openai = await getOpenAIClient();
        const result = await openai.images.edit({
            model: "gpt-image-1-mini",
            image: file,
            prompt: finalPrompt,
            size: "1024x1024",
            background: "auto",
            quality: 'medium'
        });

        const b64 = getImageBase64(result);
        if (!b64) throw new Error("AI did not return an image");

        const stream = Buffer.from(b64, "base64");

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": `inline; filename="edited_${file.name.replace(/\s+/g, "_")}.png"`,
            },
        });
    } catch (err: any) {
        console.error(err, err?.error);
        return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
    }
}
