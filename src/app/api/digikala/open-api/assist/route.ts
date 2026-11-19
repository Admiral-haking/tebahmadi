import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDgkOpenApiSpecSummary } from "@/digikala/services/open-api-spec";
import type { DgkOpenApiMethod } from "@/digikala/services/open-api";
import { requirePermission } from "@/lib/auth";
import { getAiProviderAsync } from "@/utils/ai-provider";

export const runtime = "nodejs";

const requestSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().trim().min(1),
  title: z.string().trim().optional().default(""),
  adminText: z.string().trim().min(2),
  currentPathParams: z.record(z.string(), z.string()).optional().default({}),
  currentBodyFields: z.record(z.string(), z.string()).optional().default({}),
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

function buildPrompt(input: z.infer<typeof requestSchema>, spec: Awaited<ReturnType<typeof getDgkOpenApiSpecSummary>>) {
  return [
    "You fill a Digikala Seller Open API admin form.",
    "Return only valid JSON. Do not invent IDs. If an ID is missing, leave it empty and add a Persian warning.",
    "Convert Persian/English admin text into pathParams and bodyFieldValues matching field keys.",
    "For boolean fields use string values \"true\" or \"false\".",
    "For number fields return plain numeric strings.",
    "For JSON fields return a JSON string, not an object.",
    "",
    `Operation title: ${input.title}`,
    `Method: ${input.method}`,
    `Path: ${input.path}`,
    `Admin request: ${input.adminText}`,
    `Current path params: ${JSON.stringify(input.currentPathParams)}`,
    `Current body fields: ${JSON.stringify(input.currentBodyFields)}`,
    `Official OpenAPI operation: ${JSON.stringify(spec).slice(0, 16000)}`,
    "",
    "Output shape:",
    JSON.stringify({
      pathParams: { "example_id": "123" },
      bodyFieldValues: { field_key: "value" },
      explanationFa: "توضیح کوتاه فارسی",
      warningsFa: ["اگر چیزی کم است اینجا بنویس"],
    }),
  ].join("\n");
}

async function generateWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const model = process.env.DIGIKALA_AI_OPENAI_MODEL || process.env.BLOG_AI_OPENAI_MODEL || "gpt-3.5";

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
        verbosity: "low",
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
  const model = process.env.DIGIKALA_AI_DEEPSEEK_MODEL || process.env.BLOG_AI_DEEPSEEK_MODEL || "deepseek-chat";

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return only valid JSON. You help Persian admins fill Digikala Seller Open API forms from official OpenAPI schema." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
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
  await requirePermission(req, "products:write");

  try {
    const input = requestSchema.parse(await req.json());
    const spec = await getDgkOpenApiSpecSummary(input.method as DgkOpenApiMethod, input.path);
    const prompt = buildPrompt(input, spec);
    // Explicit switch via the panel setting / AI_PROVIDER, not key-presence guessing.
    const raw = (await getAiProviderAsync()) === "deepseek"
      ? await generateWithDeepSeek(prompt)
      : await generateWithOpenAI(prompt);

    return NextResponse.json({
      data: JSON.parse(raw),
      spec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "digikala_ai_assist_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
