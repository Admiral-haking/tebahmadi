import { validateServerConfig } from "../lib/server-config.ts";

const result = validateServerConfig(process.env);
if (!result.ok) {
  console.error(JSON.stringify({ ok: false, errors: result.errors }));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  environment: String(process.env.APP_ENV || "local").toLowerCase(),
  providers: {
    payment: String(process.env.PAYMENT_PROVIDER || "mock").toLowerCase(),
    shipping: String(process.env.SHIPPING_PROVIDER || "mock").toLowerCase(),
    sms: String(process.env.SMS_PROVIDER || "mock").toLowerCase(),
  },
  secrets: {
    adminSession: Boolean(process.env.ADMIN_SESSION_SECRET),
    otpPepper: Boolean(process.env.OTP_PEPPER),
    smsIrApiKey: Boolean(process.env.SMS_IR_API_KEY),
  },
}));
