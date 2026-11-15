import { env } from "@/lib/runtime";
import { isValidPhone, normalizePhone } from "@/lib/input-normalization";
import { originAllowed } from "@/lib/origin-validation";
const COOKIE="tabah_customer";
const enc=new TextEncoder();
export { normalizePhone };
export function validOrigin(request:Request){return originAllowed(request.headers.get("Origin"),request.url,String(env.NEXT_PUBLIC_SITE_URL||""))}
export function phoneValid(phone:string){return isValidPhone(phone)}
async function digest(value:string){const result=await crypto.subtle.digest("SHA-256",enc.encode(value));return [...new Uint8Array(result)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function base64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
export async function createCustomerSession(customerId:string){const token=base64url(crypto.getRandomValues(new Uint8Array(32)));await env.DB.prepare("INSERT INTO customer_sessions(token_hash,customer_id,expires_at) VALUES(?,?,?)").bind(await digest(token),customerId,Date.now()+30*24*60*60*1000).run();return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`}
export function clearCustomerSession(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export async function currentCustomer(request:Request){const raw=request.headers.get("Cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);if(!raw||raw.length>100)return null;const tokenHash=await digest(raw);const row=await env.DB.prepare("SELECT c.id,c.name,c.phone,c.email,c.marketing_consent FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=? AND s.expires_at>?").bind(tokenHash,Date.now()).first<any>();if(!row)return null;await env.DB.prepare("UPDATE customer_sessions SET expires_at=? WHERE token_hash=?").bind(Date.now()+30*24*60*60*1000,tokenHash).run();return row}
