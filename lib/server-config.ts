import { validateProductionConfig } from "./production-config";
import { isValidSmsOtpTemplateId } from "./sms-provider";

export type ServerEnvironment = {
  APP_ENV?: string;
  ADMIN_SESSION_SECRET?: string;
  OTP_PEPPER?: string;
  SMS_PROVIDER?: string;
  SMS_IR_API_KEY?: string;
  SMS_IR_OTP_TEMPLATE_ID?: string;
  SMS_IR_TEMPLATE_ID?: string;
  PAYMENT_PROVIDER?: string;
  SHIPPING_PROVIDER?: string;
  ZARINPAL_MERCHANT_ID?: string;
  TAPIN_TOKEN?: string;
  TAPIN_SHOP_ID?: string;
};

const weakValues = new Set([
  "",
  "local-admin-secret",
  "local-otp-pepper",
  "replace-with-a-long-random-secret",
  "replace-with-a-separate-random-secret",
]);

function value(environment: ServerEnvironment, key: keyof ServerEnvironment) {
  return String(environment[key] || "").trim();
}

export function validateServerConfig(environment: ServerEnvironment) {
  const errors: string[] = [];
  const appEnv = value(environment, "APP_ENV").toLowerCase() || "local";
  const smsProvider = value(environment, "SMS_PROVIDER").toLowerCase() || "mock";
  const paymentProvider = value(environment, "PAYMENT_PROVIDER").toLowerCase() || "mock";
  const shippingProvider = value(environment, "SHIPPING_PROVIDER").toLowerCase() || "mock";
  const smsOtpTemplateId = value(environment, "SMS_IR_OTP_TEMPLATE_ID") || value(environment, "SMS_IR_TEMPLATE_ID");

  if (!new Set(["local", "test", "server", "staging", "production"]).has(appEnv)) {
    errors.push("APP_ENV is not supported");
  }
  if (!weakValues.has(value(environment, "ADMIN_SESSION_SECRET")) && value(environment, "ADMIN_SESSION_SECRET").length < 32) {
    errors.push("ADMIN_SESSION_SECRET must contain at least 32 characters");
  }
  if (!weakValues.has(value(environment, "OTP_PEPPER")) && value(environment, "OTP_PEPPER").length < 32) {
    errors.push("OTP_PEPPER must contain at least 32 characters");
  }
  if (weakValues.has(value(environment, "ADMIN_SESSION_SECRET"))) {
    errors.push("ADMIN_SESSION_SECRET is missing or uses a development default");
  }
  if (weakValues.has(value(environment, "OTP_PEPPER"))) {
    errors.push("OTP_PEPPER is missing or uses a development default");
  }

  if (!["mock", "sms_ir"].includes(smsProvider)) {
    errors.push("SMS_PROVIDER must be mock or sms_ir");
  }
  if (smsProvider === "sms_ir" && (!value(environment, "SMS_IR_API_KEY") || !smsOtpTemplateId)) {
    errors.push("SMS_IR_API_KEY and SMS_IR_OTP_TEMPLATE_ID are required when SMS_PROVIDER=sms_ir");
  } else if (smsProvider === "sms_ir" && !isValidSmsOtpTemplateId(smsOtpTemplateId)) {
    errors.push("SMS_IR_OTP_TEMPLATE_ID must be a positive integer");
  }

  if (appEnv === "production") {
    errors.push(...validateProductionConfig(environment).filter((error) => !errors.includes(error)));
  } else if (!["mock", "zarinpal", "http"].includes(paymentProvider)) {
    errors.push("PAYMENT_PROVIDER is not supported");
  } else if (!["mock", "tapin", "http"].includes(shippingProvider)) {
    errors.push("SHIPPING_PROVIDER is not supported");
  }

  return { ok: errors.length === 0, errors };
}
