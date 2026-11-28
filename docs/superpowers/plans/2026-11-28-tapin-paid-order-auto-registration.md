# برنامهٔ اجرایی ثبت خودکار مرسولهٔ تاپین پس از پرداخت

> سند طراحی مرجع: `docs/superpowers/specs/2026-11-28-tapin-paid-order-auto-registration.md`

## هدف نهایی

پس از transition قطعی فاکتور به `paid`، برای هر فاکتور حداکثر یک job پایدار ساخته شود. worker اطلاعات لازم را بدون حدس اعتبارسنجی کند، quote واقعی تاپین را بگیرد، مرسوله را با `register_type = 0` ثبت کند، نتیجه را read-back کند، شناسهٔ واقعی بارکد/لیبل را ذخیره کند و وضعیت داخلی سفارش را `ready_to_print` قرار دهد. timeout یا پاسخ مبهم نباید باعث ثبت تکراری شود.

## محدودیت‌های اجرایی

- در محیط تست هیچ mutation واقعی به تاپین ارسال نمی‌شود؛ همهٔ تست‌های سرویس mock هستند.
- token و مقادیر secret از env/secret می‌آیند و در SiteConfig، لاگ یا fixture ذخیره نمی‌شوند.
- تاپین فقط در وضعیت ثبت اولیه می‌ماند؛ تغییر remote status به `1` یا `2` در این کار انجام نمی‌شود.
- بدون وزن کالا، وزن بسته‌بندی، جعبه، نوع‌ها، مقصد معتبر و تنظیمات کامل، job متوقف می‌شود؛ مقدار پیش‌فرض حدسی ممنوع است.
- فایل‌های `.codex-attachments/` جزو تغییرات نیستند و commit نمی‌شوند.

## Task 1 — مدل داده و تنظیمات

### ۱.۱ مدل job

فایل‌های هدف:

- `src/sync/model/job.ts` یا مدل جدید در `src/services/tapin/`.
- فایل migration/index در الگوی موجود پروژه.

کارها:

1. مدل `TapinShipmentJob` با `invoiceId` یکتا ایجاد شود.
2. stateهای `queued`, `running`, `succeeded`, `blocked`, `failed` و زمان‌های claim/heartbeat/retry تعریف شوند.
3. `manualId` پایدار، `attempts`, `maxAttempts`, `nextRunAt`, `lastErrorCode` و پیام پاک‌سازی‌شده ذخیره شوند.
4. indexهای یکتا/زمانی برای claim و sweep اضافه شوند.
5. مدل invoice یک subdocument `tapinAutomation` داشته باشد و migration برای اسناد قدیمی backward-compatible باشد.

### ۱.۲ تنظیمات سایت

فایل‌های هدف:

- `src/settings/models/SiteConfig.ts`
- `src/app/api/settings/site-config/route.ts`
- `src/views/admin/site-settings/site-config/config-field-presets.ts`
- کامپوننت‌های فرم تنظیمات مربوط به ارسال/تاپین.

کارها:

1. تنظیمات غیرحساس فعال‌سازی، box id، وزن بسته‌بندی به گرم، نوع سفارش/بسته/محتوا/پرداخت، بیمه و retry اضافه شوند.
2. validation ادمین باید فعال‌سازی را بدون تکمیل همهٔ مقادیر متوقف کند.
3. token در env بماند و فقط وضعیت وجود/اعتبار آن در UI گزارش شود.
4. تست ذخیره/خواندن و عدم نمایش secret اضافه شود.

## Task 2 — سرویس دامنهٔ خودکارسازی

فایل‌های هدف جدید/موجود:

- `src/services/tapin/automation.ts`
- `src/services/tapin/invoice.ts`
- `src/services/tapin/client.ts`
- `src/services/tapin/orders.ts`
- `src/services/tapin/validation.ts`

کارها:

1. تابع pure برای تولید `manualId` پایدار از invoice id اضافه شود؛ retryها همان شناسه را حفظ کنند.
2. loader تنظیمات و validator واحد ساخته شود؛ هر خطا کد و پیام قابل اقدام داشته باشد.
3. resolver مقصد با state tree رسمی تاپین و تطبیق دقیق استان/شهر پیاده شود؛ نتیجهٔ مبهم blocked شود.
4. validator وزن خطوط، وزن بسته، مبلغ، کد پستی، تلفن و داده‌های گیرنده را اجرا کند.
5. payload ثبت از helper فعلی `invoiceToTapin` استفاده کند و تبدیل تومان/ریال را یک‌بار و صریح انجام دهد.
6. flow زیر در یک service orchestrator پیاده شود:
   - validate؛
   - quote؛
   - ثبت با `register_type = 0`؛
   - دریافت جزئیات؛
   - دریافت/اعتبارسنجی label metadata؛
   - ذخیرهٔ نتیجه و انتقال به `ready_to_print`.
7. پاسخ واقعی quote، order id، barcode، status و label id در مدل مناسب ذخیره شوند؛ PDF در DB ذخیره نشود.
8. خطای auth/validation/price به retry خودکار نرود و به blocked/failed مناسب تبدیل شود.
9. timeout با lookup رسمی بر اساس `manualId`/شناسهٔ سفارش reconcile شود؛ فقط پاسخ صریح «وجود ندارد» اجازهٔ retry بدهد.

## Task 3 — صف، worker و اتصال به پرداخت

فایل‌های هدف:

