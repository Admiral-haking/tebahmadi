# استقرار طب احمدی روی سرور

این پروژه به‌صورت local-first روی Node.js، SQLite، PM2 و nginx اجرا می‌شود. سرویس خارجی برای اجرای هستهٔ سایت لازم نیست؛ Tapin، زرین‌پال و SMS.ir فقط در صورت قراردادن credential فعال می‌شوند.

## مشخصات فعلی

```text
host: 62.3.41.87
user: ali
path: /home/ali/tebahmadi
app port: 3210
domain: tebahmadi.ir
```

## secretهای سرور

روی سرور، فایل نمونه را به تنظیمات خصوصی تبدیل کن؛ این فایل در Git نیست:

```bash
cd /home/ali/tebahmadi
cp deploy/server.env.example .env.server
umask 077
sed -i "s#^SMS_IR_API_KEY=.*#SMS_IR_API_KEY=<کلید-واقعی-SMS.ir>#" .env.server
sed -i "s#^SMS_IR_OTP_TEMPLATE_ID=.*#SMS_IR_OTP_TEMPLATE_ID=<شناسه-قالب-تأییدشده>#" .env.server
sed -i "s#^ADMIN_SESSION_SECRET=.*#ADMIN_SESSION_SECRET=$(openssl rand -hex 32)#" .env.server
sed -i "s#^OTP_PEPPER=.*#OTP_PEPPER=$(openssl rand -hex 32)#" .env.server
chmod 600 .env.server
```

برای فعال‌سازی provider واقعی، متغیرهای `.env.example` را فقط در همین فایل server-only قرار بده. secret را داخل source، commit یا log قرار نده.

شناسهٔ قالب OTP در کد ثابت نیست. قالب فعال باید پارامتر `CODE` داشته باشد و آخرین خط پیامک نهایی را به شکل `@tebahmadi.ir #1234` تولید کند تا مرورگرهای پشتیبان بتوانند کد را در فیلد ورود قرار دهند.

## انتشار

از checkout توسعه:

```bash
./scripts/deploy-server.sh
```

این اسکریپت به‌ترتیب fetch و fast-forward روی branch مشخص، نصب lockfile، backup، migration افزایشی، verify دیتابیس، build، بررسی `.env.server`، restart PM2 و health/readiness check را انجام می‌دهد. عمداً seed محلی اجرا نمی‌شود.

## PM2 و nginx

فایل `ecosystem.config.cjs` سرویس production preview را روی پورت 3210 اجرا می‌کند. قالب nginx در `deploy/nginx/tebahmadi.conf` است و باید در مسیر `/etc/nginx/sites-available/tebahmadi` قرار گیرد، سپس:

```bash
sudo ln -sfn /etc/nginx/sites-available/tebahmadi /etc/nginx/sites-enabled/tebahmadi
sudo nginx -t
sudo systemctl reload nginx
```

PM2 برای user `ali` باید با systemd فعال و process list ذخیره شود:

```bash
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ali --hp /home/ali
```

اگر PM2 در مسیر دیگری نصب شده است، مسیر خروجی همان دستور `pm2 startup` را عیناً اجرا کن. این کار فقط یک‌بار برای user `ali` انجام می‌شود.

## بررسی عمومی

```bash
./scripts/health-check.sh https://tebahmadi.ir
```

خروجی سلامت باید `status: ok` باشد، readiness در حالت سرور باید موفق باشد و فایل تأیید enamad صفر بایت گزارش شود.

## rollback

قبل از rollback، commit سالم را مشخص کن و روی سرور اجرا کن:

```bash
cd /home/ali/tebahmadi
git fetch origin
git reset --hard <KNOWN_GOOD_COMMIT>
pnpm install --frozen-lockfile
pnpm build
. ./.env.server
pm2 restart tebahmadi --update-env
pm2 save
```
