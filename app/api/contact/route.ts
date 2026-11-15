import { env } from "@/lib/runtime";
import { validOrigin } from "../customer/session";
export async function POST(request:Request){
  if(!validOrigin(request))return Response.json({error:"مبدأ درخواست معتبر نیست"},{status:403});
  let body:any;try{body=await request.json()}catch{return Response.json({error:"درخواست نامعتبر است"},{status:400})}
  if(typeof body.website==="string"&&body.website.trim())return Response.json({ok:true});
  const name=typeof body.name==="string"?body.name.trim().slice(0,120):"";
  const email=typeof body.email==="string"?body.email.trim().toLowerCase().slice(0,254):"";
  const phone=typeof body.phone==="string"?body.phone.replace(/[^0-9+۰-۹]/g,"").slice(0,16):null;
  const message=typeof body.message==="string"?body.message.trim().slice(0,3000):"";
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<10)return Response.json({error:"نام، ایمیل و پیام را بررسی کنید"},{status:400});
  try{await env.DB.prepare("INSERT INTO contact_messages(id,name,email,phone,message) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),name,email,phone,message).run();return Response.json({ok:true,message:"پیام شما ثبت شد؛ از طریق ایمیل با شما تماس می‌گیریم"},{status:201,headers:{"Cache-Control":"no-store"}})}
  catch{return Response.json({error:"ثبت پیام موقتاً انجام نشد"},{status:503})}
}
