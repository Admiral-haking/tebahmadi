import { test, expect } from "@playwright/test";

test("shared login places a WebOTP code in the verification field", async ({ page }) => {
  let verifyRequests = 0;
  await page.route("**/api/auth/otp/request", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/auth/otp/verify", (route) => { verifyRequests += 1; return route.fulfill({ json: { customer: { id: "buyer" } } }); });
  await page.goto("/login");
  await page.evaluate(() => {
    Object.defineProperty(window, "OTPCredential", { configurable: true, value: function OTPCredential() {} });
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: async () => ({ code: "2468" }) },
    });
  });
  const submit = page.getByRole("button", { name: "ارسال کد ورود" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("شماره همراه").fill("09120000000");
  await Promise.all([
    page.waitForRequest((request) => request.url().endsWith("/api/auth/otp/request") && request.method() === "POST"),
    submit.click(),
  ]);
  await expect(page.getByLabel("کد ورود")).toHaveValue("2468");
  await page.waitForTimeout(250);
  expect(verifyRequests).toBe(0);
});

test("shared login asks for a name and completes a new customer registration", async ({ page }) => {
  const verifyBodies: Array<Record<string, string>> = [];
  await page.route("**/api/auth/otp/request", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/auth/otp/verify", async (route) => {
    verifyBodies.push(route.request().postDataJSON());
    if (verifyBodies.length === 1) return route.fulfill({ status: 400, json: { needsName: true, error: "برای ساخت حساب، نام و نام خانوادگی را وارد کنید" } });
    return route.fulfill({ json: { customer: { id: "new-customer" } } });
  });
  await page.goto("/login");
  const requestButton = page.getByRole("button", { name: "ارسال کد ورود" });
  await expect(requestButton).toBeEnabled();
  await page.getByLabel("شماره همراه").fill("09121111111");
  await requestButton.click();
  await page.getByLabel("کد ورود").fill("1234");
  await page.getByRole("button", { name: "تأیید و ورود" }).click();
  await expect(page.getByLabel("نام و نام خانوادگی")).toBeVisible();
  await page.getByLabel("نام و نام خانوادگی").fill("مشتری تازه");
  await Promise.all([
    page.waitForRequest((request) => request.url().endsWith("/api/auth/otp/verify") && request.postDataJSON().name === "مشتری تازه"),
    page.getByRole("button", { name: "ساخت حساب و ورود" }).click(),
  ]);
  expect(verifyBodies).toHaveLength(2);
  expect(verifyBodies[1]).toMatchObject({ phone: "09121111111", code: "1234", name: "مشتری تازه" });
});
