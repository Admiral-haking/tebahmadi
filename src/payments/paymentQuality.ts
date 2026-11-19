import { normalizeCallbackPath } from "@/payments/paymentCalc";
import { getSnappPayClient, type SnappPayEligibility } from "@/payments/snapppayAdapter";

export type PaymentQualityGatewayId = "zarinpal" | "torob" | "digipay" | "azkivam" | "snapppay";
export type PaymentQualityStatus = "healthy" | "warning" | "critical";
export type PaymentQualityCapabilityStatus = "ready" | "manual" | "missing";

export type PaymentQualityCapability = {
  key: "config" | "callback" | "verify" | "eligibility";
  label: string;
  status: PaymentQualityCapabilityStatus;
  note: string;
};

export type PaymentQualityGateway = {
  id: PaymentQualityGatewayId;
  title: string;
  status: PaymentQualityStatus;
  score: number;
  configured: boolean;
  callbackUrl: string | null;
  missingKeys: string[];
  warnings: string[];
  capabilities: PaymentQualityCapability[];
};

export type PaymentQualityResponse = {
  generatedAt: string;
  summary: {
    healthy: number;
    warning: number;
    critical: number;
    totalMissingKeys: number;
  };
  gateways: PaymentQualityGateway[];
};

export type SnappPayEligibilityCheckResult = {
  gateway: "snapppay";
  ok: boolean;
  amountRial: number;
  result?: SnappPayEligibility;
  message?: string;
};

type GatewayConfig = {
  id: PaymentQualityGatewayId;
  title: string;
  requiredKeys: string[];
  callbackPathKey?: string;
  defaultCallbackPath: string;
  supportsEligibility?: boolean;
};

const GATEWAYS: GatewayConfig[] = [
  {
    id: "zarinpal",
    title: "زرین‌پال",
    requiredKeys: ["ZARINPAL_MERCHANT_ID"],
    callbackPathKey: "PAYMENT_CALLBACK_PATH",
    defaultCallbackPath: "/payments/verify",
  },
  {
    id: "torob",
    title: "ترب‌پی",
    requiredKeys: ["TOROBPAY_CLIENT_ID", "TOROBPAY_CLIENT_SECRET", "TOROBPAY_USERNAME", "TOROBPAY_PASSWORD"],
    callbackPathKey: "TOROBPAY_CALLBACK_PATH",
    defaultCallbackPath: "/api/payments/torob/callback",
  },
  {
    id: "digipay",
    title: "دیجی‌پی",
    requiredKeys: ["DIGIPAY_CLIENT_ID", "DIGIPAY_CLIENT_SECRET", "DIGIPAY_USERNAME", "DIGIPAY_PASSWORD"],
    callbackPathKey: "DIGIPAY_CALLBACK_PATH",
    defaultCallbackPath: "/api/payments/digipay/callback",
  },
  {
    id: "azkivam",
    title: "ازکی‌وام",
    requiredKeys: ["AZKIVAM_MERCHANT_ID", "AZKIVAM_USERNAME", "AZKIVAM_PASSWORD", "AZKIVAM_API_KEY"],
    callbackPathKey: "PAYMENT_CALLBACK_PATH",
    defaultCallbackPath: "/payments/verify",
  },
  {
    id: "snapppay",
    title: "اسنپ‌پی",
    requiredKeys: ["SNAPPPAY_BASE_URL", "SNAPPPAY_CLIENT_ID", "SNAPPPAY_CLIENT_SECRET", "SNAPPPAY_USERNAME", "SNAPPPAY_PASSWORD"],
    callbackPathKey: "SNAPPPAY_CALLBACK_PATH",
    defaultCallbackPath: "/api/payments/snapppay/callback",
    supportsEligibility: true,
  },
];

