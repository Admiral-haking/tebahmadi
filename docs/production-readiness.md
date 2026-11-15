# چک‌لیست انتشار production

این پروژه local-first است و deploy یا migration production را خودکار انجام نمی‌دهد.

این سند یک runbook اجرایی است؛ وجود تیک‌ها به‌تنهایی به معنی فعال بودن پرداخت آنلاین یا
اتصال واقعی Tapin نیست. تا وقتی credential معتبر، دسترسی Wrangler و تأیید sandbox وجود
نداشته باشد، فقط mock provider روی local قابل استفاده است.

## پیش‌نیازها

- [ ] backup قابل بازیابی از D1 production تهیه و checksum آن ثبت شده است.
- [ ] مقدار `ADMIN_SESSION_SECRET` و `OTP_PEPPER` با secret manager تنظیم شده‌اند.
- [ ] `ZARINPAL_MERCHANT_ID` در sandbox تنظیم شده و `ZARINPAL_SANDBOX=true` است.
- [ ] `TAPIN_TOKEN` و `TAPIN_SHOP_ID` در محیط تست معتبر هستند.
- [ ] اگر adapter عمومی استفاده می‌شود، `PAYMENT_PROVIDER`/`SHIPPING_PROVIDER` فقط با URL و token محیط secret manager تنظیم شده‌اند؛ در غیر این صورت مقدار `mock` باقی می‌ماند.
- [ ] credentialها در source، `.env.example`، bundle و log وجود ندارند.

## ترتیب فعال‌سازی امن

ترتیب زیر باید حفظ شود. فعال‌سازی provider واقعی قبل از موفق شدن readiness و callback
عمومی می‌تواند باعث سفارش‌های پرداخت‌نشده یا مرسوله‌های تکراری شود.

1. **Local:** migration، seed، تست و smoke با `mock`.
2. **Sandbox:** ZarinPal sandbox و Tapin test با secretهای خارج از repository.
3. **Production data:** backup، checksum، اجرای migration افزایشی و verify کردن tracking.
4. **Worker:** deploy با providerها خاموش یا در حالت امن، سپس health/readiness.
5. **Callback:** تست callback واقعی از URL عمومی و تکرار همان callback برای idempotency.
6. **فعال‌سازی:** ابتدا payment، سپس shipping؛ هر مرحله با feature flag و مانیتورینگ.

### متغیرهای محیطی

نمونهٔ زیر فقط نام متغیرها را نشان می‌دهد و نباید با مقدار واقعی در shell history یا Git
ذخیره شود:

```sh
export APP_ENV=production
export PAYMENT_PROVIDER=zarinpal
export SHIPPING_PROVIDER=tapin
export SMS_PROVIDER=sms_ir
export ZARINPAL_MERCHANT_ID='set-in-secret-manager'
export ZARINPAL_SANDBOX=true
export TAPIN_TOKEN='set-in-secret-manager'
export TAPIN_SHOP_ID='set-in-secret-manager'
export ADMIN_SESSION_SECRET='set-in-secret-manager'
export OTP_PEPPER='set-in-secret-manager'
export SMS_IR_API_KEY='set-in-secret-manager'
export SMS_IR_TEMPLATE_ID='set-in-secret-manager'
```

`pnpm config:verify:production` فقط نام provider و خطاهای configuration را چاپ می‌کند؛
secretها را چاپ نمی‌کند. در production هر مقدار `mock` عمداً رد می‌شود.

## بررسی قبل از فعال‌سازی

```sh
pnpm install --frozen-lockfile
pnpm config:verify:production
pnpm test:all
pnpm db:verify
```

