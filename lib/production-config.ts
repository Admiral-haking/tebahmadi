export type ProductionConfigInput = Record<string, string | undefined>;

export function validateProductionConfig(env: ProductionConfigInput): string[] {
  const errors: string[] = [];
  if (String(env.APP_ENV || "").trim().toLowerCase() !== "production") errors.push("APP_ENV must be production");
  const provider = (name: string) => String(env[name] || "").trim().toLowerCase();
  const payment = provider("PAYMENT_PROVIDER");
  if (!payment || payment === "mock") errors.push("PAYMENT_PROVIDER must be a real provider in production");
  if (payment === "zarinpal" && !env.ZARINPAL_MERCHANT_ID) errors.push("ZARINPAL_MERCHANT_ID is missing");
  if (payment === "http" && (!env.PAYMENT_API_URL || !env.PAYMENT_API_TOKEN)) errors.push("PAYMENT_API_URL and PAYMENT_API_TOKEN are required for http payment");
  if (!new Set(["zarinpal", "http"]).has(payment)) errors.push(`Unsupported PAYMENT_PROVIDER: ${payment || "(empty)"}`);
  const shipping = provider("SHIPPING_PROVIDER");
  if (!shipping || shipping === "mock") errors.push("SHIPPING_PROVIDER must be a real provider in production");
  if (shipping === "tapin" && (!env.TAPIN_TOKEN || !env.TAPIN_SHOP_ID)) errors.push("TAPIN_TOKEN and TAPIN_SHOP_ID are required for Tapin");
  if (shipping === "http" && (!env.SHIPPING_API_URL || !env.SHIPPING_API_TOKEN)) errors.push("SHIPPING_API_URL and SHIPPING_API_TOKEN are required for http shipping");
  if (!new Set(["tapin", "http"]).has(shipping)) errors.push(`Unsupported SHIPPING_PROVIDER: ${shipping || "(empty)"}`);
  const sms = provider("SMS_PROVIDER");
  if (sms !== "sms_ir") errors.push("SMS_PROVIDER must be sms_ir in production");
  if (sms === "sms_ir" && (!env.SMS_IR_API_KEY || !env.SMS_IR_TEMPLATE_ID)) errors.push("SMS_IR_API_KEY and SMS_IR_TEMPLATE_ID are missing");
  for (const name of ["ADMIN_SESSION_SECRET", "OTP_PEPPER"]) if (!env[name]) errors.push(`${name} is missing`);
  return errors;
}
