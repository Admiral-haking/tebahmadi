import { test, expect } from "@playwright/test";

for (const width of [375,768,1024,1440]) {
  test(`storefront fits viewport ${width}`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    await expect(page.getByRole("heading",{name:"محصولات",exact:true})).toBeVisible();
    const overflowing = await page.evaluate(()=>Array.from(document.querySelectorAll("body *")).filter(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&(rect.right>innerWidth+1||rect.left < -1)}).map(element=>({tag:element.tagName,class:element.className,width:element.getBoundingClientRect().width})).slice(0,15));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),JSON.stringify(overflowing)).toBe(true);
    if(width===375){
      await page.locator(".store-mobile-navigation summary").click();
      await expect(page.locator("nav").getByRole("link",{name:"فروشگاه",exact:true})).toBeVisible();
    }
  });
}

test("catalog header exposes a keyboard-accessible mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/products");
  await page.waitForLoadState("networkidle");
  const menu = page.getByRole("button", { name: "باز کردن منوی فروشگاه" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("navigation", { name: "منوی فروشگاه" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
