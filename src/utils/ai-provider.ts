/**
 * Central AI provider switch.
 *
 * A single env var, AI_PROVIDER ("openai" | "deepseek"), selects which LLM backs
 * the OpenAI-compatible /chat/completions flows (product AI, Digikala→site
 * extraction). DeepSeek's API is OpenAI-compatible, so the same request body
 * works against either — we only swap base URL, key and default model.
 *
 * Default is "deepseek" — all text AI runs on DeepSeek; OpenAI is reserved for
 * image generation only. If DeepSeek is unreachable from the host, set
 * AI_PROVIDER=openai (or the panel setting) to fall back.
 */
export type AiProvider = "openai" | "deepseek";

export interface AiProviderConfig {
    provider: AiProvider;
    /** Base URL WITHOUT the trailing /chat/completions. */
    baseUrl: string;
    apiKey: string;
    /** Default chat model when the caller doesn't force one. */
    chatModel: string;
}

/**
 * Read the configured provider (env), tolerant of casing/whitespace.
 * Default is "deepseek": all text/chat AI (product text, Digikala→site
 * extraction, blog, assistant) runs on DeepSeek. OpenAI is used ONLY for image
 * generation (gpt-image-1-mini), which lives outside this switch.
 */
export function getAiProvider(override?: string): AiProvider {
    const raw = String(override ?? process.env.AI_PROVIDER ?? "deepseek").trim().toLowerCase();
    return raw === "openai" ? "openai" : "deepseek";
}

/**
 * Resolve the full provider config. `override` lets a specific call force a
 * provider regardless of the global env (e.g. a per-request choice).
 */
export function resolveAiProvider(override?: string): AiProviderConfig {
    const provider = getAiProvider(override);
    if (provider === "deepseek") {
        return {
            provider,
            baseUrl: "https://api.deepseek.com",
            apiKey: process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "",
            chatModel: process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat",
        };
    }
    return {
        provider,
        baseUrl: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY || "",
        // gpt-4o (not -mini): the product/Digikala assistant relies on reliable
        // multi-step tool calling, where mini noticeably under-performs the
        // DeepSeek model it replaced.
        chatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
    };
}

/**
 * Resolve the provider honouring (in order): an explicit per-request override,
 * the in-panel setting saved in the site config (values.aiProvider), then the
 * AI_PROVIDER env var, then the "openai" default. The DB setting wins over env
 * so the admin's panel choice actually takes effect.
 */
export async function getAiProviderAsync(override?: string): Promise<AiProvider> {
    if (override === "openai" || override === "deepseek") return override;
    try {
        const { getSiteConfig } = await import("@/settings/services/settingsService");
        const values = ((await getSiteConfig())?.values ?? {}) as Record<string, unknown>;
        const v = values.aiProvider;
        if (v === "openai" || v === "deepseek") return v;
    } catch {
        /* fall through to env/default */
    }
    return getAiProvider();
}
