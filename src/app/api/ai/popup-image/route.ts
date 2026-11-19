import { NextRequest, NextResponse } from "next/server";
import { File as NodeFile } from "node:buffer";
import { Types } from "mongoose";
import { connectMongoose } from "@/lib/mongoose";
import { getAuth, HttpError, requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { saveImageVariants } from "@/lib/gridfs";
import { createImageRecord } from "@/media/services/mediaService";

export const runtime = "nodejs";

async function getOpenAIClient() {
  const globals = globalThis as typeof globalThis & { File?: typeof File };
  globals.File ??= NodeFile as unknown as typeof File;
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    timeout: 1e3 * 60 * 10,
    baseURL: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();

  try {
    await requirePermission(req, "media:write");
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonError(err.status, err.message);
    }
    return jsonError(500, "Failed to verify permissions");
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return jsonError(400, "prompt is required");
  }

  try {
    const openai = await getOpenAIClient();
    const result = await openai.images.generate({
      model: "gpt-image-1-mini",
      prompt,
      size: "1024x1024",
      quality: "medium",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return jsonError(502, "AI did not return an image");
    }

    const buffer = Buffer.from(b64, "base64");
    const auth = getAuth(req);
    const ownerUserId = auth && Types.ObjectId.isValid(auth.sub) ? new Types.ObjectId(auth.sub) : undefined;
    const variants = await saveImageVariants(buffer, "smart-popup.png", "image/png", "gallery", ownerUserId);
    const mediaDoc = await createImageRecord({
      filename: "smart-popup.png",
      contentType: "image/png",
      variants,
      scope: "gallery",
      ownerUserId,
    });

    const media = mediaDoc.toJSON() as unknown as {
      id?: string;
      originalId?: string;
      mobileId?: string;
      thumbId?: string;
    };
    const imageId = media.mobileId ?? media.thumbId ?? media.originalId;

    return NextResponse.json({
      media,
      imageUrl: imageId ? `/api/media/${imageId}` : "",
    });
  } catch (err) {
    console.error("Smart popup image generation failed", err);
    const message = err instanceof Error ? err.message : "Image generation failed";
    return jsonError(500, message);
  }
}
