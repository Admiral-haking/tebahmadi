import { env } from "@/lib/runtime";
import { paymentUpdateApplied } from "../../../../../lib/payment-operations";
import { getPaymentProvider } from "../../../../../lib/commerce-providers";

export async function GET(request: Request) {
  const url = new URL(request.url), orderId = String(url.searchParams.get("orderId") || "").slice(0, 80), authority = String(url.searchParams.get("Authority") || url.searchParams.get("authority") || "").slice(0, 120), status = String(url.searchParams.get("Status") || "");
  if (!orderId || !authority) return new Response("اطلاعات بازگشت درگاه ناقص است", { status: 400 });
  const order = await env.DB.prepare("SELECT id,subtotal_toman,customer_id,payment_status,payment_authority,status,items_json FROM orders WHERE id=?").bind(orderId).first<any>();
  if (!order) return new Response("سفارش پیدا نشد", { status: 404 });
  if (order.payment_status === "paid") return Response.redirect(`${url.origin}/track?id=${encodeURIComponent(orderId)}&payment=already-paid`, 303);
  if (order.payment_authority && order.payment_authority !== authority) return new Response("شناسه پرداخت با سفارش همخوانی ندارد", { status: 409 });
  if (status.toUpperCase() !== "OK") {
    const failed = await env.DB.prepare("UPDATE orders SET status=CASE WHEN status='pending' THEN 'cancelled' ELSE status END,payment_status='failed' WHERE id=? AND payment_status NOT IN ('paid','failed','refunded')").bind(orderId).run();
    if (failed.meta?.changes) {
      try {
        const items = JSON.parse(order.items_json || "[]");
        if (!Array.isArray(items) || items.length > 30 || items.some((item: any) => !String(item?.id || "") || !Number.isSafeInteger(Math.floor(Number(item?.quantity))) || Math.floor(Number(item.quantity)) < 1)) throw new Error("invalid_items");
        const stockUpdates = items.map((item: any) => { const quantity = Math.floor(Number(item.quantity)); return env.DB.prepare("UPDATE products SET stock=stock+? WHERE id=? AND stock+?<=100000").bind(quantity, String(item.id), quantity); });
        const ledgerEntries = items.map((item: any) => { const quantity = Math.floor(Number(item.quantity)); return env.DB.prepare("INSERT INTO inventory_movements(id,product_id,delta,reason,reference,actor) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), String(item.id), quantity, "آزادسازی رزرو پس از لغو پرداخت", orderId, "payment_callback"); });
        const results = await env.DB.batch([...stockUpdates, ...ledgerEntries]);
        const variantItems = items.filter((item: any) => String(item?.variantId || ""));
        if (variantItems.length) await env.DB.batch(variantItems.map((item: any) => { const quantity = Math.floor(Number(item.quantity)); return env.DB.prepare("UPDATE product_variants SET reserved_quantity=MAX(0,reserved_quantity-?) WHERE id=?").bind(quantity, String(item.variantId)); }));
        if (results.slice(0, items.length).some((result: any) => Number(result.meta?.changes || 0) !== 1)) throw new Error("stock_restore_failed");
        await env.DB.prepare("INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,?,?)").bind(crypto.randomUUID(), orderId, "cancelled", "پرداخت توسط کاربر لغو شد و موجودی رزروشده آزاد شد").run();
      } catch { await env.DB.prepare("INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,?,?)").bind(crypto.randomUUID(), orderId, "inventory_restore_failed", "پرداخت لغو شد اما آزادسازی موجودی نیازمند بررسی دستی است").run().catch(() => {}); }
    }
    return Response.redirect(`${url.origin}/track?id=${encodeURIComponent(orderId)}&payment=cancelled`, 303);
  }
  try {
    const adapterResult = await getPaymentProvider(env).verifyPayment({ orderId, authority, amountToman: Number(order.subtotal_toman) });
    const result = { ok: adapterResult.status === "paid", refId: adapterResult.reference || authority };
    if (!result.ok) { await env.DB.prepare("UPDATE orders SET payment_status='failed' WHERE id=? AND payment_status<>'paid'").bind(orderId).run(); return Response.redirect(`${url.origin}/track?id=${encodeURIComponent(orderId)}&payment=failed`, 303); }
    const updated=await env.DB.prepare("UPDATE orders SET status='paid',payment_status='paid',payment_reference=?,payment_verified_at=CURRENT_TIMESTAMP WHERE id=? AND payment_status<>'paid'").bind(result.refId || authority, orderId).run();
    if (!paymentUpdateApplied(updated.meta?.changes)) return Response.redirect(`${url.origin}/track?id=${encodeURIComponent(orderId)}&payment=already-paid`, 303);
    const invoice = `AH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${orderId.slice(0, 8).toUpperCase()}`;
    try {
      await env.DB.prepare("UPDATE orders SET invoice_number=? WHERE id=? AND invoice_number IS NULL").bind(invoice, orderId).run();
      await env.DB.prepare("INSERT INTO financial_entries(id,kind,category,amount_toman,description,reference,order_id) VALUES(?,'income','فروش سفارش',?,?,?,?)").bind(crypto.randomUUID(), Number(order.subtotal_toman), `وصول سفارش ${orderId}`, result.refId || authority, orderId).run();
      if (order.customer_id) {
        const points = Math.floor(Number(order.subtotal_toman) / 100000);
        if (points > 0) await env.DB.prepare("INSERT INTO loyalty_ledger(id,customer_id,order_id,points,reason) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM loyalty_ledger WHERE order_id=? AND reason='امتیاز خرید تاییدشده')").bind(crypto.randomUUID(), order.customer_id, orderId, points, "امتیاز خرید تاییدشده", orderId).run();
      }
    } catch { /* payment remains confirmed; financial reconciliation can repair auxiliary records */ }
    await env.DB.prepare("INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,'paid',?)").bind(crypto.randomUUID(), orderId, `پرداخت زرین‌پال تأیید شد؛ مرجع ${result.refId || authority}`).run();
    return Response.redirect(`${url.origin}/track?id=${encodeURIComponent(orderId)}&payment=success`, 303);
  } catch { return new Response("تأیید پرداخت موقتاً ناموفق بود؛ سفارش را دوباره بررسی کنید", { status: 502 }); }
}
