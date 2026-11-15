import { env } from "@/lib/runtime";
import { hasAdminRole, sameOrigin } from "../auth";
import { recordAudit } from "../login/audit";

const allowed = (request: Request) => hasAdminRole(request, ["owner", "admin", "manager"]);

export async function GET(request: Request) {
  if (!await allowed(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const rows = await env.DB.prepare("SELECT v.id AS variant_id,v.product_id,p.name,v.title,v.sku,v.barcode,v.stock_quantity,v.reserved_quantity,(v.stock_quantity-v.reserved_quantity) AS available_quantity,v.low_stock_threshold,v.active,COALESCE(SUM(CASE WHEN m.created_at>=datetime('now','-30 days') THEN m.applied_delta ELSE m.delta END),0) AS movement_30d FROM product_variants v JOIN products p ON p.id=v.product_id LEFT JOIN inventory_movements m ON m.variant_id=v.id WHERE v.active=1 GROUP BY v.id ORDER BY available_quantity ASC,p.name,v.sort_order LIMIT 500").all();
  return Response.json({ items: rows.results.map((row: any) => ({ ...row, id: row.variant_id, stock: row.available_quantity })), lowStock: rows.results.filter((row: any) => Number(row.available_quantity) <= Number(row.low_stock_threshold)).length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await allowed(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: any; try { body = await request.json(); } catch { return Response.json({ error: "ورودی نامعتبر" }, { status: 400 }); }
  const variantId = String(body.variantId || "").slice(0, 80); const productId = String(body.productId || "").slice(0, 80); const delta = Math.floor(Number(body.delta)); const reason = String(body.reason || "").trim().slice(0, 160); const reference = String(body.reference || "").trim().slice(0, 100);
  if ((!variantId && !productId) || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 100000 || reason.length < 2) return Response.json({ error: "کالا، مقدار تغییر و دلیل را بررسی کنید" }, { status: 400 });
  const variant = variantId
    ? await env.DB.prepare("SELECT * FROM product_variants WHERE id=?").bind(variantId).first<any>()
    : await env.DB.prepare("SELECT * FROM product_variants WHERE id=? OR product_id=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END,sort_order LIMIT 1").bind(productId, productId, productId).first<any>();
  if (!variant) return Response.json({ error: "واریانت پیدا نشد" }, { status: 404 });
  const next = Number(variant.stock_quantity) + delta; if (next < Number(variant.reserved_quantity) || next > 100000) return Response.json({ error: "موجودی نهایی معتبر نیست" }, { status: 400 });
  const update = await env.DB.prepare("UPDATE product_variants SET stock_quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock_quantity=?").bind(next, variant.id, variant.stock_quantity).run(); if (!update.meta.changes) return Response.json({ error: "موجودی هم‌زمان تغییر کرده؛ دوباره بارگیری کنید" }, { status: 409 });
  try { await env.DB.prepare("UPDATE products SET stock=? WHERE id=?").bind(next, variant.product_id).run(); await env.DB.prepare("INSERT INTO inventory_movements(id,product_id,variant_id,delta,reason,reference,actor,operation,requested_delta,applied_delta,before_quantity,after_quantity) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), variant.product_id, variant.id, delta, reason, reference, request.headers.get("cf-access-authenticated-user-email") || "admin", delta > 0 ? "receive" : "adjustment", Math.abs(delta), delta, variant.stock_quantity, next).run(); await recordAudit(request, "inventory.adjust", "variant", variant.id, `${delta}: ${reason}`); } catch { await env.DB.prepare("UPDATE product_variants SET stock_quantity=? WHERE id=?").bind(variant.stock_quantity, variant.id).run(); return Response.json({ error: "ثبت گردش موجودی انجام نشد و تغییر بازگردانده شد" }, { status: 503 }); }
  return Response.json({ ok: true, variantId: variant.id, stock: next - Number(variant.reserved_quantity), stockQuantity: next, availableQuantity: next - Number(variant.reserved_quantity) });
}
