import { env } from "@/lib/runtime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const q = url.searchParams.get("q");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 30), 1), 100);
  try {
    let sql = "SELECT p.id,p.name,p.slug,p.category,p.price_toman,p.compare_at_toman,p.image_url,p.description,p.stock,p.ingredients,p.usage_text,p.warning_text,p.sku,COALESCE(CAST(ROUND(p.price_toman*(100-cp.discount_percent)/100.0) AS INTEGER),p.price_toman) AS current_price_toman,cp.discount_percent AS campaign_discount FROM products p LEFT JOIN (SELECT x.product_id,MAX(x.discount_percent) AS discount_percent FROM campaign_products x JOIN campaigns c ON c.id=x.campaign_id WHERE c.active=1 AND (c.starts_at IS NULL OR c.starts_at<=CURRENT_TIMESTAMP) AND (c.ends_at IS NULL OR c.ends_at>=CURRENT_TIMESTAMP) GROUP BY x.product_id) cp ON cp.product_id=p.id WHERE p.active=1";
    const args: (string|number)[] = [];
    if (category) { sql += " AND p.category = ?"; args.push(category); }
    if (q) { sql += " AND p.name LIKE ?"; args.push(`%${q.slice(0,80)}%`); }
    sql += " ORDER BY p.created_at DESC LIMIT ?"; args.push(limit);
    const rows = await env.DB.prepare(sql).bind(...args).all<any>();
    const ids = rows.results.map((row: any) => row.id);
    const variants = ids.length ? await env.DB.prepare(`SELECT v.*,COALESCE(v.stock_quantity-v.reserved_quantity,0) AS available_quantity FROM product_variants v WHERE v.product_id IN (${ids.map(() => "?").join(",")}) AND v.active=1 ORDER BY v.sort_order,v.created_at`).bind(...ids).all<any>() : { results: [] };
    const byProduct = new Map<string, any[]>();
    for (const variant of variants.results) { const list = byProduct.get(variant.product_id) || []; list.push({ ...variant, attributes: JSON.parse(variant.attributes_json || "{}") }); byProduct.set(variant.product_id, list); }
    return Response.json({ products: rows.results.map((row: any) => ({ ...row, variants: byProduct.get(row.id) || [] })) }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    try { const legacy=await env.DB.prepare("SELECT id,name,slug,category,price_toman,compare_at_toman,image_url,description,stock,ingredients,usage_text,warning_text,sku,price_toman AS current_price_toman,NULL AS campaign_discount FROM products WHERE active=1 ORDER BY created_at DESC LIMIT ?").bind(limit).all();return Response.json({products:legacy.results},{headers:{"Cache-Control":"public, max-age=60"}}) } catch { return Response.json({ error: "سرویس محصولات موقتاً در دسترس نیست" }, { status: 503 }); }
  }
}
