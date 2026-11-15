import { applySchemaMigrations } from "../migrations";
import { env } from "@/lib/runtime";
import { isAdmin, sameOrigin } from "../auth";
import { recordAudit } from "../login/audit";

export async function GET(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  try { await applySchemaMigrations(); } catch { return Response.json({ error: "سامانهٔ CRM هنوز آماده نیست" }, { status: 503 }); }
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) || "";
  const customerId = new URL(request.url).searchParams.get("customerId")?.trim().slice(0, 80) || "";
  const needle = `%${q}%`;
  const [customers, tags, notes] = await Promise.all([
    env.DB.prepare("SELECT c.id,c.name,c.phone,c.email,c.created_at,c.last_seen_at,COUNT(DISTINCT o.id) AS orders,COALESCE(SUM(CASE WHEN o.status IN ('paid','processing','shipped') THEN o.subtotal_toman ELSE 0 END),0) AS lifetime_value,COALESCE((SELECT SUM(l.points) FROM loyalty_ledger l WHERE l.customer_id=c.id),0) AS loyalty_points,GROUP_CONCAT(DISTINCT t.name) AS tags FROM customers c LEFT JOIN orders o ON o.customer_id=c.id LEFT JOIN customer_tag_assignments a ON a.customer_id=c.id LEFT JOIN customer_tags t ON t.id=a.tag_id WHERE c.name LIKE ? OR c.phone LIKE ? OR COALESCE(c.email,'') LIKE ? GROUP BY c.id ORDER BY lifetime_value DESC,c.created_at DESC LIMIT 200").bind(needle, needle, needle).all(),
    env.DB.prepare("SELECT * FROM customer_tags ORDER BY name").all(),
    env.DB.prepare("SELECT n.id,n.customer_id,n.note,n.created_at,c.name,c.phone FROM customer_notes n JOIN customers c ON c.id=n.customer_id ORDER BY n.created_at DESC LIMIT 200").all(),
  ]);
  const orders = customerId ? await env.DB.prepare("SELECT id,invoice_number,subtotal_toman,status,payment_status,shipping_status,shipping_method,tracking_code,created_at FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 100").bind(customerId).all() : { results: [] };
  return Response.json({ customers: customers.results, tags: tags.results, notes: notes.results, orders: orders.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let b: any; try { b = await request.json(); } catch { return Response.json({ error: "ورودی نامعتبر" }, { status: 400 }); }
  if (b.action === "note") {
    const customerId = String(b.customerId || "").slice(0, 80), note = String(b.note || "").trim().slice(0, 1200);
    if (!customerId || note.length < 2) return Response.json({ error: "متن یادداشت را بررسی کنید" }, { status: 400 });
    await env.DB.prepare("INSERT INTO customer_notes(id,customer_id,note) SELECT ?,id,? FROM customers WHERE id=?").bind(crypto.randomUUID(), note, customerId).run();
    await recordAudit(request,"customer.note","customer",customerId,note);
    return Response.json({ ok: true }, { status: 201 });
  }
  if (b.action === "tag") {
    const customerId = String(b.customerId || "").slice(0, 80), tag = String(b.tag || "").trim().slice(0, 40);
    if (!customerId || tag.length < 2) return Response.json({ error: "برچسب معتبر نیست" }, { status: 400 });
    const tagId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO customer_tags(id,name) VALUES(?,?) ON CONFLICT(name) DO NOTHING").bind(tagId, tag).run();
    await env.DB.prepare("INSERT OR IGNORE INTO customer_tag_assignments(customer_id,tag_id) SELECT ?,id FROM customer_tags WHERE name=?").bind(customerId, tag).run();
    await recordAudit(request,"customer.tag","customer",customerId,tag);
    return Response.json({ ok: true }, { status: 201 });
  }
  return Response.json({ error: "عملیات CRM نامعتبر است" }, { status: 400 });
}

export async function DELETE(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("noteId") || "";
  await recordAudit(request,"customer.note.delete","note",id);
  const result = await env.DB.prepare("DELETE FROM customer_notes WHERE id=?").bind(id.slice(0, 80)).run();
  return Response.json({ ok: (result.meta?.changes || 0) > 0 });
}