- [ ] `/api/health` مقدار `ok` برمی‌گرداند.
- [ ] `/api/readiness` مقدار `ready`، `database=ok` و `providers.payment.configured=true`، `providers.shipping.configured=true` و `providers.sms.configured=true` برمی‌گرداند؛ credential ناقص باید `503 not_ready` بدهد.
- [ ] برای سفارش عمومی، Origin معتبر و محدودیت rate limit بررسی شده است.
- [ ] پرداخت sandbox، callback تکراری و مبلغ server-side بررسی شده‌اند.
- [ ] مسیر refund با provider واقعی تأیید شده است؛ تا قبل از آن، ZarinPal refund را موفق اعلام نمی‌کند و refund production باید دستی و خارج از سامانه reconcile شود.
- [ ] ثبت shipment در Tapin sandbox، retry و جلوگیری از ثبت تکراری بررسی شده‌اند.
- [ ] `POST /api/admin/shipping/tapin/track` با provider mock/http و endpoint رسمی Tapin (`order/post/get-status/report`) تست شده و تغییر هم‌زمان وضعیت shipment، سفارش و timeline تأیید شده است.
- [ ] خروجی سفارش، tracking و audit log بررسی شده‌اند.

## migration و انتشار

### local

```sh
pnpm db:backup:local
pnpm db:verify:backup .wrangler/backups/<backup>.sql
pnpm db:migrate:local
pnpm db:seed:local
pnpm db:verify
pnpm smoke:local
```

`db:reset:local` فقط برای توسعه است؛ قبل از reset خودش backup می‌سازد و نباید در
production اجرا شود.

### production D1

این مرحله نیازمند دسترسی واقعی به حساب Cloudflare، نام database و مجوز Wrangler است و
از داخل تست local اجرا نمی‌شود. پس از backup تأییدشده و review migrationها:

نام database را از محیط deployment بگیرید و در command یا source hardcode نکنید. runner
محافظت‌شدهٔ همین repository از tracking سفارشی `schema_migrations` استفاده می‌کند:

```sh
pnpm build
D1_DATABASE_NAME='<database-name>' \
CONFIRM_REMOTE_MIGRATION=YES \
WRANGLER_CONFIG='<optional-wrangler-config>' \
pnpm db:migrate:remote
```

این command فقط بعد از backup و review دستی migrationها مجاز است، migrationهای ثبت‌شده را
دوباره اجرا نمی‌کند، seed نمی‌زند و در پایان tracking کامل را verify می‌کند. اگر محیط شما
از config پیش‌فرض Wrangler استفاده می‌کند، `WRANGLER_CONFIG` را حذف کنید. هیچ migration را
دوباره با `--file` دستی replay نکنید.

بعد از migration، Worker را deploy کنید و `/api/health`، `/api/readiness`، یک checkout
sandbox و callback عمومی را بررسی کنید. deploy واقعی و migration remote عمداً در این
checkout انجام نشده است.

فعال‌سازی فروش production بدون قرارداد refund معتبر مجاز نیست. وضعیت `refunded` در UI
به‌تنهایی انتقال وجه را ثابت نمی‌کند؛ تنها پاسخ موفق adapter و ثبت audit/financial entry
معتبر است.

## rollback

- کد قبلی را آمادهٔ deploy نگه دارید.
- در خطای provider، feature flag را به mock/manual برگردانید؛ سفارش‌ها و auditها را حذف نکنید.
- migration destructive انجام ندهید؛ rollback داده‌ای فقط از backup تأییدشده انجام شود.
- در صورت callback ناموفق، سفارش را با authority/reference و audit log reconcile کنید.

### ترتیب rollback عملیاتی

1. provider یا feature flag مشکل‌دار را غیرفعال و ثبت incident کنید.
2. سفارش‌های pending را دوباره شارژ یا ثبت مرسوله نکنید؛ با authority/reference بررسی کنید.
3. در صورت مشکل کد، فقط Worker را به نسخهٔ قبلی برگردانید؛ schema جدید باید با نسخهٔ قبلی
   سازگار باشد.
4. در صورت خرابی داده، restore فقط از backupی انجام شود که `db:verify:backup` یا معادل
   رسمی D1 آن را سالم اعلام کرده و تأیید صاحب داده را دارد.
5. پس از restore، `schema_migrations`، پرداخت‌ها، shipmentها و audit log را reconcile کنید.

هیچ rollback خودکاری برای حذف جدول یا بازگرداندن migration وجود ندارد؛ این تصمیم عمدی است
تا از از دست رفتن سفارش و موجودی جلوگیری شود.
