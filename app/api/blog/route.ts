import { env } from "@/lib/runtime";
export async function GET(request: Request) {
  const url = new URL(request.url), category = url.searchParams.get("category"), q = url.searchParams.get("q"), limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 12)));
  let sql = "SELECT id,slug,title,excerpt,cover_url,category,tags_json,product_id,seo_title,seo_description,published_at,author_name FROM blog_posts WHERE status='published' AND published_at<=CURRENT_TIMESTAMP"; const args: string[] = [];
  if (category) { sql += " AND category=?"; args.push(category.slice(0, 80)); }
  if (q) { sql += " AND (title LIKE ? OR excerpt LIKE ?)"; const term = `%${q.slice(0, 80)}%`; args.push(term, term); }
  sql += " ORDER BY published_at DESC LIMIT ?";
  try { const rows = await env.DB.prepare(sql).bind(...args, limit).all(); return Response.json({ posts: rows.results }, { headers: { "Cache-Control": "public, max-age=120" } }); } catch { return Response.json({ posts: [] }, { headers: { "Cache-Control": "public, max-age=60" } }); }
}
