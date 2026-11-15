import { env } from "@/lib/runtime";
import { normalizePhone } from "@/lib/input-normalization";
export async function GET(request:Request){
  const u=new URL(request.url),id=(u.searchParams.get("id")||"").trim().slice(0,60);
  const phone=normalizePhone(u.searchParams.get("phone")||"");
  if(!id||phone.length<10)return Response.json({error:"کد سفارش و شماره موبایل لازم است"},{status:400});
  try{
    const now=Date.now(),ip=request.headers.get("CF-Connecting-IP")||"unknown",bucket=`order-status:${ip}`;
    const limit=await env.DB.prepare("INSERT INTO rate_limits(bucket,count,reset_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<=? THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<=? THEN excluded.reset_at ELSE rate_limits.reset_at END RETURNING count,reset_at").bind(bucket,now+60_000,now,now).first<any>();
    if(Number(limit?.count)>30)return Response.json({error:"تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید"},{status:429,headers:{"Retry-After":String(Math.ceil((Number(limit.reset_at)-now)/1000))}});
    const o=await env.DB.prepare("SELECT o.id,o.phone,o.items_json,o.subtotal_toman,o.status,o.payment_status,o.shipping_method,o.shipping_status,COALESCE(o.tracking_code,s.tracking_code) AS tracking_code,o.created_at FROM orders o LEFT JOIN shipments s ON s.order_id=o.id WHERE o.id=?").bind(id).first<any>();
    if(!o||normalizePhone(o.phone)!==phone)return Response.json({error:"سفارش با این مشخصات پیدا نشد"},{status:404});
    const events=await env.DB.prepare("SELECT status,note,created_at FROM order_events WHERE order_id=? ORDER BY created_at ASC LIMIT 50").bind(id).all();
    const shipmentEvents=await env.DB.prepare("SELECT se.status,se.provider_status,se.tracking_code,se.message,se.created_at FROM shipment_events se JOIN shipments s ON s.id=se.shipment_id WHERE s.order_id=? ORDER BY se.created_at ASC LIMIT 50").bind(id).all().catch(()=>({results:[]}));
    let items: unknown[] = [];
    try { const parsed = JSON.parse(o.items_json || "[]"); if (Array.isArray(parsed)) items = parsed; } catch { /* tolerate legacy malformed order payloads */ }
    return Response.json({order:{id:o.id,items,subtotalToman:o.subtotal_toman,status:o.status,paymentStatus:o.payment_status,shippingMethod:o.shipping_method,shippingStatus:o.shipping_status,trackingCode:o.tracking_code,createdAt:o.created_at,events:events.results,shipmentEvents:shipmentEvents.results}},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"پیگیری سفارش موقتاً در دسترس نیست"},{status:503});}
}
