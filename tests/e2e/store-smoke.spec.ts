import { expect, test } from "@playwright/test";

test("store pages render without a browser error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/طب احمدی|فروشگاه|سلامت/i);
  await expect(page.locator("body")).toContainText("طب احمدی");
  await page.goto("/products");
  await expect(page.locator("body")).toContainText(/محصول|فروشگاه/);
  await page.goto("/track?id=order-from-account-link", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /پیگیری/ })).toBeVisible();
  await expect(page.getByLabel("کد سفارش")).toHaveValue("order-from-account-link");
  expect(errors).toEqual([]);
});

test("health and readiness endpoints are reachable", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe("ok");
  const readiness = await request.get("/api/readiness");
  expect(readiness.status()).toBe(200);
  expect(await readiness.json()).toMatchObject({ status: "ready", database: "ok", providers: { payment: { refundConfigured: true } } });
});

test("local shipping quote uses the mock provider without Tapin credentials", async ({ request }) => {
  const response = await request.post("/api/shipping/tapin/quote", {
    headers: { Origin: "http://127.0.0.1:5173" },
    data: { provinceCode: 1, cityCode: 2, weightGrams: 1000, postalCode: "1234567890" },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ provider: "mock", quotes: [{ amountToman: 85000 }] });
});

test("responses include baseline security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()).toMatchObject({
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "cross-origin-resource-policy": "same-origin",
    "x-dns-prefetch-control": "off",
  });
});

test("admin order operations require an authenticated role", async ({ request }) => {
  const response = await request.get("/api/admin/order-center");
  expect(response.status()).toBe(401);
  const promotionsExport = await request.get("/api/admin/promotions/export");
  expect(promotionsExport.status()).toBe(401);
  expect((await request.get("/api/admin/setup")).status()).toBe(401);
  expect((await request.post("/api/admin/setup", { headers: { Origin: "http://127.0.0.1:5173" } })).status()).toBe(401);
  expect((await request.post("/api/admin/seed", { headers: { Origin: "http://127.0.0.1:5173" } })).status()).toBe(401);
});

test("payment and promotion mutations reject requests without a same-origin header", async ({ request }) => {
  const payment = await request.post("/api/payments/zarinpal/request", { data: { orderId: "origin-check" } });
  expect(payment.status()).toBe(403);
  const promotion = await request.post("/api/promotions/validate", { data: { code: "TEST", items: [{ id: "origin-check", quantity: 1 }] } });
  expect(promotion.status()).toBe(403);
  const quote = await request.post("/api/shipping/tapin/quote", { data: { provinceCode: 1, cityCode: 1, weightGrams: 500 } });
  expect(quote.status()).toBe(403);
});

test("promotion management page hides its form without an admin session", async ({ page }) => {
  await page.goto("/admin/promotions", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /دسترسی به کدهای تخفیف/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /ورود به پنل/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ساخت کد جدید" })).toHaveCount(0);
});

test("account page routes unauthenticated users to the shared login form", async ({ page }) => {
  await page.route("**/api/customer/me", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: { customer: null, orders: [], addresses: [] } });
  });
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status", { name: "در حال بررسی حساب" })).toBeVisible();
  expect(await page.getByRole("heading", { name: "ورود با شماره همراه" }).count()).toBe(0);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "ورود با شماره همراه" })).toBeVisible();
  await expect(page.getByRole("button", { name: /ارسال کد ورود/ })).toBeVisible();
  await expect(page.getByText(/نوع حساب|ورود مشتری|ورود ادمین/)).toHaveCount(0);
});

test("product detail exposes quantity controls without role-specific login text", async ({ page }) => {
  await page.goto("/products/local-demo-product", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[aria-label="تعداد محصول"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "افزایش تعداد" })).toBeVisible();
  await expect(page.getByText(/نوع حساب|ورود مشتری|ورود ادمین/)).toHaveCount(0);
});

