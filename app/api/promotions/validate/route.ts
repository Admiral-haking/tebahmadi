import { env } from "@/lib/runtime";
import { calculateOrderTotals } from "../../../../lib/order-pricing";
import { validOrigin } from "../../customer/session";
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let b: any; try { b = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر" }, { status: 400 }); }
  const code = String(b.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32), items = Array.isArray(b.items) ? b.items.slice(0,30) : [];
  if (!code || !items.length) return Response.json({ error: "کد یا اقلام سبد نامعتبر است" }, { status: 400 });
  const p = await env.DB.prepare("SELECT id,title,kind,value,min_subtotal_toman,max_discount_toman FROM promotions WHERE code=? COLLATE NOCASE AND active=1 AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (ends_at IS NULL OR ends_at>=CURRENT_TIMESTAMP) AND (usage_limit IS NULL OR usage_count<usage_limit)").bind(code).first<any>();
  if (!p) return Response.json({ error: "کد تخفیف معتبر یا فعال نیست" }, { status: 404 });
  const ids=[...new Set(items.map((i:any)=>String(i.id||"").slice(0,80)))] as string[];if(!ids.length||ids.some((id:string)=>!id))return Response.json({error:"اقلام سبد نامعتبر است"},{status:400});
  const ph=ids.map(()=>"?").join(","),products=await env.DB.prepare("SELECT p.id,COALESCE(CAST(ROUND(p.price_toman*(100-cp.discount_percent)/100.0) AS INTEGER),p.price_toman) AS price FROM products p LEFT JOIN (SELECT x.product_id,MAX(x.discount_percent) AS discount_percent FROM campaign_products x JOIN campaigns c ON c.id=x.campaign_id WHERE c.active=1 AND (c.starts_at IS NULL OR c.starts_at<=CURRENT_TIMESTAMP) AND (c.ends_at IS NULL OR c.ends_at>=CURRENT_TIMESTAMP) GROUP BY x.product_id) cp ON cp.product_id=p.id WHERE p.active=1 AND p.id IN ("+ph+")").bind(...ids).all<any>();
  const priceMap=new Map(products.results.map(x=>[x.id,Number(x.price)]));let subtotal=0;for(const item of items){const qty=Math.floor(Number(item.quantity)),price=priceMap.get(String(item.id));if(price===undefined||!Number.isSafeInteger(qty)||qty<1||qty>20)return Response.json({error:"اقلام سبد نامعتبر است"},{status:400});subtotal+=price*qty;}
  const linked=await env.DB.prepare("SELECT product_id FROM promotion_products WHERE promotion_id=?").bind(p.id).all<any>(),allowed=new Set(linked.results.map(x=>x.product_id));const eligible=allowed.size?items.reduce((sum:number,item:any)=>allowed.has(String(item.id))?sum+priceMap.get(String(item.id))!*Math.floor(Number(item.quantity)):sum,0):subtotal;
  if (eligible < Number(p.min_subtotal_toman)) return Response.json({ error: "حداقل مبلغ سبد محصولات واجد شرایط برای این کد تأمین نشده است" }, { status: 400 });
  const totals = calculateOrderTotals({
    lines: items.map((item: any) => ({ id: String(item.id), priceToman: priceMap.get(String(item.id))!, quantity: Math.floor(Number(item.quantity)) })),
    promotion: { kind: p.kind, value: Number(p.value), maxDiscountToman: p.max_discount_toman === null ? null : Number(p.max_discount_toman), eligibleProductIds: allowed.size ? [...allowed].map(String) : [] },
    shipping: { priceToman: 0, freeOverToman: null },
  });
  return Response.json({ ok: true, title: p.title, discountToman: totals.discountToman }, { headers: { "Cache-Control": "no-store" } });
}
