import { test, expect } from "@playwright/test";

test("customer invoice cannot be read without a customer session",async({request})=>{
  const response=await request.get("/api/customer/invoices/unknown-order");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("returning customer submits checkout in five clicks with saved address",async({page})=>{
  await page.route("**/api/customer/me",route=>route.fulfill({json:{customer:{id:"buyer",name:"خریدار",phone:"09120000000"},addresses:[{province:"تهران",city:"تهران",address:"خیابان اصلی پلاک ۱۰",postal_code:"1234567890"}]}}));
  await page.route("**/api/products",route=>route.fulfill({json:{products:[{id:"product",name:"محصول خرید سریع",category:"محصولات",price_toman:100000,stock:5,variants:[{id:"variant",title:"بسته ۱۰۰ گرمی",price_toman:100000,available_quantity:5}]}]}}));
  await page.route("**/api/shipping/methods",route=>route.fulfill({json:{methods:[{code:"post_pishtaz",title:"پست پیشتاز",priceToman:50000}]}}));
  let body:{items?:unknown;postalCode?:string}={};
  await page.route("**/api/orders",async route=>{body=route.request().postDataJSON();await route.fulfill({json:{orderId:"quick-order"}})});
  await page.route("**/api/payments/zarinpal/request",route=>route.fulfill({status:503,json:{error:"unavailable"}}));
  await page.goto("/");
  await page.getByRole("button",{name:"افزودن به سبد"}).click();
  await page.getByRole("button",{name:/سبد خرید/}).click();
  await page.getByRole("button",{name:"ادامه و ثبت سفارش ←"}).click();
  await expect(page.locator('input[name="address"]')).toHaveValue("تهران، تهران، خیابان اصلی پلاک ۱۰");
  await page.locator(".checkout-consent input").check();
  await page.getByRole("button",{name:"ثبت سفارش ←",exact:true}).click();
  await expect(page.locator(".order-success-code")).toHaveText("quick-order");
  expect(body.items).toEqual([{id:"product",variantId:"variant",quantity:1}]);
  expect(body.postalCode).toBe("1234567890");
});
