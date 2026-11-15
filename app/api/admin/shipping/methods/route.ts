import { env } from "@/lib/runtime";
import { getAdminIdentity, sameOrigin } from "../../auth";
import { normalizeShippingMethod } from "../../../../../lib/shipping-methods";
import { applySchemaMigrations } from "../../migrations";

export async function GET(request: Request) {
  const actor = await getAdminIdentity(request);
  if (!actor || !["owner", "admin", "manager"].includes(actor.role)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  try { await applySchemaMigrations(); } catch { return Response.json({ error: "ساختار روش‌های ارسال آماده نیست" }, { status: 503 }); }
  const rows = await env.DB.prepare("SELECT id,code,title,provider,price_toman AS priceToman,free_over_toman AS freeOverToman,eta_days AS etaDays,pricing_json AS pricingJson,settings_json AS settingsJson,active,created_at AS createdAt FROM shipping_methods ORDER BY active DESC,title").all();
  return Response.json({ methods: rows.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await getAdminIdentity(request);
  if (!actor || !["owner", "admin", "manager"].includes(actor.role)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "ورودی نامعتبر است" }, { status: 400 }); }
  const method = normalizeShippingMethod(body);
  if (!method) return Response.json({ error: "اطلاعات روش ارسال معتبر نیست" }, { status: 400 });
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO shipping_methods(id,code,title,provider,price_toman,free_over_toman,eta_days,pricing_json,settings_json,active) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .bind(id, method.code, method.title, method.provider, method.priceToman, method.freeOverToman, method.etaDays, method.pricingJson, method.settingsJson, method.active ? 1 : 0).run();
  } catch { return Response.json({ error: "کد روش ارسال تکراری است یا ذخیره انجام نشد" }, { status: 409 }); }
  return Response.json({ id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await getAdminIdentity(request);
  if (!actor || !["owner", "admin", "manager"].includes(actor.role)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "ورودی نامعتبر است" }, { status: 400 }); }
  const id = String(body.id ?? "").slice(0, 80);
  if (!id) return Response.json({ error: "شناسه روش ارسال لازم است" }, { status: 400 });
  const method = normalizeShippingMethod(body);
  if (!method) return Response.json({ error: "اطلاعات روش ارسال معتبر نیست" }, { status: 400 });
  const result = await env.DB.prepare("UPDATE shipping_methods SET code=?,title=?,provider=?,price_toman=?,free_over_toman=?,eta_days=?,pricing_json=?,settings_json=?,active=? WHERE id=?")
    .bind(method.code, method.title, method.provider, method.priceToman, method.freeOverToman, method.etaDays, method.pricingJson, method.settingsJson, method.active ? 1 : 0, id).run();
  if (!(result.meta?.changes || 0)) return Response.json({ error: "روش ارسال پیدا نشد" }, { status: 404 });
  return Response.json({ ok: true });
}
