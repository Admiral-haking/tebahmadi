# Order Operations Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ساخت مرکز عملیات سفارش برای مدیریت کامل سفارش، مشتری، ثبت مرسوله در تاپین، گزارش و خروجی.

**Architecture:** APIهای ادمین در یک route عملیاتی با پاسخ‌های پایدار پیاده می‌شوند؛ ثبت مرسوله همچنان از adapter تاپین استفاده می‌کند و سفارش روش «پست پیشتاز» را نگه می‌دارد. رابط کاربری جدید به‌صورت کامپوننت مستقل داخل پنل فعلی اضافه می‌شود.

**Tech Stack:** React/TypeScript، Cloudflare Worker، D1/SQLite، تست Node و tsx.

## Global Constraints

- روش مشتری فقط `post_pishtaz` است؛ Tapin connector backend است.
- تمام endpointهای عملیات سفارش فقط برای نقش‌های مجاز ادمین هستند.
- قیمت و اقلام در سرور معتبرسازی می‌شوند.
- migration مخرب نیست و secret در source/log وارد نمی‌شود.

## Review Focus

- سفارش بدون کد پستی یا اقلام نامعتبر نباید در Tapin ثبت شود؛ تست API/validation.
- ثبت دوباره همان سفارش نباید مرسولهٔ تکراری بسازد؛ تست idempotency.
- خروجی CSV باید escaping امن برای نام و آدرس داشته باشد؛ تست serializer.
- تغییر وضعیت نامعتبر یا دسترسی پشتیبان به عملیات حساس باید رد شود؛ تست authorization/transition.
- گزارش با فیلتر تاریخ خالی و بازهٔ معکوس باید پاسخ پایدار بدهد؛ تست query builder.

### Task 1: Contract helpers and focused tests

**Files:** Create `lib/order-operations.ts`, Test `tests/order-operations.test.ts`.

- [ ] تست CSV escaping، فیلتر تاریخ، خلاصه وضعیت و transitionها را بنویس و اجرای RED را ثبت کن.
- [ ] helperهای pure را پیاده کن و تست کامل را اجرا کن.

### Task 2: Admin order operations API

**Files:** Create `app/api/admin/order-center/route.ts`, Create `app/api/admin/order-center/export/route.ts`, Modify `app/api/admin/orders/route.ts` if needed.

- [ ] GET list/detail/report با search، status، date و pagination.
- [ ] PATCH ویرایش کنترل‌شدهٔ گیرنده/آدرس، یادداشت و وضعیت با audit/event.
- [ ] خروجی CSV امن و no-store.
- [ ] تست typecheck و API contract.

### Task 3: Tapin operational workflow

**Files:** Modify `app/api/admin/shipping/tapin/register/route.ts`, Create `app/api/admin/shipping/tapin/retry/route.ts` if needed.

- [ ] قبل از ثبت، جزئیات سفارش از D1 خوانده و payload قابل مشاهده/قابل اعتبارسنجی ساخته شود.
- [ ] idempotency بر اساس order و shipment موجود رعایت شود و retry فقط برای خطاها مجاز باشد.
- [ ] tracking، quote، status و event ذخیره شوند.

### Task 4: Operations center UI

**Files:** Create `app/admin/order-center.tsx`, Modify `app/admin/page.tsx`, `app/globals.css`.

- [ ] جدول فیلترپذیر، جزئیات مشتری/اقلام/آدرس، فرم ویرایش و timeline.
- [ ] دکمهٔ استعلام/ثبت تاپین، retry، چاپ، خروجی و گزارش.
- [ ] نقش‌ها و خطاهای provider در UI واضح باشند.

### Task 5: Verification

- [ ] اجرای `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`.
- [ ] smoke محلی routeهای جدید و ثبت وضعیت نهایی/محدودیت credential واقعی.