- `src/services/tapin/automation-queue.ts`
- `src/services/tapin/automation-worker.ts`
- `src/instrumentation.ts` یا runner فعلی worker.
- `src/orders/services/invoiceService.ts`

کارها:

1. `enqueueTapinShipmentJob(invoiceId)` با upsert یکتا ساخته شود.
2. بعد از commit transition به `paid`، enqueue صدا زده شود؛ قبل از commit یا برای paid تکراری اجرا نشود.
3. worker claim اتمیک، heartbeat، reclaim lockهای stale و backoff محدود داشته باشد.
4. اجرای job در worker اختصاصی/پس‌زمینه انجام شود و request پرداخت منتظر تاپین نماند.
5. sweep دوره‌ای سفارش‌های paid بدون shipment/job موفق را پیدا کند تا event از دست‌رفته recover شود.
6. اگر background job در instance عمومی خاموش است، enqueue پایدار بماند و worker اختصاصی آن را بردارد.
7. همهٔ transitionها audit شوند و خطاها بدون secret ثبت شوند.

## Task 4 — API مدیریتی و پنل ادمین

فایل‌های هدف:

- `src/orders/services/invoiceService.ts`
- `src/payments/paymentService.ts` فقط برای تست مسیر مشترک در صورت نیاز.
- `src/app/api/admin/tapin/shipments/route.ts`
- route جدید retry، در صورت نیاز: `src/app/api/admin/tapin/shipments/[invoiceId]/retry/route.ts`

کارها:

1. trigger فقط در service مشترک status update اضافه شود تا gatewayهای مختلف رفتار یکسان داشته باشند.
2. API retry فقط auth ادمین، state مناسب و idempotency job را قبول کند.
3. retry از endpoint عمومی جدا باشد و ثبت مستقیم بدون job ایجاد نکند.
4. APIهای detail/label موجود با مدل جدید سازگار شوند.

### پنل ادمین سفارش

فایل‌های هدف:

- `src/views/admin/orders/detail.tsx`
- `src/views/admin/orders/components/TapinShipmentCard.tsx` یا کامپوننت جدید مطابق ساختار target.
- serializer/API typeهای `InvoiceView`.

کارها:

1. `tapinShipment` و `tapinAutomation` در view model سفارش قرار گیرد.
2. کارت وضعیت‌های صف، در حال ثبت، آمادهٔ چاپ، blocked و failed را نمایش دهد.
3. quote/هزینهٔ واقعی، barcode و remote status فقط در صورت وجود نشان داده شود.
4. لینک label فقط پس از ذخیرهٔ واقعی label id فعال شود.
5. پیام اقدام باقی‌مانده دقیق باشد: «لیبل را چاپ و روی بسته نصب کنید؛ سپس طبق روش جمع‌آوری تحویل دهید».
6. retry با نمایش خطای قابل اصلاح و بدون افشای secret انجام شود.

## Task 5 — تست‌های یکپارچه و verification نهایی

ابتدا تست‌ها نوشته و عمداً قرمز اجرا می‌شوند؛ سپس implementation اضافه می‌شود.

### unit

- `tests/tapin-automation-validation.test.ts`
  - تنظیمات ناقص، مقصد نامعتبر، وزن صفر و مبلغ نامعتبر.
- `tests/tapin-automation-payload.test.ts`
  - واحد مبلغ، وزن کل، `manual_id` ثابت و `register_type = 0`.
- `tests/tapin-automation-idempotency.test.ts`
  - paid تکراری، upsert job و claim هم‌زمان.
- `tests/tapin-automation-reconciliation.test.ts`
  - timeout، lookup موفق، lookup ناموجود و نتیجهٔ نامعلوم.

### integration mock

- `tests/tapin-automation-flow.test.ts`
  - paid → enqueue → quote → register → read-back → label → ready-to-print.
  - auth/validation/price/timeout و state درست.
- تست route retry و تست عدم نمایش token در پاسخ.

### verification

- typecheck/lint پروژه.
- test suite مرتبط و سپس suite کامل موجود.
- build production.
- smoke test با mock server یا adapter ثبت‌شده، نه endpoint واقعی تاپین.

## ترتیب commitهای پیشنهادی

1. `docs: add tapin auto-registration implementation plan` (این سند)
2. `test: cover tapin automation validation and idempotency`
3. `feat: add durable tapin shipment jobs and invoice state`
4. `feat: trigger tapin automation after paid commit`
5. `feat: expose tapin automation status in admin`
6. `test: verify tapin worker and admin retry flow`

در پایان، قبل از هر push/deploy، verification کامل، بررسی diff و وضعیت branch انجام می‌شود. deploy یا mutation دیتابیس production فقط با درخواست صریح بعدی انجام خواهد شد.

## معیار پذیرش

- یک پرداخت موفق دقیقاً یک job یکتا می‌سازد.
- سفارش ناقص هرگز با وزن/کد/هزینهٔ حدسی به تاپین ارسال نمی‌شود.
- ثبت موفق، نتیجهٔ واقعی و label id واقعی را ذخیره می‌کند.
- timeout منجر به ثبت تکراری نمی‌شود.
- وضعیت داخلی آمادهٔ چاپ است، اما remote status تاپین خودکار به ۱ یا ۲ تغییر نمی‌کند.
- مدیر خطا، بارکد، هزینه، label و اقدام فیزیکی باقی‌مانده را در پنل می‌بیند.
- تست‌های مرتبط، typecheck، lint و build موفق هستند.
