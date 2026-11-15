import { env } from "@/lib/runtime";
import { isAdmin } from "../../auth";
import { csvEscape } from "../../../../../lib/order-operations";

export async function GET(request: Request) {
  if (!await isAdmin(request)) return new Response("دسترسی مجاز نیست", { status: 401 });
  const rows = await env.DB.prepare("SELECT code,title,kind,value,min_subtotal_toman,usage_count,usage_limit,active,starts_at,ends_at,created_at FROM promotions ORDER BY created_at DESC LIMIT 5000").all();
  const header = ["code", "title", "kind", "value", "min_subtotal_toman", "usage_count", "usage_limit", "active", "starts_at", "ends_at", "created_at"];
  const csv = "\uFEFF" + [header, ...rows.results.map((row: any) => header.map((key) => row[key]))].map((line) => line.map(csvEscape).join(",")).join("\r\n") + "\r\n";
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=tab-ahmadi-promotions.csv", "Cache-Control": "no-store" } });
}
