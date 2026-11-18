import { env } from "@/lib/runtime";

function parseJson<T>(value: unknown, fallback: T): T { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const product = await env.DB.prepare("SELECT p.*,COALESCE(CAST(ROUND(p.price_toman*(100-cp.discount_percent)/100.0) AS INTEGER),p.price_toman) AS current_price_toman,cp.discount_percent AS campaign_discount FROM products p LEFT JOIN (SELECT x.product_id,MAX(x.discount_percent) discount_percent FROM campaign_products x JOIN campaigns c ON c.id=x.campaign_id WHERE c.active=1 AND (c.starts_at IS NULL OR c.starts_at<=CURRENT_TIMESTAMP) AND (c.ends_at IS NULL OR c.ends_at>=CURRENT_TIMESTAMP) GROUP BY x.product_id) cp ON cp.product_id=p.id WHERE p.slug=? AND p.active=1").bind(slug.slice(0, 180)).first<any>();
    if (!product) return Response.json({ error: "محصول پیدا نشد" }, { status: 404 });
    const [related, variants, images] = await Promise.all([
      env.DB.prepare("SELECT id,name,slug,category,price_toman,compare_at_toman,image_url,stock FROM products WHERE active=1 AND category=? AND id<>? ORDER BY created_at DESC LIMIT 4").bind(product.category, product.id).all(),
      env.DB.prepare("SELECT v.id,v.title,v.sku,v.barcode,v.attributes_json,v.price_toman,v.compare_at_toman,v.stock_quantity,v.reserved_quantity,v.weight_grams,MAX(v.stock_quantity-v.reserved_quantity,0) AS available_quantity FROM product_variants v WHERE v.product_id=? AND v.active=1 ORDER BY v.sort_order,v.created_at").bind(product.id).all<any>(),
      env.DB.prepare("SELECT id,product_id,variant_id,storage_key,alt_text,sort_order,is_primary FROM product_images WHERE product_id=? ORDER BY is_primary DESC,sort_order,created_at").bind(product.id).all<any>(),
    ]);
    return Response.json({ product: { ...product, images: images.results.map((image: any) => ({ ...image, url: `/media/${image.storage_key}` })), variants: variants.results.map((variant: any) => ({ ...variant, attributes: parseJson(variant.attributes_json, {}) })), faq: parseJson(product.faq_json, []), benefits: String(product.benefits || "").split("\n").filter(Boolean) }, related: related.results }, { headers: { "Cache-Control": "public, max-age=120" } });
  } catch { return Response.json({ error: "سرویس محصول موقتاً در دسترس نیست" }, { status: 503 }); }
}
