import { env } from "@/lib/runtime";
import { normalizePhone, phoneValid, validOrigin } from "../../session";
import { sendOtpSms } from "../../../../../lib/sms-provider";

const enc = new TextEncoder();
async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "مبدأ درخواست معتبر نیست" }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const phone = normalizePhone(String(body.phone || ""));
  if (!phoneValid(phone)) return Response.json({ error: "شماره همراه معتبر وارد کنید" }, { status: 400 });
  const now = Date.now();
  const scopedPhone="customer:"+phone;try { const ip=request.headers.get("CF-Connecting-IP")||"unknown",bucket="otp:"+ip,limit=await env.DB.prepare("INSERT INTO rate_limits(bucket,count,reset_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<=? THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<=? THEN excluded.reset_at ELSE rate_limits.reset_at END RETURNING count,reset_at").bind(bucket,now+10*60_000,now,now).first<any>();if(Number(limit?.count)>10)return Response.json({error:"درخواست‌های پیامک زیاد است؛ کمی بعد دوباره تلاش کنید"},{status:429,headers:{"Retry-After":String(Math.ceil((Number(limit.reset_at)-now)/1000))}});const prior = await env.DB.prepare("SELECT resend_after FROM login_otps WHERE phone=?").bind(scopedPhone).first<any>();
  if (prior && Number(prior.resend_after) > now) return Response.json({ error: "برای دریافت کد جدید کمی صبر کنید" }, { status: 429, headers: { "Retry-After": String(Math.ceil((Number(prior.resend_after) - now) / 1000)) } }); } catch { return Response.json({ error: "پایگاه دادهٔ ورود هنوز آماده نیست" }, { status: 503 }); }
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, "0");
  const saved = await env.DB.prepare("INSERT INTO login_otps(phone,code_hash,expires_at,attempts,resend_after) VALUES(?,?,?,0,?) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,resend_after=excluded.resend_after,created_at=CURRENT_TIMESTAMP WHERE login_otps.resend_after<=?")
    .bind(scopedPhone, await hash(phone + ":" + code + ":" + (env.OTP_PEPPER || env.ADMIN_SESSION_SECRET || "")), now + 5 * 60_000, now + 60_000, now).run();
  if (!(saved.meta?.changes || 0)) return Response.json({ error: "برای دریافت کد جدید کمی صبر کنید" }, { status: 429 });
  const localMock = env.SMS_PROVIDER === "mock" && ["local", "test"].includes(String(env.APP_ENV || "").toLowerCase());
  if (localMock) return Response.json({ ok: true, devCode: code, message: "کد ورود local ایجاد شد." }, { headers: { "Cache-Control": "no-store" } });
  if (!env.SMS_IR_API_KEY || !env.SMS_IR_TEMPLATE_ID) return Response.json({ error: "سرویس پیامک هنوز پیکربندی نشده است؛ کد ارسال نشد" }, { status: 503 });
  try { await sendOtpSms(env, phone, code); } catch { await env.DB.prepare("DELETE FROM login_otps WHERE phone=?").bind(scopedPhone).run(); return Response.json({ error: "ارتباط با سرویس پیامک برقرار نشد" }, { status: 502 }); }
  return Response.json({ ok: true, message: "کد ورود ارسال شد. تا ۵ دقیقه معتبر است." }, { headers: { "Cache-Control": "no-store" } });
}