function readEnv(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildAbsoluteCallbackUrl(path: string) {
  const baseUrl = readEnv("APP_BASE_URL");
  if (!baseUrl || !isHttpUrl(baseUrl)) {
    return null;
  }
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return new URL(normalizeCallbackPath(path), `${normalizedBase}/`).toString();
}

function calculateStatus(score: number): PaymentQualityStatus {
  if (score < 50) return "critical";
  if (score < 85) return "warning";
  return "healthy";
}

function buildGatewayQuality(config: GatewayConfig): PaymentQualityGateway {
  const missingKeys = config.requiredKeys.filter((key) => !readEnv(key));
  const warnings: string[] = [];
  const callbackPath = normalizeCallbackPath(readEnv(config.callbackPathKey ?? "") || config.defaultCallbackPath);
  const callbackUrl = buildAbsoluteCallbackUrl(callbackPath);

  if (!readEnv("APP_BASE_URL")) {
    warnings.push("APP_BASE_URL تنظیم نشده و callback کامل قابل ساخت نیست.");
  } else if (!callbackUrl) {
    warnings.push("APP_BASE_URL یا مسیر callback فرمت معتبر ندارد.");
  }

  if (config.callbackPathKey && readEnv(config.callbackPathKey) && callbackPath !== config.defaultCallbackPath) {
    warnings.push(`مسیر callback با مقدار پیشنهادی ${config.defaultCallbackPath} متفاوت است.`);
  }

  if (config.id === "azkivam") {
    const apiKey = readEnv("AZKIVAM_API_KEY");
    if (apiKey && !/^[a-f0-9]{32}$|^[a-f0-9]{48}$|^[a-f0-9]{64}$/i.test(apiKey)) {
      warnings.push("AZKIVAM_API_KEY باید hex با طول 16، 24 یا 32 بایت باشد.");
    }
  }

  let score = 100;
  score -= missingKeys.length * 18;
  score -= warnings.length * 8;
  if (!callbackUrl) score -= 18;
  score = Math.max(0, Math.min(100, score));
  const configured = missingKeys.length === 0;

  return {
    id: config.id,
    title: config.title,
    status: calculateStatus(score),
    score,
    configured,
    callbackUrl,
    missingKeys,
    warnings,
    capabilities: [
      {
        key: "config",
        label: "تنظیمات",
        status: configured ? "ready" : "missing",
        note: configured ? "کلیدهای ضروری تنظیم شده‌اند." : "کلیدهای ضروری ناقص هستند.",
      },
      {
        key: "callback",
        label: "Callback",
        status: callbackUrl ? "ready" : "missing",
        note: callbackUrl ?? "برای ساخت callback کامل، APP_BASE_URL و مسیر callback لازم است.",
      },
      {
        key: "verify",
        label: "Verify",
        status: configured ? "manual" : "missing",
        note: configured ? "verify فقط با تراکنش واقعی/توکن برگشتی قابل تست است." : "تا تنظیمات کامل نشود verify قابل اتکا نیست.",
      },
      {
        key: "eligibility",
        label: "Eligibility",
        status: config.supportsEligibility && configured ? "ready" : config.supportsEligibility ? "missing" : "manual",
        note: config.supportsEligibility ? "تست زنده eligibility از دکمه صفحه اجرا می‌شود." : "این درگاه سرویس eligibility مستقل ندارد.",
      },
    ],
  };
}

export function getPaymentQuality(): PaymentQualityResponse {
  const gateways = GATEWAYS.map(buildGatewayQuality);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      healthy: gateways.filter((item) => item.status === "healthy").length,
      warning: gateways.filter((item) => item.status === "warning").length,
      critical: gateways.filter((item) => item.status === "critical").length,
      totalMissingKeys: gateways.reduce((sum, item) => sum + item.missingKeys.length, 0),
    },
    gateways,
  };
}

export async function checkSnappPayEligibility(amountRial: number): Promise<SnappPayEligibilityCheckResult> {
  const required = ["SNAPPPAY_BASE_URL", "SNAPPPAY_CLIENT_ID", "SNAPPPAY_CLIENT_SECRET", "SNAPPPAY_USERNAME", "SNAPPPAY_PASSWORD"];
  const missing = required.filter((key) => !readEnv(key));
  if (missing.length) {
    return {
      gateway: "snapppay",
      ok: false,
      amountRial,
      message: `تنظیمات اسنپ‌پی ناقص است: ${missing.join(", ")}`,
    };
  }

  try {
    const client = getSnappPayClient({
      baseUrl: readEnv("SNAPPPAY_BASE_URL"),
      clientId: readEnv("SNAPPPAY_CLIENT_ID"),
      clientSecret: readEnv("SNAPPPAY_CLIENT_SECRET"),
      username: readEnv("SNAPPPAY_USERNAME"),
      password: readEnv("SNAPPPAY_PASSWORD"),
      venture: readEnv("SNAPPPAY_VENTURE") || undefined,
    });
    const methodTypes = readEnv("SNAPPPAY_PAYMENT_METHOD_TYPES")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    const result = await client.checkEligibility(amountRial, methodTypes.length ? methodTypes : undefined);

    return {
      gateway: "snapppay",
      ok: Boolean(result.eligible),
      amountRial,
      result,
      message: result.eligible ? "اسنپ‌پی برای مبلغ تست eligible است." : "اسنپ‌پی برای مبلغ تست eligible نیست.",
    };
  } catch (error) {
    return {
      gateway: "snapppay",
      ok: false,
      amountRial,
      message: error instanceof Error ? error.message : "خطا در تست eligibility اسنپ‌پی",
    };
  }
}
