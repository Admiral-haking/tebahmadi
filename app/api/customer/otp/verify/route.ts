import { env } from "@/lib/runtime";
import { createCustomerSession, normalizePhone, phoneValid, validOrigin } from "../../session";
import { normalizeOtp } from "@/lib/input-normalization";

const enc = new TextEncoder();
async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const phone = normalizePhone(String(body.phone || ""));
  const code = normalizeOtp(body.code);
  if (!phoneValid(phone) || code.length !== 4) return Response.json({ error: "شماره همراه یا کد ۴ رقمی معتبر نیست" }, { status: 400 });
  const otp = await env.DB.prepare("SELECT code_hash,expires_at,attempts FROM login_otps WHERE phone=?").bind("customer:"+phone).first<any>();
  if (!otp || Number(otp.expires_at) < Date.now() || Number(otp.attempts) >= 5) return Response.json({ error: "کد منقضی شده یا بیش از حد تلاش شده است؛ کد تازه بگیرید" }, { status: 401 });
  const actual = await hash(phone + ":" + code + ":" + (env.OTP_PEPPER || env.ADMIN_SESSION_SECRET || ""));
  if (!constantTimeEqual(String(otp.code_hash), actual)) {
    await env.DB.prepare("UPDATE login_otps SET attempts=attempts+1 WHERE phone=?").bind("customer:"+phone).run();
    const remaining = Math.max(0, 5 - Number(otp.attempts) - 1);
    return Response.json({ error: remaining ? `کد ورود نادرست است؛ ${remaining} تلاش باقی مانده` : "کد ورود نادرست است؛ کد تازه بگیرید" }, { status: 401 });
  }
  await env.DB.prepare("DELETE FROM login_otps WHERE phone=?").bind("customer:"+phone).run();
  const customer = await env.DB.prepare("SELECT id,name,phone FROM customers WHERE phone=?").bind(phone).first<any>();
  let customerId = customer?.id as string | undefined;
  if (!customerId) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (name.length < 2) {
      await env.DB.prepare("INSERT INTO login_otps(phone,code_hash,expires_at,attempts,resend_after) VALUES(?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=excluded.attempts,resend_after=excluded.resend_after").bind("customer:"+phone, otp.code_hash, otp.expires_at, otp.attempts, Date.now()+60_000).run();
      return Response.json({ needsName: true, error: "برای ساخت حساب، نام و نام خانوادگی را وارد کنید" }, { status: 400 });
    }
    customerId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO customers(id,phone,name,password_hash,last_seen_at) VALUES(?,?,?,'otp',CURRENT_TIMESTAMP)").bind(customerId, phone, name).run();
  } else await env.DB.prepare("UPDATE customers SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(customerId).run();
  const profile=await env.DB.prepare("SELECT id,name,phone,email,marketing_consent FROM customers WHERE id=?").bind(customerId).first<any>();
  const cookie = await createCustomerSession(customerId);
  return Response.json({ customer: profile }, { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
}
