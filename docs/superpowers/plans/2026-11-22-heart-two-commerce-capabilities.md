# Heart Two Commerce Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** انتقال قابلیت‌های عملیاتی قلب دوم به طب احمدی با حفظ کامل طراحی بصری، هویت و تنظیمات مستقل طب احمدی.

**Architecture:** از ساختار فعلی طب احمدی به‌عنوان مرز اجرا استفاده می‌شود و فقط منطق و مسیرهای عملیاتی نسخهٔ قلب دوم به آن تطبیق داده می‌شود. سفارش و پرداخت منبع حقیقت واحد خودشان را در مدل‌های فعلی دارند؛ mutationهای بیرونی از طریق adapter/serviceهای جدا، با idempotency و وضعیت قابل پیگیری انجام می‌شوند. کامپوننت‌های storefront و theme فعلی دست‌نخورده می‌مانند مگر برای اتصال به state جدید سبد.

**Tech Stack:** Next.js 15 App Router، TypeScript، React 19، Mongoose/MongoDB، MUI RTL، Zod، Vitest، adapterهای درگاه و APIهای مارکت‌پلیس.

**Spec:** `docs/superpowers/specs/2026-11-22-heart-two-commerce-capabilities.md`

## Global Constraints

- طراحی بصری فعلی طب احمدی نباید با طراحی قلب دوم جایگزین شود.
- secret، env، token و credential از منبع یا سرور دیگری کپی نمی‌شود.
- درگاه زرین‌پال پیش‌فرض فعال نمی‌شود؛ سایر درگاه‌ها فقط با پیکربندی معتبر در دسترس می‌شوند.
- mutation بیرونی در توسعه و تست اجرا نمی‌شود؛ آزمون‌ها باید deterministic و read-only باشند.
- تمام endpointهای جدید باید authz، validation، error code امن و rate/timeout مناسب داشته باشند.
- همهٔ تغییرات روی شاخهٔ `main` انجام می‌شود.

## Review Focus

- سبد قدیمی در مرورگر با schema جدید، saved lines و availability سرور سازگار بماند — تست migration/round-trip سبد در Task 1.
- پرداخت تکراری یا callback تکراری نباید سفارش را دوباره paid کند — تست idempotency در Task 2.
- نبودن credential یک درگاه نباید به کاربر خطای خام یا گزینهٔ غیرقابل استفاده نشان دهد — تست controls و safe error در Task 2.
- قطع یا timeout یک مارکت‌پلیس نباید سلامت پنل یا کانال دیگر را از بین ببرد — تست isolation در Task 3.
- callback وبهوک/پرداخت با body جعلی یا replay نباید mutation ایجاد کند — تست negative authorization/signature در Task 3.

---

### Task 1: انتقال رفتار سبد خرید و checkout

**Files:**
- Modify: `src/components/cart/CartProvider.tsx`, `src/components/cart/useCart.ts`, `src/components/cart/CartPageContent.tsx`, `src/components/cart/CartSummary.tsx`
- Modify: `src/app/(public)/cart/actions.ts`
- Modify: `src/orders/services/invoiceService.ts`, `src/orders/services/offerService.ts`, `src/orders/services/transportService.ts`
- Create/modify: `src/components/cart/cart-availability.ts`, `src/components/cart/checkout-session.ts`
- Test: focused cart/order tests under `src/components/cart/*.test.ts` and `src/orders/**/*.test.ts`

**Interfaces:**
- Consumes: مدل‌های فعلی `CartState`, `Invoice`, `Offer`, `Transport`.
- Produces: preflight موجودی، saved cart lines، address prefill، pricing snapshot و checkout idempotency بدون تغییر ظاهر کامپوننت‌ها.

- [x] استخراج قراردادهای سبد و checkout نسخهٔ منبع و نوشتن تست‌های failing برای preflight موجودی، saved lines، guest phone و duplicate checkout.
- [x] اجرای تست قرمز و ثبت علت failure.
- [x] انتقال حداقلی helper/serviceهای منبع به namespace فعلی، بدون کپی کامپوننت‌های بصری منبع.
- [x] اتصال کنترل‌های جدید به UI فعلی و حفظ tokenهای theme و شعاع‌های فعلی.
- [x] اجرای تست focused و سپس کل تست‌ها.
- [x] commit مستقل با پیام `feat: harden cart and checkout flow`.

### Task 2: درگاه‌ها و وضعیت پرداخت

