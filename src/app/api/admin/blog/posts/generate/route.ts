import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { getAiProviderAsync } from "@/utils/ai-provider";

export const runtime = "nodejs";

const requestSchema = z.object({
  provider: z.enum(["openai", "deepseek"]).optional(),
  title: z.string().trim().min(2),
  keywords: z.string().trim().optional().default(""),
  tone: z.string().trim().optional().default("حرفه‌ای، روان و مناسب فروشگاه کفش"),
});

function extractOpenAIText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const parts = Array.isArray(payload?.output) ? payload.output : [];
  return parts
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((content: any) => content?.text)
    .filter((text: unknown): text is string => typeof text === "string")
    .join("\n")
    .trim();
}

function buildPrompt(input: z.infer<typeof requestSchema>) {
  return [
    "یک مقاله وبلاگ فارسی برای فروشگاه کفش بنویس.",
    `عنوان: ${input.title}`,
    input.keywords ? `کلمات کلیدی: ${input.keywords}` : "",
    `لحن: ${input.tone}`,
    "خروجی فقط JSON معتبر باشد با کلیدهای title, slug, excerpt, content, seoTitle, seoDescription, tags.",
    "content باید HTML تمیز با h2، p، ul/li و بدون markdown باشد.",
  ].filter(Boolean).join("\n");
}

async function generateWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const model = process.env.BLOG_AI_OPENAI_MODEL || "gpt-5.5";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: { type: "json_object" },
        verbosity: "medium",
      },
      reasoning: { effort: "low" },
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    throw new Error((await response.text().catch(() => "")) || `openai_${response.status}`);
  }

  return extractOpenAIText(await response.json());
}

async function generateWithDeepSeek(prompt: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY or LLM_API_KEY is not configured");
  // Valid DeepSeek models are "deepseek-chat" / "deepseek-reasoner"; the old
  // "deepseek-v4-pro" default doesn't exist and made every unconfigured call 400.
  const model = process.env.BLOG_AI_DEEPSEEK_MODEL || "deepseek-chat";

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You write production-ready Persian SEO blog posts and return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    throw new Error((await response.text().catch(() => "")) || `deepseek_${response.status}`);
  }

  const payload = await response.json();
  return String(payload?.choices?.[0]?.message?.content ?? "").trim();
}

export async function POST(req: NextRequest) {
  await requirePermission(req, "catalog:publish");

  try {
    const input = requestSchema.parse(await req.json());
    const prompt = buildPrompt(input);
    // Explicit request provider → panel setting → env → default.
    const provider = await getAiProviderAsync(input.provider);
    const raw = provider === "deepseek"
      ? await generateWithDeepSeek(prompt)
      : await generateWithOpenAI(prompt);
    const data = JSON.parse(raw);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[blog-ai] generation failed", error);
    const message = error instanceof Error ? error.message : "blog_ai_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
