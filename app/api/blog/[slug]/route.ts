import { env } from "@/lib/runtime";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try { const post = await env.DB.prepare("SELECT b.*,p.name product_name,p.slug product_slug FROM blog_posts b LEFT JOIN products p ON p.id=b.product_id WHERE b.slug=? AND b.status='published' AND b.published_at<=CURRENT_TIMESTAMP").bind(slug.slice(0, 180)).first<any>(); if (!post) return Response.json({ error: "مقاله پیدا نشد" }, { status: 404 }); return Response.json({ post }, { headers: { "Cache-Control": "public, max-age=120" } }); } catch { return Response.json({ error: "مقاله در دسترس نیست" }, { status: 503 }); }
}
