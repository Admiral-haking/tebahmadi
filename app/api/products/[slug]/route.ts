import { env } from "@/lib/runtime";

function parseJson<T>(value: unknown, fallback: T): T { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const product = await env.DB.prepare("SELECT p.*,COALESCE(CAST(ROUND(p.price_toman*(100-cp.discount_percent)/100.0) AS INTEGER),p.price_toman) AS current_price_toman,cp.discount_percent AS campaign_discount FROM products p LEFT JOIN (SELECT x.product_id,MAX(x.discount_percent) discount_percent FROM campaign_products x JOIN campaigns c ON c.id=x.campaign_id WHERE c.active=1 AND (c.starts_at IS NULL OR c.starts_at<=CURRENT_TIMESTAMP) AND (c.ends_at IS NULL OR c.ends_at>=CURRENT_TIMESTAMP) GROUP BY x.product_id) cp ON cp.product_id=p.id WHERE p.slug=? AND p.active=1").bind(slug.slice(0, 180)).first<any>();
    if (!product) return Response.json({ error: "محصول پیدا نشد" }, { status: 404 });
    const related = await env.DB.prepare("SELECT id,name,slug,category,price_toman,compare_at_toman,image_url,stock FROM products WHERE active=1 AND category=? AND id<>? ORDER BY created_at DESC LIMIT 4").bind(product.category, product.id).all();
    return Response.json({ product: { ...product, faq: parseJson(product.faq_json, []), benefits: String(product.benefits || "").split("\n").filter(Boolean) }, related: related.results }, { headers: { "Cache-Control": "public, max-age=120" } });
  } catch { return Response.json({ error: "سرویس محصول موقتاً در دسترس نیست" }, { status: 503 }); }
}
