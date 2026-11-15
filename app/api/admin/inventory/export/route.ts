import { env } from "@/lib/runtime";
import { hasAdminRole } from "../../auth";
import { csvEscape } from "../../../../../lib/order-operations";

const isAdmin = (request: Request) => hasAdminRole(request, ["owner", "admin", "manager"]);

export async function GET(request: Request) {
  if (!await isAdmin(request)) return Response.json({ error: "دسترسی مجاز نیست" }, { status: 401 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from"), to = url.searchParams.get("to");
  const valid = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const range = valid(from) && valid(to) && from! <= to! ? " AND date(m.created_at) BETWEEN date(?) AND date(?)" : "";
  const args = range ? [from!, to!] : [];
  const rows = await env.DB.prepare(`SELECT m.id,m.created_at,m.product_id,p.sku,p.name,m.delta,m.reason,m.reference,m.actor,p.stock AS current_stock FROM inventory_movements m JOIN products p ON p.id=m.product_id WHERE 1=1${range} ORDER BY m.created_at DESC LIMIT 10000`).bind(...args).all<any>();
  const header = ["movement_id", "created_at", "product_id", "sku", "product_name", "delta", "reason", "reference", "actor", "current_stock"];
  const csv = "\uFEFF" + [header, ...rows.results.map((row: any) => header.map((key) => row[key]))].map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="tab-ahmadi-inventory-ledger.csv"', "Cache-Control": "no-store" } });
}
