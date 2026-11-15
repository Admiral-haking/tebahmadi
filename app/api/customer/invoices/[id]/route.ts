import { env } from "@/lib/runtime";
import { currentCustomer } from "../../session";
import { safeJsonArrayString } from "@/lib/safe-json";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]!));
const money = (value: unknown) => new Intl.NumberFormat("fa-IR").format(Number(value) || 0);
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const customer = await currentCustomer(request);
  if (!customer) return new Response("ابتدا وارد حساب شوید", {status:401,headers:{"Cache-Control":"no-store"}});
  const {id} = await params;
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=? AND customer_id=?").bind(id.slice(0,80),customer.id).first<any>();
  if (!order) return new Response("سفارش پیدا نشد", {status:404,headers:{"Cache-Control":"no-store"}});
  const items = JSON.parse(safeJsonArrayString(order.items_json));
  const rows = items.map((item:any) => `<tr><td>${escape(item.name)}<small>${escape(item.variantTitle)} ${escape(item.sku)}</small></td><td>${money(item.quantity)}</td><td>${money(item.priceToman)}</td><td>${money(Number(item.quantity)*Number(item.priceToman))}</td></tr>`).join("");
  return new Response(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>صورتحساب طب احمدی</title><style>body{font:14px Tahoma;max-width:850px;margin:24px auto;padding:20px;color:#213d29}header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #358246}img{width:70px;border-radius:50%}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:right;border-bottom:1px solid #ddd}small{display:block}button{padding:12px;margin:20px 0}@media print{button{display:none}}</style></head><body><header><img src="/tebahmadi-logo.jpeg" alt="طب احمدی"><h1>صورتحساب سفارش</h1></header><p>شماره: ${escape(order.invoice_number||order.id)}</p><p>${escape(order.customer_name)} — ${escape(order.phone)}</p><p>${escape(order.address)} — ${escape(order.postal_code)}</p><table><thead><tr><th>کالا و مدل</th><th>تعداد</th><th>قیمت واحد (تومان)</th><th>جمع (تومان)</th></tr></thead><tbody>${rows}</tbody></table><p>تخفیف: ${money(order.discount_toman)} تومان</p><p>ارسال: ${money(order.shipping_toman)} تومان</p><h2>مبلغ سفارش: ${money(order.subtotal_toman)} تومان</h2><p>${order.payment_status==='paid'?'پرداخت تأیید شده است':'این صورتحساب به معنای تأیید پرداخت نیست.'}</p><button onclick="window.print()">چاپ یا ذخیره PDF</button></body></html>`,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
