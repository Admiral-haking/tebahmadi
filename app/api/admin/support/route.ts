import { env } from "@/lib/runtime";
import { getAdminIdentity, hasAdminRole, sameOrigin } from "../auth";

export async function GET(request: Request) {
  if (!await hasAdminRole(request, ["owner", "admin", "manager", "support"])) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const tickets = await env.DB.prepare("SELECT t.*,c.name AS customer_name,c.phone AS customer_phone,u.name AS assignee_name FROM support_tickets t JOIN customers c ON c.id=t.customer_id LEFT JOIN admin_users u ON u.id=t.assigned_to ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,t.updated_at DESC LIMIT 150").all();
  const replies = await env.DB.prepare("SELECT r.* FROM support_replies r JOIN support_tickets t ON t.id=r.ticket_id ORDER BY r.created_at").all();
  return Response.json({ tickets: tickets.results, replies: replies.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  const actor = await getAdminIdentity(request);
  if (!actor || actor.must_change_password || !["owner", "admin", "manager", "support"].includes(actor.role)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  let body: any; try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر" }, { status: 400 }); }
  const id = String(body.ticketId || "").slice(0, 80), action = String(body.action || ""), ticket = await env.DB.prepare("SELECT id FROM support_tickets WHERE id=?").bind(id).first<any>();
  if (!ticket) return Response.json({ error: "درخواست پیدا نشد" }, { status: 404 });
  if (action === "reply" || action === "note") {
    const message = String(body.message || "").trim().slice(0, 4000);
    if (message.length < 2) return Response.json({ error: "متن پاسخ کوتاه است" }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare("INSERT INTO support_replies(id,ticket_id,author_type,author_id,message,is_internal) VALUES(?,?,'staff',?,?,?)").bind(crypto.randomUUID(), id, actor.id, message, action === "note" ? 1 : 0),
      env.DB.prepare("UPDATE support_tickets SET status=CASE WHEN ?=1 THEN status ELSE 'waiting_customer' END,assigned_to=COALESCE(assigned_to,?),updated_at=CURRENT_TIMESTAMP,last_reply_at=CURRENT_TIMESTAMP WHERE id=?").bind(action === "note" ? 1 : 0, actor.id, id)
    ]);
  } else if (action === "status") {
    const allowed = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
    if (!allowed.includes(body.status)) return Response.json({ error: "وضعیت نامعتبر" }, { status: 400 });
    await env.DB.prepare("UPDATE support_tickets SET status=?,updated_at=CURRENT_TIMESTAMP,assigned_to=COALESCE(assigned_to,?) WHERE id=?").bind(body.status, actor.id, id).run();
  } else if (action === "assign") {
    const assignee = String(body.assignedTo || actor.id).slice(0, 80);
    const target = await env.DB.prepare("SELECT id FROM admin_users WHERE id=? AND active=1").bind(assignee).first<any>();
    if (!target) return Response.json({ error: "کاربر فعال پیدا نشد" }, { status: 404 });
    await env.DB.prepare("UPDATE support_tickets SET assigned_to=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(assignee, id).run();
  } else return Response.json({ error: "عملیات نامعتبر" }, { status: 400 });
  return Response.json({ ok: true });
}
