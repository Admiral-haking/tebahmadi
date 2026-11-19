/**
 * AI proxy for OpenAI-compatible /chat/completions endpoints (OpenAI & DeepSeek).
 * Uses the global fetch with retry/backoff on transient (5xx/network) errors.
 */
import { resolveAiProvider, type AiProviderConfig } from "@/utils/ai-provider";

export interface ChatProxyOptions {
    /** Force a provider for this call; otherwise the AI_PROVIDER env decides. */
    provider?: string;
    retries?: number;
    retryDelay?: number;
}

/**
 * POST a chat-completions body to the configured provider, retrying transient
 * failures. The body's `model` is overridden with the provider's default model
 * unless the caller already set a model that matches the provider family — this
 * keeps a DeepSeek-named model from being sent to OpenAI (and vice-versa).
 */
export async function chatCompletionWithRetry(
    body: any,
    opts: ChatProxyOptions = {},
) {
    const cfg: AiProviderConfig = resolveAiProvider(opts.provider);
    if (!cfg.apiKey) {
        throw Object.assign(new Error(`No API key configured for provider "${cfg.provider}"`), { status: 500 });
    }

    const retries = opts.retries ?? 3;
    const retryDelay = opts.retryDelay ?? 1000;

    // Make sure the model belongs to the selected provider. If the incoming
    // model name doesn't match the family, replace it with the provider default.
    const incomingModel = String(body?.model ?? "");
    const familyMatches =
        cfg.provider === "deepseek" ? /deepseek/i.test(incomingModel) : /^(gpt|o\d|chatgpt)/i.test(incomingModel);
    const payload = { ...body, model: familyMatches && incomingModel ? incomingModel : cfg.chatModel };

    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${cfg.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(90000),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "Unknown error");
                throw Object.assign(new Error(`Request failed with status code ${response.status}`), {
                    status: response.status,
                    data: errorText,
                });
            }

            const data = await response.json();
            return { data, status: response.status, headers: response.headers };
        } catch (error: any) {
            console.error(`[AI-Proxy:${cfg.provider}] Request failed:`, error?.message || error);

            // Don't retry 4xx (client errors) — they won't succeed on retry.
            if (error?.status && error.status >= 400 && error.status < 500) throw error;

            lastError = error;
            if (attempt < retries) {
                console.warn(`[AI-Proxy:${cfg.provider}] attempt ${attempt + 1}/${retries} failed; retrying in ${retryDelay}ms…`);
                await new Promise((res) => setTimeout(res, retryDelay));
            }
        }
    }

    throw lastError;
}

/**
 * @deprecated Back-compat shim. Prefer {@link chatCompletionWithRetry}, which
 * honours the AI_PROVIDER switch instead of always hitting DeepSeek. Kept so the
 * old signature (body, apiKey) keeps compiling; the apiKey arg is ignored and
 * the provider/key now come from env.
 */
export async function axiosDeepseekWithRetry(
    body: any,
    _apiKey: string,
    retries: number = 3,
    retryDelay: number = 1000,
) {
    return chatCompletionWithRetry(body, { retries, retryDelay });
}
