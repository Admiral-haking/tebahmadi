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
  const invoiceHtml=await invoice.text();
  expect(invoiceHtml).toContain("صورتحساب سفارش");
  expect(invoiceHtml).toContain('class="invoice-shell"');
  expect(invoiceHtml).toContain('class="invoice-table-scroll"');
  expect(invoiceHtml).toContain('aria-label="چاپ یا ذخیره صورتحساب"');
  expect(invoiceHtml).toContain("وضعیت پرداخت");
  expect(invoiceHtml).not.toContain("tebahmadi-logo.jpeg");
  expect((await other.get(`/api/customer/invoices/${orderId}`)).status()).toBe(404);
 }finally{await owner.dispose();await other.dispose()}
});

test("customer order card keeps tracking and invoice actions usable on mobile",async({page})=>{
 const origin="http://127.0.0.1:5173";
 const phone=`0915${Date.now().toString().slice(-7)}`;
 const sent=await page.request.post("/api/customer/otp/request",{headers:{Origin:origin},data:{phone}});
 const {devCode}=await sent.json();
 await page.request.post("/api/customer/otp/verify",{headers:{Origin:origin},data:{phone,code:devCode,name:"خریدار موبایل"}});
 const catalog=await page.request.get("/api/products");
 const product=(await catalog.json()).products.find((p:{id:string;stock:number})=>p.stock>0);
 const created=await page.request.post("/api/orders",{headers:{Origin:origin,"Idempotency-Key":`mobile-invoice-${Date.now()}`},data:{name:"خریدار موبایل",phone,address:"تهران، خیابان اصلی، پلاک ۲۴",postalCode:"1234567890",items:[{id:product.id,quantity:1}]}});
 expect(created.status()).toBe(201);
 await page.setViewportSize({width:375,height:812});
 await page.goto("/account");
 const card=page.locator(".customer-order-card").first();
 await expect(card).toBeVisible();
 await expect(card.getByRole("link",{name:"پیگیری سفارش"})).toBeVisible();
 await expect(card.getByRole("link",{name:"مشاهده صورتحساب"})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
