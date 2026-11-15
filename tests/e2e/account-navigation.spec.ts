import { test, expect } from "@playwright/test";

test("signed-in customer can navigate and dismiss the mobile account menu",async({page})=>{
 const headers={Origin:"http://127.0.0.1:5173"};
 const phone=`0914${Date.now().toString().slice(-7)}`;
 const sent=await page.request.post("/api/customer/otp/request",{headers,data:{phone}});
 expect(sent.ok()).toBe(true);
 const {devCode}=await sent.json();
 const verified=await page.request.post("/api/customer/otp/verify",{headers,data:{phone,code:devCode,name:"مشتری منو"}});
 expect(verified.ok()).toBe(true);
 await page.setViewportSize({width:375,height:850});
 await page.goto("/account");
 await expect(page.getByRole("heading",{name:"مشتری منو",exact:true})).toBeVisible();
 const menu=page.getByRole("button",{name:"منوی حساب کاربری"});
 await menu.click();
 await expect(menu).toHaveAttribute("aria-expanded","true");
 await page.locator(".admin-tabs").getByRole("button",{name:"نشانی‌ها",exact:true}).click();
 await expect(page.getByRole("heading",{name:"افزودن نشانی",exact:true})).toBeVisible();
 await expect(menu).toHaveAttribute("aria-expanded","false");
 await menu.click();
 await page.keyboard.press("Escape");
 await expect(menu).toHaveAttribute("aria-expanded","false");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
