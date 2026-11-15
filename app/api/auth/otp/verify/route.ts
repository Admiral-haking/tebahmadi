import { env } from "@/lib/runtime";
import { POST as customerOtp } from "../../../customer/otp/verify/route";
import { POST as adminOtp } from "../../../admin/otp/verify/route";
import { normalizePhone } from "../../../customer/session";

export async function POST(request: Request) {
  let body: any;
  try { body = await request.clone().json(); } catch { return Response.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const phone = normalizePhone(String(body.phone || ""));
  let staff = false;
  try { staff = !!(await env.DB.prepare("SELECT id FROM admin_users WHERE phone=? AND active=1").bind(phone).first()); } catch { return Response.json({ error: "سامانهٔ ورود آماده نیست" }, { status: 503 }); }
  return staff ? adminOtp(request) : customerOtp(request);
}
