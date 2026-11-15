import { env } from "@/lib/runtime";
import { isAdmin, sameOrigin } from "../auth";
import { recordAudit } from "../login/audit";
const localSqlTime=(value:any,end=false)=>{if(!value)return null;const raw=String(value).trim().replace("T"," ").replace(/Z$/i,"");if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw))return null;return raw.length===16?raw+(end?":59":":00"):raw};

export async function GET(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const rows = await env.DB.prepare("SELECT c.id,c.title,c.description,c.starts_at,c.ends_at,c.active,c.created_at,COUNT(cp.product_id) AS products FROM campaigns c LEFT JOIN campaign_products cp ON cp.campaign_id=c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100").all();
  return Response.json({ campaigns: rows.results }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(request:Request){if(!await isAdmin(request))return Response.json({error:"دسترسی مجاز نیست"},{status:401});if(!sameOrigin(request))return Response.json({error:"مبدأ درخواست معتبر نیست"},{status:403});const id=new URL(request.url).searchParams.get("id")||"";const r=await env.DB.prepare("UPDATE campaigns SET active=0 WHERE id=?").bind(id.slice(0,80)).run();if(r.meta?.changes)await recordAudit(request,"campaign.archive","campaign",id);return Response.json({ok:(r.meta?.changes||0)>0})}
export async function POST(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let b: any; try { b = await request.json(); } catch { return Response.json({ error: "ورودی نامعتبر" }, { status: 400 }); }
  const title=String(b.title||"").trim().slice(0,120),description=String(b.description||"").slice(0,600),items=Array.isArray(b.products)?b.products.slice(0,100):[];
  if(title.length<2||!items.length||items.some((x:any)=>!x.id||!Number.isInteger(Number(x.discountPercent))||Number(x.discountPercent)<1||Number(x.discountPercent)>90))return Response.json({error:"عنوان و محصولات با تخفیف ۱ تا ۹۰ درصد لازم است"},{status:400});
  const id=crypto.randomUUID();
  const startsAt=localSqlTime(b.startsAt),endsAt=localSqlTime(b.endsAt,true);if(b.startsAt&&!startsAt||b.endsAt&&!endsAt)return Response.json({error:"تاریخ شروع یا پایان نامعتبر است"},{status:400});
  try{await env.DB.prepare("INSERT INTO campaigns(id,title,description,starts_at,ends_at,active) VALUES(?,?,?,?,?,?)").bind(id,title,description,startsAt,endsAt,b.active===false?0:1).run();for(const x of items)await env.DB.prepare("INSERT INTO campaign_products(campaign_id,product_id,discount_percent) SELECT ?,id,? FROM products WHERE id=?").bind(id,Number(x.discountPercent),String(x.id).slice(0,80)).run();await recordAudit(request,"campaign.create","campaign",id,title);return Response.json({id},{status:201})}catch{return Response.json({error:"ثبت جشنواره انجام نشد"},{status:400})}
}
export async function PATCH(request:Request){if(!await isAdmin(request))return Response.json({error:"دسترسی مجاز نیست"},{status:401});if(!sameOrigin(request))return Response.json({error:"مبدأ درخواست معتبر نیست"},{status:403});let b:any;try{b=await request.json()}catch{return Response.json({error:"ورودی نامعتبر"},{status:400})}if(!b.id||typeof b.active!=="boolean")return Response.json({error:"درخواست نامعتبر"},{status:400});const r=await env.DB.prepare("UPDATE campaigns SET active=? WHERE id=?").bind(b.active?1:0,String(b.id).slice(0,80)).run();if(r.meta?.changes)await recordAudit(request,"campaign.toggle","campaign",String(b.id),String(b.active));return Response.json({ok:(r.meta?.changes||0)>0})}
