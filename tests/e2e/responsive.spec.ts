import { test, expect } from "@playwright/test";

for (const width of [375,768,1024,1440]) {
  test(`storefront fits viewport ${width}`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    await expect(page.getByRole("heading",{name:"فروشگاه طب احمدی",exact:true})).toBeVisible();
    const overflowing = await page.evaluate(()=>Array.from(document.querySelectorAll("body *")).filter(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&(rect.right>innerWidth+1||rect.left < -1)}).map(element=>({tag:element.tagName,class:element.className,width:element.getBoundingClientRect().width})).slice(0,15));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),JSON.stringify(overflowing)).toBe(true);
    if(width===375){
      await page.locator(".store-mobile-navigation summary").click();
      await expect(page.locator("nav").getByRole("link",{name:"فروشگاه",exact:true})).toBeVisible();
    }
  });
}
