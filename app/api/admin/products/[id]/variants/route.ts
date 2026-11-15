import { env } from "../../../../../../lib/runtime";
import { isAdmin, sameOrigin } from "../../../auth";

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const integer = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : fallback;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin(_request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const { id } = await params;
  const rows = await env.DB.prepare("SELECT v.*,COALESCE(v.stock_quantity-v.reserved_quantity,0) AS available_quantity FROM product_variants v WHERE v.product_id=? ORDER BY v.sort_order,v.created_at").bind(id).all();
  return Response.json({ variants: rows.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  const { id: productId } = await params;
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "ورودی نامعتبر است" }, { status: 400 }); }
  const product = await env.DB.prepare("SELECT id FROM products WHERE id=? AND active=1").bind(productId).first();
  if (!product) return Response.json({ error: "محصول پیدا نشد" }, { status: 404 });
  const title = text(body.title, 120) || "پیش‌فرض";
  const sku = text(body.sku, 80);
  const barcode = text(body.barcode, 80);
  const price = integer(body.priceToman, -1);
  const stock = integer(body.stockQuantity, -1);
  const weight = integer(body.weightGrams, 0);
  const lowStock = integer(body.lowStockThreshold, 5);
  if (price < 0 || stock < 0 || weight < 0 || lowStock < 0 || (body.compareAtToman != null && integer(body.compareAtToman, -1) < price)) return Response.json({ error: "قیمت، موجودی، وزن یا سقف تخفیف معتبر نیست" }, { status: 400 });
  const variantId = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO product_variants(id,product_id,title,sku,barcode,attributes_json,price_toman,compare_at_toman,stock_quantity,low_stock_threshold,weight_grams,active,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?, ?,?)")
      .bind(variantId, productId, title, sku, barcode, JSON.stringify(body.attributes || {}), price, body.compareAtToman == null ? null : integer(body.compareAtToman), stock, lowStock, weight, body.active === false ? 0 : 1, integer(body.sortOrder, 0)).run();
    if (stock) await env.DB.prepare("INSERT INTO inventory_movements(id,product_id,variant_id,delta,reason,reference,actor,operation,requested_delta,applied_delta,before_quantity,after_quantity) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), productId, variantId, stock, "موجودی اولیه واریانت", `variant_create:${variantId}`, "admin", "receive", stock, stock, 0, stock).run();
    return Response.json({ id: variantId }, { status: 201 });
  } catch { return Response.json({ error: "ذخیره واریانت انجام نشد؛ SKU یا بارکد احتمالاً تکراری است" }, { status: 409 }); }
}