test("local customer OTP creates a session without SMS credentials", async ({ request }) => {
  const phone = `0912${Date.now().toString().slice(-7)}`;
  const origin = { Origin: "http://127.0.0.1:5173" };
  const otp = await request.post("/api/customer/otp/request", { headers: origin, data: { phone } });
  expect(otp.status()).toBe(200);
  const otpData = await otp.json();
  expect(otpData.devCode).toMatch(/^\d{4}$/);
  expect(String(otpData.message || "")).not.toMatch(/local|تست|آزمایشی/i);
  const needsName = await request.post("/api/customer/otp/verify", { headers: origin, data: { phone, code: otpData.devCode } });
  expect(needsName.status()).toBe(400);
  expect(await needsName.json()).toMatchObject({ needsName: true });
  const verified = await request.post("/api/customer/otp/verify", { headers: origin, data: { phone, code: otpData.devCode, name: "مشتری تست" } });
  expect(verified.status()).toBe(200);
  expect(await verified.json()).toMatchObject({ customer: { phone, name: "مشتری تست" } });
  expect(verified.headers()["set-cookie"]).toContain("tabah_customer=");
  const catalog = await request.get("/api/products");
  const product = ((await catalog.json()).products as Array<{ id: string; stock: number }>).find((item) => Number(item.stock) > 0);
  expect(product).toBeTruthy();
  if (!product) throw new Error("local fixture has no available product");
  const order = await request.post("/api/orders", { headers: { ...origin, "Idempotency-Key": `customer-phone-${Date.now()}` }, data: { name: "مشتری تست", phone: "09129999999", address: "تهران، نشانی مشتری، پلاک ۳", postalCode: "1234567890", shippingMethod: "post_pishtaz", items: [{ id: product.id, quantity: 1 }] } });
  expect(order.status()).toBe(201);
  const orderData = await order.json();
  const status = await request.get(`/api/order-status?id=${encodeURIComponent(orderData.orderId)}&phone=${phone}`);
  expect(status.status()).toBe(200);
});

test("customer can add an available product and open checkout", async ({ page }) => {
  await page.goto("/");
  const addButton = page.locator("button.quick-add:not([disabled])").first();
  await expect(page.locator(".product-card").first()).toBeVisible({ timeout: 20_000 });
  await expect(addButton).toBeVisible({ timeout: 20_000 });
  await addButton.click();
  await expect(page.locator(".cart-btn")).toContainText("1");
  await page.locator(".cart-btn").click();
  await expect(page.getByRole("heading", { name: "سبد خرید" })).toBeVisible();
  await expect(page.locator(".cart-line").first()).toContainText("× 1");
  await page.locator(".cart-line").first().getByRole("button", { name: /افزایش/ }).click();
  await expect(page.locator(".cart-line").first()).toContainText("× 2");
  await page.getByRole("button", { name: /ادامه و ثبت سفارش/ }).click();
  await expect(page.getByRole("heading", { name: "اطلاعات ارسال" })).toBeVisible();
  await expect(page.getByLabel("نام و نام خانوادگی")).toBeVisible();
});

