import { env } from "@/lib/runtime";
import { isAdmin, sameOrigin } from "../auth";
import { recordAudit } from "../login/audit";
const localSqlTime=(value:any,end=false)=>{if(!value)return null;const raw=String(value).trim().replace("T"," ").replace(/Z$/i,"");if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw))return null;return raw.length===16?raw+(end?":59":":00"):raw};

export async function GET(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const promos = await env.DB.prepare("SELECT p.*,COUNT(pp.product_id) AS products FROM promotions p LEFT JOIN promotion_products pp ON pp.promotion_id=p.id GROUP BY p.id ORDER BY p.created_at DESC LIMIT 200").all();
  return Response.json({ promotions: promos.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let b: any; try { b = await request.json(); } catch { return Response.json({ error: "ورودی نامعتبر" }, { status: 400 }); }
  const title = String(b.title || "").trim().slice(0, 120), code = String(b.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32), kind = String(b.kind || ""), value = Math.floor(Number(b.value)), min = Math.floor(Number(b.minSubtotal || 0)), cap = b.maxDiscount === "" || b.maxDiscount == null ? null : Math.floor(Number(b.maxDiscount)), usage = b.usageLimit === "" || b.usageLimit == null ? null : Math.floor(Number(b.usageLimit));
  if (title.length < 2 || code.length < 3 || !["percent", "fixed", "shipping"].includes(kind) || !Number.isSafeInteger(value) || value < 0 || kind === "percent" && (value < 1 || value > 90) || kind === "fixed" && value < 1 || kind === "shipping" && value !== 0 || !Number.isSafeInteger(min) || min < 0 || cap !== null && (!Number.isSafeInteger(cap) || cap < 1) || usage !== null && (!Number.isSafeInteger(usage) || usage < 1)) return Response.json({ error: "اطلاعات تخفیف معتبر نیست" }, { status: 400 });
  const id = crypto.randomUUID();
  try {
    const startsAt=localSqlTime(b.startsAt),endsAt=localSqlTime(b.endsAt,true);if(b.startsAt&&!startsAt||b.endsAt&&!endsAt)return Response.json({error:"تاریخ شروع یا پایان نامعتبر است"},{status:400});
    await env.DB.prepare("INSERT INTO promotions(id,code,title,kind,value,min_subtotal_toman,max_discount_toman,starts_at,ends_at,usage_limit,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(id, code, title, kind, value, min, cap, startsAt, endsAt, usage, b.active === false ? 0 : 1).run();
    for (const productId of Array.isArray(b.productIds) ? b.productIds.slice(0, 100) : []) await env.DB.prepare("INSERT OR IGNORE INTO promotion_products(promotion_id,product_id) SELECT ?,id FROM products WHERE id=?").bind(id, String(productId).slice(0, 80)).run();
    await recordAudit(request,"promotion.create","promotion",id,code);
    return Response.json({ id }, { status: 201 });
  } catch { return Response.json({ error: "ثبت کد تخفیف انجام نشد؛ احتمالاً کد تکراری است" }, { status: 409 }); }
}

export async function PATCH(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let b: any; try { b = await request.json(); } catch { return Response.json({ error: "ورودی نامعتبر" }, { status: 400 }); }
  const id = String(b.id || "").slice(0, 80); if (!id || typeof b.active !== "boolean") return Response.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  const r = await env.DB.prepare("UPDATE promotions SET active=? WHERE id=?").bind(b.active ? 1 : 0, id).run();
  if (r.meta?.changes) await recordAudit(request,"promotion.toggle","promotion",id,String(b.active));
  return Response.json({ ok: (r.meta?.changes || 0) > 0 });
}

export async function DELETE(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const r = await env.DB.prepare("UPDATE promotions SET active=0 WHERE id=?").bind(id.slice(0, 80)).run();
  return Response.json({ ok: (r.meta?.changes || 0) > 0 });
}
