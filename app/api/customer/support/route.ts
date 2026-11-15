import { env } from "@/lib/runtime";
import { currentCustomer, validOrigin } from "../session";

export async function GET(request: Request) {
  const customer = await currentCustomer(request);
  if (!customer) return Response.json({ error: "ابتدا وارد حساب شوید" }, { status: 401 });
  const tickets = await env.DB.prepare("SELECT id,subject,status,priority,created_at,updated_at FROM support_tickets WHERE customer_id=? ORDER BY updated_at DESC LIMIT 50").bind(customer.id).all();
  const replies = await env.DB.prepare("SELECT r.id,r.ticket_id,r.author_type,r.message,r.created_at FROM support_replies r JOIN support_tickets t ON t.id=r.ticket_id WHERE t.customer_id=? AND r.is_internal=0 ORDER BY r.created_at").bind(customer.id).all();
  return Response.json({ tickets: tickets.results, replies: replies.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  const customer = await currentCustomer(request);
  if (!customer) return Response.json({ error: "ابتدا وارد حساب شوید" }, { status: 401 });
  let body: any; try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر" }, { status: 400 }); }
  const message = String(body.message || "").trim().slice(0, 4000), subject = String(body.subject || "").trim().slice(0, 160), ticketId = String(body.ticketId || "").slice(0, 80);
  if (message.length < 3) return Response.json({ error: "متن پیام را کامل وارد کنید" }, { status: 400 });
  if (!ticketId) {
    if (subject.length < 3) return Response.json({ error: "موضوع پیام را وارد کنید" }, { status: 400 });
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO support_tickets(id,customer_id,subject,message) VALUES(?,?,?,?)").bind(id, customer.id, subject, message),
      env.DB.prepare("INSERT INTO support_replies(id,ticket_id,author_type,author_id,message) VALUES(?,?,'customer',?,?)").bind(crypto.randomUUID(), id, customer.id, message)
    ]);
    return Response.json({ ok: true, id }, { status: 201 });
  }
  const ticket = await env.DB.prepare("SELECT id FROM support_tickets WHERE id=? AND customer_id=? AND status NOT IN ('resolved','closed')").bind(ticketId, customer.id).first<any>();
  if (!ticket) return Response.json({ error: "درخواست پیدا نشد یا بسته شده است" }, { status: 404 });
  await env.DB.batch([
    env.DB.prepare("INSERT INTO support_replies(id,ticket_id,author_type,author_id,message) VALUES(?,?,'customer',?,?)").bind(crypto.randomUUID(), ticketId, customer.id, message),
    env.DB.prepare("UPDATE support_tickets SET status='open',updated_at=CURRENT_TIMESTAMP,last_reply_at=CURRENT_TIMESTAMP WHERE id=?").bind(ticketId)
  ]);
  return Response.json({ ok: true });
}
