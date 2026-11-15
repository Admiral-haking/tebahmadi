import { env } from "@/lib/runtime";
import { getShippingProvider } from "../../../../../lib/commerce-providers";
import { validOrigin } from "../../../customer/session";

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  const now = Date.now(), ip = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    const limit = await env.DB.prepare("INSERT INTO rate_limits(bucket,count,reset_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<=? THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<=? THEN excluded.reset_at ELSE rate_limits.reset_at END RETURNING count,reset_at").bind(`shipping-quote:${ip}`, now + 60_000, now, now).first<any>();
    if (Number(limit?.count || 0) > 30) return Response.json({ error: "تعداد استعلام ارسال زیاد است؛ کمی بعد دوباره تلاش کنید" }, { status: 429, headers: { "Retry-After": String(Math.ceil((Number(limit.reset_at) - now) / 1000)) } });
  } catch { return Response.json({ error: "سامانهٔ استعلام ارسال موقتاً آماده نیست" }, { status: 503 }); }
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const provinceCode = Number(body.provinceCode), cityCode = Number(body.cityCode), weightGrams = Number(body.weightGrams);
  if (!Number.isSafeInteger(provinceCode) || provinceCode < 1 || !Number.isSafeInteger(cityCode) || cityCode < 1 || !Number.isSafeInteger(weightGrams) || weightGrams < 50 || weightGrams > 30_000) return Response.json({ error: "استان، شهر و وزن مرسوله را بررسی کنید" }, { status: 400 });
  try {
    const quotes = await getShippingProvider(env).quote({ postalCode: String(body.postalCode || ""), provinceCode, cityCode, weightGrams });
    return Response.json({ provider: env.SHIPPING_PROVIDER || "unconfigured", quotes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "استعلام ارسال ناموفق بود؛ وضعیت اتصال سرویس را بررسی کنید" }, { status: 502 }); }
}
