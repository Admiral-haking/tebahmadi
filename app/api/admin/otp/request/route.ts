import { env } from "@/lib/runtime";
import { normalizePhone, phoneValid, validOrigin } from "../../../customer/session";
import { sendOtpSms } from "../../../../../lib/sms-provider";
const enc = new TextEncoder();
async function hash(v:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v)))].map(x=>x.toString(16).padStart(2,"0")).join("")}
export async function POST(request:Request){
  if(!validOrigin(request))return Response.json({error:"مبدأ درخواست معتبر نیست"},{status:403});
  let b:any;try{b=await request.json()}catch{return Response.json({error:"درخواست نامعتبر"},{status:400})}
  const phone=normalizePhone(String(b.phone||""));if(!phoneValid(phone))return Response.json({error:"شماره همراه معتبر وارد کنید"},{status:400});
  let admin:any;try{admin=await env.DB.prepare("SELECT id FROM admin_users WHERE phone=? AND active=1").bind(phone).first<any>()}catch{return Response.json({error:"سامانهٔ ورود کارکنان آماده نیست"},{status:503})}
  if(!admin)return Response.json({ok:true,message:"اگر شماره به حساب فعال کارکنان متصل باشد، کد ارسال می‌شود."},{headers:{"Cache-Control":"no-store"}});
  const now=Date.now(),ip=request.headers.get("CF-Connecting-IP")||"unknown",bucket="adminotp:"+ip;
  const limit=await env.DB.prepare("INSERT INTO rate_limits(bucket,count,reset_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<=? THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<=? THEN excluded.reset_at ELSE rate_limits.reset_at END RETURNING count,reset_at").bind(bucket,now+10*60_000,now,now).first<any>().catch(()=>null);
  if(!limit)return Response.json({error:"سامانهٔ ورود هنوز آماده نیست"},{status:503});if(Number(limit.count)>8)return Response.json({error:"تلاش زیاد است؛ کمی بعد دوباره امتحان کنید"},{status:429});
  const prior=await env.DB.prepare("SELECT resend_after FROM login_otps WHERE phone=?").bind("staff:"+phone).first<any>();if(prior&&Number(prior.resend_after)>now)return Response.json({error:"برای دریافت کد تازه کمی صبر کنید"},{status:429});
  const localMock = env.SMS_PROVIDER === "mock" && ["local", "test"].includes(String(env.APP_ENV || "").toLowerCase());
  if(!localMock && (!env.SMS_IR_API_KEY||!env.SMS_IR_TEMPLATE_ID))return Response.json({error:"سرویس پیامک هنوز پیکربندی نشده است"},{status:503});
  const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,"0"),key=env.OTP_PEPPER||env.ADMIN_SESSION_SECRET||"";
  await env.DB.prepare("INSERT INTO login_otps(phone,code_hash,expires_at,attempts,resend_after) VALUES(?,?,?,0,?) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,resend_after=excluded.resend_after").bind("staff:"+phone,await hash("admin:"+phone+":"+code+":"+key),now+5*60_000,now+60_000).run();
  if(!localMock){try{await sendOtpSms(env,phone,code)}catch{await env.DB.prepare("DELETE FROM login_otps WHERE phone=?").bind("staff:"+phone).run();return Response.json({error:"ارسال پیامک ناموفق بود"},{status:502})}}
  return Response.json({ok:true,message:"کد ورود ارسال شد و تا ۵ دقیقه اعتبار دارد",...(localMock?{devCode:code}: {})},{headers:{"Cache-Control":"no-store"}});
}
