import { chatCompletionWithRetry } from "@/utils/ai-proxy";
import { getAiProviderAsync } from "@/utils/ai-provider";
import { NextRequest, NextResponse } from "next/server";

// -----------------------------
// Handler — product AI + Digikala→site extraction.
// Provider (OpenAI / DeepSeek) is chosen by the AI_PROVIDER env switch. An
// optional { provider } field in the body forces one for a single request.
// -----------------------------
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const requested = typeof body?.provider === "string" ? body.provider : undefined;
        if (requested) delete body.provider; // not part of the chat-completions schema

        // Per-request override → panel setting → env → default.
        const provider = await getAiProviderAsync(requested);
        const { data } = await chatCompletionWithRetry(body, { provider });
        return NextResponse.json(data, { status: 200 });
    } catch (err: any) {
        const message = err?.message || "Unexpected error";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
