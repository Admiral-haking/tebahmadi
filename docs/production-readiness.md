# چک‌لیست انتشار طب احمدی

این پروژه روی Node.js، SQLite محلی، PM2 و nginx اجرا می‌شود. اجرای سایت به Cloudflare، D1، Wrangler یا سرویس ابری نیاز ندارد. SMS.ir، زرین‌پال و Tapin فقط adapterهای اختیاری هستند و با credential محیط سرور فعال می‌شوند.

## پیش‌نیازهای سرور

- [ ] checkout سرور در `/home/ali/tebahmadi` روی branch `main` تمیز است.
- [ ] user سرویس `ali` است و PM2 با همین user اجرا می‌شود.
- [ ] فایل `/home/ali/tebahmadi/.env.server` وجود دارد و mode آن `600` است.
- [ ] `ADMIN_SESSION_SECRET` و `OTP_PEPPER` تصادفی و جدا از هم هستند.
- [ ] هیچ secret در source، Git، bundle یا log چاپ نشده است.
- [ ] nginx سایت را به `127.0.0.1:3210` proxy می‌کند.

## تنظیمات محیط

از `deploy/server.env.example` کپی بگیر و مقدارهای واقعی را فقط در `.env.server` قرار بده:

```sh
APP_ENV=server
APP_RUNTIME=node
NEXT_PUBLIC_SITE_URL=https://tebahmadi.ir
PAYMENT_PROVIDER=mock
SHIPPING_PROVIDER=mock
SMS_PROVIDER=sms_ir
SMS_IR_OTP_TEMPLATE_ID=<approved-otp-template-id>
```

`SMS_IR_API_KEY`، secret نشست و pepper فقط در `.env.server` قرار می‌گیرند. دستور بررسی محیط مقدار secret را چاپ نمی‌کند:

```sh
set -a
. ./.env.server
set +a
pnpm config:verify:server
```

برای فعال‌سازی production کامل، علاوه بر SMS.ir باید `PAYMENT_PROVIDER=zarinpal` و `SHIPPING_PROVIDER=tapin` و credential معتبر sandbox/production آن‌ها تنظیم و جداگانه تست شوند. تا آن زمان پرداخت و ارسال mock باقی می‌مانند.

## انتشار کنترل‌شده

از checkout توسعه و پس از commit و push به GitHub:

```sh
./scripts/deploy-server.sh
```

اسکریپت:

1. فقط fast-forward از `origin/main` می‌گیرد و با تغییر tracked روی سرور متوقف می‌شود.
2. lockfile را نصب می‌کند.
3. قبل از migration از SQLite سرور backup می‌گیرد.
4. migrationهای ثبت‌نشده را اجرا و دیتابیس را verify می‌کند.
5. build می‌گیرد.
6. mode و تنظیمات `.env.server` را بررسی می‌کند.
7. PM2 را با محیط جدید restart و process list را ذخیره می‌کند.
8. `/api/health` و `/api/readiness` را از localhost بررسی می‌کند.

برای بررسی عمومی:

```sh
./scripts/health-check.sh https://tebahmadi.ir
```

## PM2 و nginx

فایل [ecosystem.config.cjs](../ecosystem.config.cjs) مقدارهای provider را از محیط shell می‌گیرد و دیگر مقدار `mock` را روی `.env.server` تحمیل نمی‌کند. nginx از [deploy/nginx/tebahmadi.conf](../deploy/nginx/tebahmadi.conf) استفاده می‌کند:

```sh
sudo install -m 0644 deploy/nginx/tebahmadi.conf /etc/nginx/sites-available/tebahmadi
sudo ln -sfn /etc/nginx/sites-available/tebahmadi /etc/nginx/sites-enabled/tebahmadi
sudo nginx -t
sudo systemctl reload nginx
```

اگر TLS در لایهٔ CDN/Arvan terminate می‌شود، ارتباط origin با nginx همچنان روی port 80 داخلی باقی می‌ماند؛ health عمومی باید از دامنهٔ HTTPS بررسی شود.

## SMS.ir

قالب تأییدشدهٔ OTP از متغیر server-only به نام `SMS_IR_OTP_TEMPLATE_ID` خوانده می‌شود و پارامتر `CODE` را دریافت می‌کند. شناسه در source ثابت نیست و با تغییر قالب فقط تنظیم سرور تغییر می‌کند. مسیر درخواست OTP کد را server-side تولید می‌کند، شماره را normalize می‌کند و payload زیر را به adapter می‌دهد:

```json
{
  "mobile": "09120000000",
  "templateId": "<approved-otp-template-id>",
  "parameters": [{ "name": "CODE", "value": "1234" }]
}
```

برای تست واقعی فقط یک درخواست به شمارهٔ متعلق به صاحب سامانه بفرست. پاسخ provider و رسیدن پیامک را جداگانه بررسی کن؛ HTTP موفق به‌تنهایی اثبات تحویل پیامک نیست. کد در فرم ورود با `autocomplete="one-time-code"` و Web OTP در صورت پشتیبانی مرورگر قابل درج خودکار است؛ submit همچنان با تأیید کاربر انجام می‌شود.

برای WebOTP، پیامک دریافتی باید در آخرین خط، اتصال دامنه و کد را دقیقاً به شکل زیر داشته باشد:

```text
@tebahmadi.ir #1234
```

بنابراین قالب پنل SMS.ir باید علاوه بر متن معرفی و `#CODE#`، این خط origin-bound را نیز تولید کند. معیار، متن نهایی پیامک دریافتی است؛ اگر پنل برای استفادهٔ دوباره از پارامتر به escape ویژه نیاز داشت، ابتدا با یک پیامک آزمایشی تأیید شود. شناسهٔ عددی قالب فقط در `.env.server` نگه‌داری می‌شود و تغییر آن نیازی به تغییر کد ندارد.

## backup و rollback

backup محلی قبل از migration ساخته می‌شود. برای backup دستی:

```sh
pnpm db:backup:local
pnpm db:verify
```

rollback فقط به commit سالم و backup تأییدشده محدود است؛ migration destructive یا حذف سفارش و موجودی انجام نشود:

```sh
cd /home/ali/tebahmadi
git fetch origin
git reset --hard <KNOWN_GOOD_COMMIT>
pnpm install --frozen-lockfile
pnpm build
set -a; . ./.env.server; set +a
pnpm config:verify:server
pm2 restart tebahmadi --update-env
pm2 save
```

در خطای provider، ابتدا همان provider را به mock/manual برگردان و سفارش‌ها، پرداخت‌ها، shipmentها و audit logها را حذف نکن.
