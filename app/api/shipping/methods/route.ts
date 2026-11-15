import { env } from "@/lib/runtime";

const defaults = [
  { code: "post_pishtaz", title: "پست پیشتاز", provider: "tapin", priceToman: 0, etaDays: 3 },
];

export async function GET() {
  try { const rows = await env.DB.prepare("SELECT code,title,provider,price_toman AS priceToman,free_over_toman AS freeOverToman,eta_days AS etaDays FROM shipping_methods WHERE active=1 ORDER BY price_toman").all(); return Response.json({ methods: rows.results.length ? rows.results : defaults }, { headers: { "Cache-Control": "public, max-age=300" } }); } catch { return Response.json({ methods: defaults }, { headers: { "Cache-Control": "public, max-age=300" } }); }
}