test("mock checkout creates an order with server-calculated totals", async ({ request }) => {
  const catalog = await request.get("/api/products");
  expect(catalog.ok()).toBeTruthy();
  const products = (await catalog.json()).products as Array<{ id: string; stock: number }>;
  const product = products.find((item) => Number(item.stock) > 0);
  expect(product).toBeTruthy();
  if (!product) throw new Error("local fixture has no available product");
  const idempotencyKey = `e2e-${Date.now()}`;
  const response = await request.post("/api/orders", {
    headers: { Origin: "http://127.0.0.1:5173", "Idempotency-Key": idempotencyKey },
    data: { name: "تست خرید", phone: "09121234567", address: "تهران، خیابان تست، پلاک ۱", postalCode: "1234567890", shippingMethod: "post_pishtaz", items: [{ id: product.id, quantity: 1 }] },
  });
  expect(response.status()).toBe(201);
  const order = await response.json();
  expect(order).toMatchObject({ status: "pending", orderId: expect.any(String), totalToman: expect.any(Number) });
  expect(order.totalToman).toBeGreaterThanOrEqual(order.subtotalToman);
  const retry = await request.post("/api/orders", {
    headers: { Origin: "http://127.0.0.1:5173", "Idempotency-Key": idempotencyKey },
    data: { name: "تست خرید", phone: "09121234567", address: "تهران، خیابان تست، پلاک ۱", postalCode: "1234567890", shippingMethod: "post_pishtaz", items: [{ id: product.id, quantity: 1 }] },
  });
  expect(retry.status()).toBe(200);
  expect(await retry.json()).toMatchObject({ idempotent: true, orderId: order.orderId, totalToman: order.totalToman });
  const payment = await request.post("/api/payments/zarinpal/request", { headers: { Origin: "http://127.0.0.1:5173" }, data: { orderId: order.orderId } });
  expect(payment.status()).toBe(200);
  const paymentData = await payment.json();
  expect(paymentData).toMatchObject({ orderId: order.orderId, authority: `mock_${order.orderId}` });
  const forgedCallback = await request.get(`/api/payments/zarinpal/callback?orderId=${encodeURIComponent(order.orderId)}&authority=forged-authority&Status=OK`, { maxRedirects: 0 });
  expect(forgedCallback.status()).toBe(409);
  const callback = await request.get(`/api/payments/zarinpal/callback?orderId=${encodeURIComponent(order.orderId)}&authority=${encodeURIComponent(paymentData.authority)}&Status=OK`, { maxRedirects: 0 });
  expect(callback.status()).toBe(303);
  expect(callback.headers().location).toContain("payment=success");
  const duplicateCallback = await request.get(`/api/payments/zarinpal/callback?orderId=${encodeURIComponent(order.orderId)}&authority=${encodeURIComponent(paymentData.authority)}&Status=OK`, { maxRedirects: 0 });
  expect(duplicateCallback.status()).toBe(303);
  expect(duplicateCallback.headers().location).toContain("already-paid");
});

test("cancelled mock payment releases the reserved order", async ({ request }) => {
  const catalog = await request.get("/api/products");
  const product = ((await catalog.json()).products as Array<{ id: string; stock: number }>).find((item) => Number(item.stock) > 0);
  expect(product).toBeTruthy();
  if (!product) throw new Error("local fixture has no available product");
  const stockBefore = Number(product.stock);
  const created = await request.post("/api/orders", {
    headers: { Origin: "http://127.0.0.1:5173", "Idempotency-Key": `cancel-e2e-${Date.now()}` },
    data: { name: "تست لغو پرداخت", phone: "09121333333", address: "تهران، نشانی لغو، پلاک ۴", postalCode: "1234567890", shippingMethod: "post_pishtaz", items: [{ id: product.id, quantity: 1 }] },
  });
  expect(created.status()).toBe(201);
  const order = await created.json();
  const payment = await request.post("/api/payments/zarinpal/request", { headers: { Origin: "http://127.0.0.1:5173" }, data: { orderId: order.orderId } });
  expect(payment.status()).toBe(200);
  const paymentData = await payment.json();
  const cancelled = await request.get(`/api/payments/zarinpal/callback?orderId=${encodeURIComponent(order.orderId)}&authority=${encodeURIComponent(paymentData.authority)}&Status=CANCEL`, { maxRedirects: 0 });
  expect(cancelled.status()).toBe(303);
  const status = await request.get(`/api/order-status?id=${encodeURIComponent(order.orderId)}&phone=09121333333`);
  expect(status.status()).toBe(200);
  expect(await status.json()).toMatchObject({ order: { status: "cancelled", paymentStatus: "failed" } });
  const afterCancelCatalog = await request.get("/api/products");
  const afterCancelProduct = ((await afterCancelCatalog.json()).products as Array<{ id: string; stock: number }>).find((item) => item.id === product.id);
  expect(afterCancelProduct?.stock).toBe(stockBefore);
  const duplicate = await request.get(`/api/payments/zarinpal/callback?orderId=${encodeURIComponent(order.orderId)}&authority=${encodeURIComponent(paymentData.authority)}&Status=CANCEL`, { maxRedirects: 0 });
  expect(duplicate.status()).toBe(303);
});

