import { env } from "@/lib/runtime";
import { hasAdminRole, sameOrigin } from "../auth";
import { recordAudit } from "../login/audit";
import { applySchemaMigrations } from "../migrations";

export async function GET(request:Request){if(!await hasAdminRole(request,["owner"]))return Response.json({error:"دسترسی مجاز نیست"},{status:401});try{await applySchemaMigrations();const rows=await env.DB.prepare("SELECT id FROM schema_migrations ORDER BY id").all<any>();return Response.json({applied:rows.results.map(x=>x.id)},{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({error:"وضعیت مهاجرت پایگاه داده در دسترس نیست"},{status:503})}}
export async function POST(request:Request){if(!await hasAdminRole(request,["owner"]))return Response.json({error:"دسترسی مجاز نیست"},{status:401});if(!sameOrigin(request))return Response.json({error:"مبدأ درخواست معتبر نیست"},{status:403});try{const applied=await applySchemaMigrations();await recordAudit(request,"database.migrate","database",null,applied.join(","));return Response.json({ok:true,applied},{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({error:"آماده‌سازی پایگاه داده کامل نشد؛ وضعیت جداول را بازبینی کنید و دوباره اجرا کنید"},{status:503})}}