**Files:**
- Modify: `src/payments/paymentService.ts`, `src/payments/paymentSchemas.ts`, `src/payments/paymentCalc.ts`
- Create/modify: `src/payments/paymentGatewayControls.ts`, `src/payments/bajetpayAdapter.ts`
- Modify: `src/app/(public)/cart/actions.ts`, `src/components/cart/CartSummary.tsx`
- Create/modify: `src/app/api/payments/bajetpay/callback/route.ts` and callback verification wiring
- Modify: admin payment settings/actions and `src/layout/components/admin-menu.tsx`
- Test: payment gateway control, callback, duplicate verify and safe-error tests

**Interfaces:**
- Consumes: `PaymentGateway`, `PaymentTransaction`, current callback routes and site config.
- Produces: list of six gateways with Zarinpal disabled by default, configured-only visibility, callback-safe verification and admin control.

- [x] Write failing tests for gateway visibility, Zarinpal default-off, missing credential masking, BajetPay callback parsing and duplicate verification.
- [x] Run the focused tests and verify expected red failures.
- [x] Add the source gateway control policy and BajetPay adapter using target path aliases and existing transaction model.
- [x] Wire all payment methods to invoice payment context without hardcoding Zarinpal.
- [x] Verify callback auth/state/amount checks and safe Persian errors.
- [x] Run focused and full tests.
- [ ] commit مستقل با پیام `feat: add configurable payment gateways` (در commit تجمیعی نهایی انجام می‌شود).

### Task 3: مارکت‌پلیس‌ها، سلامت و مقایسهٔ موجودی

**Files:**
- Modify: `src/basalaam/**`, `src/snapp/**`, `src/digikala/**`, `src/marketplace/**`
- Modify/create: corresponding `src/app/api/{basalaam,snapp,digikala,marketplace}/**` routes
- Modify: `src/app/admin/{basalaam,snapp,digikala,marketplace-health,inventory-comparison}/**`
- Modify: `src/layout/components/admin-menu.tsx`
- Test: provider timeout/429, duplicate webhook/order, read-back mismatch and permissions tests

**Interfaces:**
- Consumes: existing service credentials stored in Mongo/site config; never raw env values in UI.
- Produces: isolated admin health cards, inventory comparison and marketplace order/product operations with explicit evidence/status.

- [x] Characterize current endpoints and write failing tests for source behaviors missing in target.
- [x] Run tests red.
- [x] Port only provider adapters, status/reconciliation helpers and admin data routes; keep current Tab Ahmadi pages/styles.
- [x] Add bounded retry and explicit failure/reconciliation states where source requires them.
- [x] Verify authz and webhook replay protection.
- [x] Run focused/full tests and build.
- [ ] commit مستقل با پیام `feat: complete marketplace operations` (در commit تجمیعی نهایی انجام می‌شود).

### Task 4: تاپین، هلو و حسابداری

**Files:**
- Create: `src/app/admin/tapin/**`, `src/app/api/admin/tapin/**`, required `src/tapin/**`
- Create/modify: `src/app/admin/accounting/**`, `src/app/api/admin/accounting/**`, `src/accounting/**`, `src/views/admin/accounting/**`
- Modify: `src/holoo/**`, `src/app/api/holoo/**`, `src/app/admin/holoo/**`
- Modify: `src/layout/components/admin-menu.tsx`
- Test: permissions, idempotent invoice sync, failure/retry/reconciliation and read-only accounting report tests

**Interfaces:**
- Consumes: current Invoice/Payment/Transport models and Holoo adapter.
- Produces: admin-accessible Tapin dashboard, Holoo sync operations and accounting reports without changing storefront visuals.

- [x] Write failing tests for route visibility/permissions and duplicate Holoo sync markers.
- [x] Run tests red.
- [x] Port source service boundaries and pages, adapting imports to target models; do not copy source branding.
- [x] Add explicit dry/read-only behavior for accounting reports and bounded retry for sync jobs.
- [x] Add menu links and confirm existing admin layout remains visually unchanged.
- [x] Run tests and build.
- [ ] commit مستقل با پیام `feat: enable tapin and accounting operations` (در commit تجمیعی نهایی انجام می‌شود).

### Task 5: یکپارچه‌سازی، مستندسازی و انتشار

**Files:**
- Modify: `package.json`, `package-lock.json`, `.env.example` only for names/placeholders
- Modify: `README.md` and `docs/**`
- Test: full Vitest, lint, build, route smoke checks

- [x] Audit all copied files for source branding, hardcoded domains and secrets.
- [x] Run secret scan and dependency review.
- [x] Run full test suite, lint and production build.
- [x] Smoke-test public cart, admin named routes and API health without external mutations.
- [ ] Commit final integration on `main`, push, deploy and verify PM2/runtime health (commit is next; push/deploy require explicit release confirmation).

