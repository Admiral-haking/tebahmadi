import { env } from "@/lib/runtime";
import { hasAdminRole, sameOrigin } from "../auth";
type SeedRow=[string,string,string,number,number|null,string,string,number];
const starter:SeedRow[]=[
 ["p1","ماسک مو شیر بادام روحا","مراقبت مو",1637000,1820000,"https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=720&q=80","مراقبت ملایم از مو",0],
 ["p2","سرم آبرسان ارگانیک هور","مراقبت پوست",625000,null,"https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=720&q=80","آبرسان روزانه پوست",0],
 ["p3","روغن ترکیبی پریان روحا","روغن گیاهی",711000,966000,"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=720&q=80","روغن ترکیبی مراقبتی",0],
 ["p4","لوشن بار ارگانیک هور","بدن و حمام",590000,null,"https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=720&q=80","لوسیون جامد بدن",0],
 ["p5","اسکراب کف سر موی چرب","مراقبت مو",1189000,null,"https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=720&q=80","مراقبت کف سر",0],
 ["p6","کرم مرطوب‌کننده صورت هور","مراقبت پوست",680000,730000,"https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=720&q=80","مرطوب‌کننده روزانه",0]
];
export async function POST(request:Request){if(["production"].includes(String(env.APP_ENV||"").toLowerCase()))return Response.json({error:"seed فقط در محیط local یا test مجاز است"},{status:403});if(!await hasAdminRole(request,["owner"]))return Response.json({error:"دسترسی مجاز نیست"},{status:401});if(!sameOrigin(request))return Response.json({error:"مبدأ درخواست معتبر نیست"},{status:403});const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM products").first<number>("n");if(count)return Response.json({error:"فهرست محصولات خالی نیست؛ برای جلوگیری از تغییر ناخواسته، ورود نمونه لغو شد"},{status:409});for(const [id,name,category,price,old,image,desc,stock] of starter){const slug=String(name).replace(/\s+/g,"-")+"-"+id.slice(0,6);await env.DB.prepare("INSERT INTO products(id,name,slug,category,price_toman,compare_at_toman,image_url,description,stock,active) VALUES(?,?,?,?,?,?,?,?,?,1)").bind(id,name,slug,category,price,old,image,desc,stock).run()}return Response.json({ok:true,inserted:starter.length},{status:201})}
