import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { env } from "@/lib/runtime";
import { isAdmin, sameOrigin } from "../auth";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const mediaRoot = () => resolve(process.env.MEDIA_ROOT || ".local/media");
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  if (!await isAdmin(request)) return json({ error: "دسترسی مجاز نیست" }, 401);
  const url = new URL(request.url), productId = (url.searchParams.get("productId") || "").slice(0, 80);
  if (!productId) return json({ error: "شناسه محصول لازم است" }, 400);
  const rows = await env.DB.prepare("SELECT * FROM product_images WHERE product_id=? ORDER BY is_primary DESC,sort_order,created_at").bind(productId).all<any>();
  return json({ images: rows.results.map((row: any) => ({ ...row, url: `/media/${row.storage_key}` })) });
}

export async function POST(request: Request) {
  if (!await isAdmin(request)) return json({ error: "دسترسی مجاز نیست" }, 401);
  if (!sameOrigin(request)) return json({ error: "مبدأ درخواست معتبر نیست" }, 403);
  const form = await request.formData(), file = form.get("file"), productId = String(form.get("productId") || "").trim().slice(0, 80), variantId = String(form.get("variantId") || "").trim().slice(0, 80) || null;
  if (!(file instanceof File) || !productId) return json({ error: "فایل و محصول لازم است" }, 400);
  const extension = types[file.type];
  if (!extension) return json({ error: "فرمت مجاز: JPG، PNG، WebP یا GIF" }, 415);
  if (file.size < 1 || file.size > MAX_BYTES) return json({ error: "حجم تصویر باید حداکثر ۵ مگابایت باشد" }, 413);
  const product = await env.DB.prepare("SELECT id FROM products WHERE id=?").bind(productId).first();
  if (!product) return json({ error: "محصول پیدا نشد" }, 404);
  if (variantId && !await env.DB.prepare("SELECT id FROM product_variants WHERE id=? AND product_id=?").bind(variantId, productId).first()) return json({ error: "واریانت متعلق به این محصول نیست" }, 400);
  const id = crypto.randomUUID(), storageKey = `${id}.${extension}`, directory = mediaRoot();
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, storageKey), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  const isPrimary = String(form.get("isPrimary") || "") === "true";
  try {
    if (isPrimary) await env.DB.prepare("UPDATE product_images SET is_primary=0 WHERE product_id=?").bind(productId).run();
    const order = Number(form.get("sortOrder") || 0);
    await env.DB.prepare("INSERT INTO product_images(id,product_id,variant_id,storage_key,original_name,mime_type,size_bytes,alt_text,sort_order,is_primary) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id, productId, variantId, storageKey, String(file.name).slice(0, 180), file.type, file.size, String(form.get("altText") || "").slice(0, 180), Number.isSafeInteger(order) ? Math.max(0, order) : 0, isPrimary ? 1 : 0).run();
  } catch (error) { await unlink(join(directory, storageKey)).catch(() => {}); throw error; }
  return json({ ok: true, image: { id, product_id: productId, variant_id: variantId, storage_key: storageKey, url: `/media/${storageKey}`, is_primary: isPrimary ? 1 : 0 } }, 201);
}

export async function DELETE(request: Request) {
  if (!await isAdmin(request)) return json({ error: "دسترسی مجاز نیست" }, 401);
  if (!sameOrigin(request)) return json({ error: "مبدأ درخواست معتبر نیست" }, 403);
  const id = (new URL(request.url).searchParams.get("id") || "").slice(0, 80), row = await env.DB.prepare("SELECT id,product_id,storage_key,is_primary FROM product_images WHERE id=?").bind(id).first<any>();
  if (!row) return json({ error: "تصویر پیدا نشد" }, 404);
  await env.DB.prepare("DELETE FROM product_images WHERE id=?").bind(id).run();
  if (row.is_primary) {
    const replacement = await env.DB.prepare("SELECT id FROM product_images WHERE product_id=? ORDER BY sort_order,created_at LIMIT 1").bind(row.product_id).first<any>();
    if (replacement) await env.DB.prepare("UPDATE product_images SET is_primary=1 WHERE id=?").bind(replacement.id).run();
  }
  await unlink(join(mediaRoot(), row.storage_key)).catch(() => {});
  return json({ ok: true });
}

export async function PATCH(request: Request) {
  if (!await isAdmin(request)) return json({ error: "دسترسی مجاز نیست" }, 401);
  if (!sameOrigin(request)) return json({ error: "مبدأ درخواست معتبر نیست" }, 403);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "").trim().slice(0, 80);
  const row = await env.DB.prepare("SELECT * FROM product_images WHERE id=?").bind(id).first<any>();
  if (!row) return json({ error: "تصویر پیدا نشد" }, 404);
  const variantId = body.variantId === null || body.variantId === "" ? null : String(body.variantId || "").trim().slice(0, 80);
  if (variantId && !await env.DB.prepare("SELECT id FROM product_variants WHERE id=? AND product_id=?").bind(variantId, row.product_id).first()) return json({ error: "واریانت متعلق به این محصول نیست" }, 400);
  const isPrimary = typeof body.isPrimary === "boolean" ? body.isPrimary : Boolean(row.is_primary);
  if (isPrimary) await env.DB.prepare("UPDATE product_images SET is_primary=0 WHERE product_id=?").bind(row.product_id).run();
  const sortOrder = Number.isSafeInteger(Number(body.sortOrder)) ? Math.max(0, Number(body.sortOrder)) : Number(row.sort_order || 0);
  const altText = typeof body.altText === "string" ? body.altText.slice(0, 180) : row.alt_text;
  await env.DB.prepare("UPDATE product_images SET variant_id=?,alt_text=?,sort_order=?,is_primary=? WHERE id=?").bind(variantId, altText, sortOrder, isPrimary ? 1 : 0, id).run();
  const updated = await env.DB.prepare("SELECT * FROM product_images WHERE id=?").bind(id).first<any>();
  return json({ ok: true, image: { ...updated, url: `/media/${updated.storage_key}` } });
}
