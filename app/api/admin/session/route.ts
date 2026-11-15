import { getAdminIdentity } from "../auth";
export async function GET(request:Request){const user=await getAdminIdentity(request);if(!user)return Response.json({user:null},{status:401,headers:{"Cache-Control":"no-store"}});return Response.json({user:{id:user.id,email:user.email,phone:user.phone,name:user.name,role:user.role,mustChangePassword:false}},{headers:{"Cache-Control":"no-store"}})}
