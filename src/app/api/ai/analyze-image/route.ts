import { NextRequest, NextResponse } from "next/server";

import { chatCompletionWithRetry } from "@/utils/ai-proxy";

// Image analysis is currently DISABLED (no usable vision provider configured).
// Flip to true (or set AI_IMAGE_ANALYSIS=on) to re-enable. When enabled it uses
// OpenAI's vision model — DeepSeek has no vision API.
const IMAGE_ANALYSIS_ENABLED = process.env.AI_IMAGE_ANALYSIS === "on";
const VISION_PROVIDER = "openai";
const VISION_MODEL = "gpt-4o-mini";

export async function POST(req: NextRequest) {
    if (!IMAGE_ANALYSIS_ENABLED) {
        return NextResponse.json(
            { error: "تحلیل تصویر فعلاً غیرفعال است.", disabled: true },
            { status: 503 },
        );
    }

    try {
        const { imageUrl, prompt } = await req.json();

        if (!imageUrl) {
            return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
        }

        const analysisPrompt = prompt || "Describe this product in detail for an e-commerce catalog. Include: product type, material, color, shape, style, visible features.";

        const { data } = await chatCompletionWithRetry(
            {
                model: VISION_MODEL,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: analysisPrompt },
                            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
                        ],
                    },
                ],
                max_tokens: 500,
                temperature: 0.3,
            },
            { provider: VISION_PROVIDER },
        );

        const analysis = data?.choices?.[0]?.message?.content?.trim() || "";
        return NextResponse.json({ analysis });
    } catch (err: any) {
        const status = Number(err?.status) || 500;
        console.error(`[ai/analyze-image] failed (${status}): ${err?.code || err?.message || "unknown"}`);
        return NextResponse.json(
            { error: err?.message || "تحلیل تصویر با هوش مصنوعی ناموفق بود" },
            { status },
        );
    }
}
