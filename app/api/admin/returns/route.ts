import { applySchemaMigrations } from "../migrations";
import { env } from "@/lib/runtime";
import { getAdminIdentity, sameOrigin } from "../auth";
import { recordAudit } from "../login/audit";
import { canTransitionReturn, isReturnStatus, returnRequiresRefundRole } from "../../../../lib/return-state-machine";
import { getPaymentProvider } from "../../../../lib/commerce-providers";
import { completeRefund, failRefund, reserveRefund } from "../../../../lib/refund-operations";

export async function GET(request: Request) {
  try { await applySchemaMigrations(); } catch { return Response.json({ error: "سامانهٔ مرجوعی هنوز آماده نشده است" }, { status: 503 }); }
  const user = await getAdminIdentity(request);
  if (!user || !["owner", "admin", "manager", "support"].includes(user.role)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const rows = await env.DB.prepare("SELECT r.*,o.subtotal_toman,o.status order_status,o.customer_name,o.phone FROM return_requests r JOIN orders o ON o.id=r.order_id ORDER BY r.created_at DESC LIMIT 200").all<any>();
  return Response.json({ returns: rows.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  try { await applySchemaMigrations(); } catch { return Response.json({ error: "سامانهٔ مرجوعی هنوز آماده نشده است" }, { status: 503 }); }
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  const user = await getAdminIdentity(request);
  if (!user || !["owner", "admin", "manager"].includes(user.role)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر" }, { status: 400 }); }
  const id = String(body.id || "").slice(0, 80);
  const nextStatus = String(body.status || "");
  if (!isReturnStatus(nextStatus) || nextStatus === "requested") return Response.json({ error: "وضعیت نامعتبر" }, { status: 400 });
  const row = await env.DB.prepare("SELECT r.*,o.status order_status,o.subtotal_toman,o.payment_status,o.payment_reference FROM return_requests r JOIN orders o ON o.id=r.order_id WHERE r.id=?").bind(id).first<any>();
  if (!row) return Response.json({ error: "درخواست مرجوعی پیدا نشد" }, { status: 404 });
  if (!canTransitionReturn(row.status, nextStatus)) return Response.json({ error: "تغییر وضعیت با گردش مرجوعی سازگار نیست" }, { status: 409 });
  if (returnRequiresRefundRole(nextStatus, user.role)) return Response.json({ error: "ثبت عودت وجه فقط برای مالک یا مدیر سامانه مجاز است" }, { status: 403 });
  if (nextStatus === "refunded") {
    if (row.payment_status !== "paid" || !row.payment_reference) return Response.json({ error: "این سفارش مرجع پرداخت قابل عودت ندارد" }, { status: 409 });
    const reservation = await reserveRefund(env.DB, row.order_id);
    if (reservation.kind === "in_progress") return Response.json({ error: "عملیات عودت این سفارش در حال انجام است" }, { status: 409 });
    if (reservation.kind === "reserved") try {
      const refund = await getPaymentProvider(env).refund(row.order_id, String(row.payment_reference));
      if (refund.status !== "refunded") { await failRefund(env.DB, reservation.id, "provider_rejected"); return Response.json({ error: "درگاه عودت وجه را تأیید نکرد؛ سند مالی ثبت نشد" }, { status: 502 }); }
      await completeRefund(env.DB, reservation.id, refund.reference || String(row.payment_reference));
    } catch { await failRefund(env.DB, reservation.id, "provider_error"); return Response.json({ error: "اتصال درگاه برای عودت وجه آماده نیست؛ سند مالی ثبت نشد" }, { status: 502 }); }
  }
  const changed = await env.DB.prepare("UPDATE return_requests SET status=?,restock=CASE WHEN ?=1 THEN 1 ELSE restock END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?").bind(nextStatus, body.restock === true ? 1 : 0, id, row.status).run();
  if (Number(changed.meta?.changes || 0) !== 1) return Response.json({ error: "درخواست هم‌زمان توسط کاربر دیگری تغییر کرده است" }, { status: 409 });
  if (nextStatus === "received" && body.restock === true) {
    try {
      const order = await env.DB.prepare("SELECT items_json FROM orders WHERE id=?").bind(row.order_id).first<any>();
      const items = JSON.parse(order?.items_json || "[]");
      if (!Array.isArray(items) || items.length > 30 || items.some((item: any) => !Number.isSafeInteger(Math.floor(Number(item.quantity))) || Math.floor(Number(item.quantity)) < 1 || Math.floor(Number(item.quantity)) > 100000 || !String(item.id || ""))) throw new Error("invalid_items");
      const results = await env.DB.batch(items.map((item: any) => { const quantity = Math.floor(Number(item.quantity)); return env.DB.prepare("UPDATE products SET stock=stock+? WHERE id=? AND stock+?<=100000").bind(quantity, String(item.id), quantity); }));
      if (results.some((result: any) => Number(result.meta?.changes || 0) !== 1)) {
        await env.DB.batch(items.map((item: any, index: number) => Number(results[index]?.meta?.changes || 0) === 1
          ? env.DB.prepare("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?").bind(Math.floor(Number(item.quantity)), String(item.id), Math.floor(Number(item.quantity)))
          : env.DB.prepare("SELECT 1")));
        throw new Error("stock_update_failed");
      }
      for (const item of items) {
        const quantity = Math.floor(Number(item.quantity));
        await env.DB.prepare("INSERT INTO inventory_movements(id,product_id,delta,reason,reference,actor) VALUES(?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), String(item.id), quantity, "بازگشت کالا از مرجوعی", id, user.id).run();
      }
    } catch {
      await env.DB.prepare("DELETE FROM inventory_movements WHERE reference=?").bind(id).run().catch(() => {});
      await env.DB.prepare("UPDATE return_requests SET status=?,restock=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?").bind(row.status, row.restock || 0, id, nextStatus).run();
      return Response.json({ error: "بازگردانی موجودی ناموفق بود؛ هیچ قلمی تغییر داده نشد" }, { status: 409 });
    }
  }
  if (nextStatus === "refunded") {
    await env.DB.prepare("UPDATE orders SET status='refunded',payment_status='refunded' WHERE id=? AND status NOT IN ('cancelled','refunded')").bind(row.order_id).run();
    await env.DB.prepare("INSERT OR IGNORE INTO financial_entries(id,kind,category,amount_toman,description,reference,order_id,created_by) VALUES(?,'expense','عودت وجه',?,?,?, ?,?)").bind(crypto.randomUUID(), row.subtotal_toman, "عودت سفارش " + row.order_id, id, row.order_id, user.id).run();
  }
  await recordAudit(request, "return.status", "return_request", id, nextStatus);
  return Response.json({ ok: true });
}
