import { env } from "@/lib/runtime";
import { isAdmin } from "../../auth";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  if (!await isAdmin(request)) return new Response("دسترسی مجاز نیست", { status: 401 });
  const rows = await env.DB.prepare(`
    SELECT c.id, c.name, c.phone, c.email, c.marketing_consent, c.created_at,
      COUNT(DISTINCT o.id) AS orders,
      COALESCE(SUM(CASE WHEN o.status IN ('paid','processing','shipped','delivered') THEN o.subtotal_toman ELSE 0 END), 0) AS lifetime_value,
      MAX(o.created_at) AS last_order_at,
      GROUP_CONCAT(DISTINCT t.name) AS tags
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    LEFT JOIN customer_tag_assignments a ON a.customer_id = c.id
    LEFT JOIN customer_tags t ON t.id = a.tag_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT 10000
  `).all<any>();
  const header = ["id", "name", "phone", "email", "marketing_consent", "orders", "lifetime_value_toman", "last_order_at", "tags", "created_at"];
  const csv = "\uFEFF" + [header, ...rows.results.map((row: any) => header.map((key) => csvCell(row[key])))]
    .map((line) => line.join(","))
    .join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=tab-ahmadi-customers.csv",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
