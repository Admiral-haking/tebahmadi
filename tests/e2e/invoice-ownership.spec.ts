import { test, expect, request as requestFactory } from "@playwright/test";

test("invoice is visible to its owner and hidden from another customer",async()=>{
 const origin="http://127.0.0.1:5173";
 const owner=await requestFactory.newContext({baseURL:origin});
 const other=await requestFactory.newContext({baseURL:origin});
 try {
  for(const [index,client] of [owner,other].entries()){
   const phone=`0913${String(Date.now()+index).slice(-7)}`;
   const sent=await client.post("/api/customer/otp/request",{headers:{Origin:origin},data:{phone}});
   expect(sent.ok()).toBe(true);
   const {devCode}=await sent.json();
   const verified=await client.post("/api/customer/otp/verify",{headers:{Origin:origin},data:{phone,code:devCode,name:"خریدار آزمون"}});
   expect(verified.ok()).toBe(true);
  }
  const catalog=await owner.get("/api/products");
  const product=(await catalog.json()).products.find((p:{id:string;stock:number})=>p.stock>0);
  expect(product).toBeTruthy();
  const created=await owner.post("/api/orders",{headers:{Origin:origin,"Idempotency-Key":`invoice-${Date.now()}`},data:{name:"خریدار",phone:"09120000000",address:"تهران خیابان اصلی پلاک ۱۲",postalCode:"1234567890",items:[{id:product.id,quantity:1}]}});
  expect(created.status()).toBe(201);
  const {orderId}=await created.json();
  const invoice=await owner.get(`/api/customer/invoices/${orderId}`);
  expect(invoice.status()).toBe(200);
  expect(await invoice.text()).toContain("صورتحساب سفارش");
  expect((await other.get(`/api/customer/invoices/${orderId}`)).status()).toBe(404);
 }finally{await owner.dispose();await other.dispose()}
});