test("local admin OTP can manage orders and export filtered data", async ({ request }) => {
  test.setTimeout(60_000);
  const otp = await request.post("/api/admin/otp/request", { headers: { Origin: "http://127.0.0.1:5173" }, data: { phone: "09120000000" } });
  expect(otp.status()).toBe(200);
  const otpData = await otp.json();
  expect(otpData.devCode).toMatch(/^\d{4}$/);
  const verified = await request.post("/api/admin/otp/verify", { headers: { Origin: "http://127.0.0.1:5173" }, data: { phone: "09120000000", code: otpData.devCode } });
  expect(verified.status()).toBe(200);
  const refundsPage = await request.get("/admin/refunds");
  expect(refundsPage.status()).toBe(200);
  const refundsCsv = await request.get("/api/admin/refunds?format=csv");
  expect(refundsCsv.status()).toBe(200);
  expect(refundsCsv.headers()["content-type"]).toContain("text/csv");
  expect(refundsCsv.headers()["content-disposition"]).toContain("tab-ahmadi-refunds.csv");
  const inventoryCsv = await request.get("/api/admin/inventory/export");
  expect(inventoryCsv.status()).toBe(200);
  expect(inventoryCsv.headers()["content-type"]).toContain("text/csv");
  expect(inventoryCsv.headers()["content-disposition"]).toContain("tab-ahmadi-inventory-ledger.csv");
  expect(await inventoryCsv.text()).toContain("movement_id");
  const inventory = await request.get("/api/admin/inventory");
  expect(inventory.status()).toBe(200);
  const inventoryItem = ((await inventory.json()).items as Array<{ id: string; stock: number }>).find((item) => Number(item.stock) < 100000);
  expect(inventoryItem).toBeTruthy();
  if (!inventoryItem) throw new Error("local fixture has no inventory item below the safety ceiling");
  const stockBeforeAdjustment = inventoryItem.stock;
  const increased = await request.post("/api/admin/inventory", {
    headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
    data: { productId: inventoryItem.id, delta: 1, reason: "تست افزایش موجودی" },
  });
  expect(increased.status()).toBe(200);
  expect(await increased.json()).toMatchObject({ stock: stockBeforeAdjustment + 1 });
  const restored = await request.post("/api/admin/inventory", {
    headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
    data: { productId: inventoryItem.id, delta: -1, reason: "بازگردانی تست موجودی" },
  });
  expect(restored.status()).toBe(200);
  expect(await restored.json()).toMatchObject({ stock: stockBeforeAdjustment });
  const catalog = await request.get("/api/products");
  const product = ((await catalog.json()).products as Array<{ id: string; stock: number }>).find((item) => Number(item.stock) > 0);
  expect(product).toBeTruthy();
  if (!product) throw new Error("local fixture has no available product");
  const created = await request.post("/api/orders", {
    headers: { Origin: "http://127.0.0.1:5173", "Idempotency-Key": `admin-e2e-${Date.now()}` },
    data: { name: "ادمین تست", phone: "09121111111", address: "تهران، نشانی تست، پلاک ۲", postalCode: "1234567890", shippingMethod: "post_pishtaz", items: [{ id: product.id, quantity: 1 }] },
  });
  expect(created.status()).toBe(201);
  const createdOrder = await created.json();
  const manualPaid = await request.patch("/api/admin/order-center", {
    headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
    data: { id: createdOrder.orderId, status: "paid" },
  });
  expect(manualPaid.status()).toBe(409);
  const legacyManualPaid = await request.patch("/api/admin/orders", {
    headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
    data: { id: createdOrder.orderId, status: "paid" },
  });
  expect(legacyManualPaid.status()).toBe(409);
  const manualProcessing = await request.patch("/api/admin/orders", {
    headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
    data: { id: createdOrder.orderId, status: "processing" },
  });
  expect(manualProcessing.status()).toBe(409);
  const payment = await request.post("/api/payments/zarinpal/request", { headers: { Origin: "http://127.0.0.1:5173" }, data: { orderId: createdOrder.orderId } });
  expect(payment.status()).toBe(200);
  const paymentData = await payment.json();
  const callback = await request.get(`/api/payments/zarinpal/callback?orderId=${encodeURIComponent(createdOrder.orderId)}&authority=${encodeURIComponent(paymentData.authority)}&Status=OK`, { maxRedirects: 0 });
  expect(callback.status()).toBe(303);
  const list = await request.get("/api/admin/order-center?page=1&limit=10");
  expect(list.status()).toBe(200);
  const listData = await list.json();
  expect(listData).toMatchObject({ page: 1, totalPages: expect.any(Number), orders: expect.any(Array) });
  const candidate = (listData.orders as Array<Record<string, unknown>>).find((order) => order.payment_status === "paid" || order.status === "paid" || order.status === "processing");
  if (candidate) {
    const registered = await request.post("/api/admin/shipping/tapin/register", {
      headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
      data: { orderId: String(candidate.id), provinceCode: 1, cityCode: 2, weightGrams: 1000 },
    });
    expect(registered.status()).toBe(201);
    expect(await registered.json()).toMatchObject({ provider: "tapin", shipment: { barcode: expect.stringMatching(/^MOCK-/) } });
    const trackingCode = `MANUAL-${Date.now()}`;
    const edited = await request.patch("/api/admin/order-center", {
      headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
      data: { id: String(candidate.id), trackingCode, note: "کد رهگیری دستی برای تست" },
    });
    expect(edited.status()).toBe(200);
    const detail = await request.get(`/api/admin/order-center?id=${encodeURIComponent(String(candidate.id))}`);
    expect(detail.status()).toBe(200);
    expect(await detail.json()).toMatchObject({ order: { tracking_code: trackingCode, shipment_tracking_code: trackingCode, shipment_status: "registered" } });
    const tracking = await request.get(`/api/order-status?id=${encodeURIComponent(String(candidate.id))}&phone=${encodeURIComponent(String(candidate.phone))}`);
    expect(tracking.status()).toBe(200);
    expect(await tracking.json()).toMatchObject({ order: { trackingCode, shippingStatus: "registered" } });
    const bypassRefund = await request.patch("/api/admin/order-center", {
      headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
      data: { id: String(candidate.id), status: "refunded" },
    });
    expect(bypassRefund.status()).toBe(409);
    const refunded = await request.patch("/api/admin/orders", {
      headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "application/json" },
      data: { id: String(candidate.id), status: "refunded", note: "بازپرداخت mock برای تست" },
    });
    expect(refunded.status()).toBe(200);
    const audit = await request.get(`/api/admin/audit?q=${encodeURIComponent(String(candidate.id))}`);
    expect(audit.status()).toBe(200);
    const auditData = await audit.json();
    expect((auditData.logs as Array<{ action: string }>).some((entry) => entry.action === "order.refund")).toBe(true);
    const refundedCsv = await request.get("/api/admin/refunds?format=csv&status=refunded");
    expect(refundedCsv.status()).toBe(200);
    expect(await refundedCsv.text()).toContain(String(candidate.id));
  }
  const exported = await request.get("/api/admin/order-center/export?q=MOCK");
  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-type"]).toContain("text/csv");
});

