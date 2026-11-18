import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const runtime = "nodejs";
const mime: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = await params, file = parts.path.join("/");
  if (!file || file.includes("..") || file.includes("/") || !/^[a-f0-9-]+\.(jpg|jpeg|png|webp|gif)$/i.test(file)) return new Response("Not found", { status: 404 });
  try { const body = await readFile(join(resolve(process.env.MEDIA_ROOT || ".local/media"), file)); return new Response(body, { headers: { "Content-Type": mime[file.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } }); } catch { return new Response("Not found", { status: 404 }); }
}
