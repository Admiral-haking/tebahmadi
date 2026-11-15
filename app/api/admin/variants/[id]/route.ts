import { env } from "../../../../../lib/runtime";
import { isAdmin, sameOrigin } from "../../auth";

const integer = (value: unknown, fallback: number) => Number.isSafeInteger(Number(value)) ? Number(value) : fallback;
const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "ورودی نامعتبر است" }, { status: 400 }); }
  const current = await env.DB.prepare("SELECT * FROM product_variants WHERE id=?").bind(id).first<any>();
  if (!current) return Response.json({ error: "واریانت پیدا نشد" }, { status: 404 });
  const stock = integer(body.stockQuantity, Number(current.stock_quantity));
  const reserved = Number(current.reserved_quantity);
  const price = integer(body.priceToman, Number(current.price_toman));
  if (stock < reserved || stock < 0 || price < 0) return Response.json({ error: "موجودی یا قیمت معتبر نیست" }, { status: 400 });
  try {
    await env.DB.prepare("UPDATE product_variants SET title=?,sku=?,barcode=?,attributes_json=?,price_toman=?,compare_at_toman=?,stock_quantity=?,low_stock_threshold=?,weight_grams=?,active=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(text(body.title, 120) || current.title, text(body.sku, 80), text(body.barcode, 80), JSON.stringify(body.attributes || JSON.parse(current.attributes_json || "{}")), price, body.compareAtToman == null ? current.compare_at_toman : integer(body.compareAtToman, price), stock, integer(body.lowStockThreshold, Number(current.low_stock_threshold)), integer(body.weightGrams, Number(current.weight_grams)), body.active === false ? 0 : 1, integer(body.sortOrder, Number(current.sort_order)), id).run();
    return Response.json({ ok: true, variantId: id });
  } catch { return Response.json({ error: "به‌روزرسانی واریانت انجام نشد؛ SKU یا بارکد احتمالاً تکراری است" }, { status: 409 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  const { id } = await params;
  const result = await env.DB.prepare("UPDATE product_variants SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
  if (!result.meta.changes) return Response.json({ error: "واریانت پیدا نشد" }, { status: 404 });
  return Response.json({ ok: true });
}
