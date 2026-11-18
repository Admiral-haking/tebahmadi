import { env } from "@/lib/runtime";
import { originAllowed } from "@/lib/origin-validation";
const COOKIE="tabah_admin",enc=new TextEncoder();
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
async function digest(value:string){const bytes=await crypto.subtle.digest("SHA-256",enc.encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function signature(payload:string){const key=await crypto.subtle.importKey("raw",enc.encode(env.ADMIN_SESSION_SECRET||""),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(payload))))}
function equal(a:string,b:string){let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0}
export async function makeAdminCookie(user:{id:string}){const sid=b64(crypto.getRandomValues(new Uint8Array(32))),expires=Date.now()+8*60*60*1000;await env.DB.prepare("INSERT INTO admin_sessions(id,admin_user_id,expires_at) VALUES(?,?,?)").bind(await digest(sid),user.id,expires).run();const payload=b64(enc.encode(JSON.stringify({sid,exp:expires,aud:"admin"})));return `${payload}.${await signature(payload)}`}
export async function getAdminIdentity(request:Request){if(!env.ADMIN_SESSION_SECRET)return null;const raw=request.headers.get("Cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);if(!raw||raw.length>700)return null;const [payload,sig]=raw.split(".");if(!payload||!sig||sig.length>100||!equal(sig,await signature(payload)))return null;try{const normalized=payload.replace(/-/g,"+").replace(/_/g,"/"),d=JSON.parse(atob(normalized+"=".repeat((4-normalized.length%4)%4)));if(d.aud!=="admin"||!Number.isSafeInteger(d.exp)||d.exp<Date.now()||typeof d.sid!=="string")return null;return await env.DB.prepare("SELECT u.id,u.email,u.phone,u.name,u.role,u.password_hash,u.must_change_password,s.id AS session_id FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_user_id WHERE s.id=? AND s.expires_at>? AND u.active=1").bind(await digest(d.sid),Date.now()).first<any>()}catch{return null}}
export async function hasAdminRole(request:Request,roles:string[]){const u=await getAdminIdentity(request);return !!u&&roles.includes(u.role)}
export async function isAdmin(request:Request){return hasAdminRole(request,["owner","admin"])}
export function sameOrigin(request:Request){
  return originAllowed(request.headers.get("Origin"),request.url,String(env.NEXT_PUBLIC_SITE_URL||""));
}
export function cookieHeader(value:string){return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`}
export function clearCookieHeader(){return `${COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
