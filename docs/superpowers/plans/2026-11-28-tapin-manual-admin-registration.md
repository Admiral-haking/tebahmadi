# برنامهٔ اجرایی ثبت دستی مرسولهٔ تاپین

> سند طراحی مرجع: `docs/superpowers/specs/2026-11-28-tapin-manual-admin-registration.md`

## هدف

اطلاعات مشتری و سفارش در جزئیات سفارش آماده و خواندنی باشد؛ ادمین مشخصات بسته‌بندی را صریح وارد کند؛ quote فقط با کلیک ادمین انجام شود؛ و register فقط پس از تأیید صریح ادمین به تاپین ارسال شود. هیچ مسیر خودکاری بعد از پرداخت اضافه یا فعال نشود.

## محدودیت‌ها

- در تست‌ها هیچ mutation واقعی به تاپین ارسال نمی‌شود.
- وزن، ابعاد، نوع‌ها و مقصد از طرف سامانه حدس زده نمی‌شوند.
- فایل‌های `.codex-attachments/` commit نمی‌شوند.
- تغییر remote status فقط از کنترل‌های صریح موجود پنل انجام می‌شود.

## Task 1 — قرارداد دستی و تست‌های عدم‌خودکارسازی

### فایل‌های هدف

- `src/services/tapin/validation.ts`
- `src/services/tapin/invoice.ts`
- `src/services/tapin/manual-registration.test.ts`
- تست مسیر پرداخت/سرویس سفارش در صورت وجود نقطهٔ مشترک مناسب.

### کارها

1. قرارداد ورودی دستی را طوری تست و مستند کن که مشخصات بسته‌بندی بدون ورودی ادمین کامل نباشد.
2. ساخت payload را با دادهٔ صریح ادمین تست کن؛ مقدارهای پیش‌فرض بسته‌بندی نباید از UI وارد شوند.
3. تضمین کن transition پرداخت هیچ فراخوانی Tapin register/enqueue ندارد.
4. خطای وزن/مقصد/آدرس را بدون حدس مقدار گزارش کن.

## Task 2 — اتصال مدل سفارش به کارت تاپین ادمین

### فایل‌های هدف

- `src/views/admin/orders/detail.tsx`
- `src/views/admin/orders/components/TapinShipmentCard.tsx`
- `src/views/admin/orders/components/tapin-shipment.types.ts`
- `src/views/admin/orders/components/tapin-shipment-api.ts`
- `src/views/admin/orders/components/InvoiceLinesTable.tsx`

### کارها

1. `tapinShipment` را همراه با `weightGrams` در view model سفارش serialize کن.
2. اطلاعات مشتری/اقلام سفارش را read-only در کارت نشان بده.
3. فرم دستی را از الگوی «قلب دوم» وارد کن، اما همهٔ فیلدهای بسته‌بندی را نیازمند انتخاب/ورود ادمین کن.
4. بارگذاری options فقط GET باشد و به‌تنهایی quote/register اجرا نکند.
5. quote و register را با دو action جدا و تأیید دوم برای register پیاده کن.
6. وضعیت ثبت‌شده، بارکد، شناسه و لینک لیبل واقعی را نمایش بده.

## Task 3 — کنترل API و پاسخ قابل اقدام

### فایل‌های هدف

- `src/app/api/admin/tapin/quote/route.ts`
- `src/app/api/admin/tapin/shipments/route.ts`
- تست‌های route/service مرتبط.

### کارها

1. endpointهای موجود را حفظ کن و هر trigger خودکار احتمالی را حذف/غیرفعال نگه دار.
2. schema دستی را برای ورودی صریح ادمین پوشش بده؛ برای فیلدهای بسته‌بندی مقدار حدسی از کلاینت ارسال نشود.
3. قفل ثبت موجود و پاسخ‌های واقعی تاپین حفظ شوند.
4. خطاهای validation/auth/timeout را بدون گزارش موفقیت جعلی به UI برگردان.

## Task 4 — verification

1. تست‌های جدید را ابتدا قرمز و سپس سبز اجرا کن.
2. تست مرتبط، typecheck، lint و build را اجرا کن؛ خطاهای baseline را جداگانه گزارش کن.
3. diff را از نظر نبود trigger پرداخت، نبود job/worker خودکار و عدم افزودن فایل‌های attachment بررسی کن.
4. قبل از اعلام تکمیل، کارت سفارش، quote و register را با mock بررسی کن.

## ترتیب commit پیشنهادی

1. `docs: replace tapin auto flow with manual admin flow`
2. `test: cover manual tapin registration contract`
3. `feat: add manual tapin shipment card to admin orders`
4. `test: verify tapin registration requires explicit admin action`

Push/deploy فقط با درخواست صریح بعدی انجام می‌شود.
