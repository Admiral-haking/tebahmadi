export type ZarinpalConfig = { merchantId: string; sandbox: boolean; amountUnit: "toman" | "rial" };
export type ZarinpalRequest = { amountToman: number; description: string; callbackUrl: string; email?: string; mobile?: string };
export type ZarinpalVerify = { ok: boolean; code: number; refId?: string; raw: unknown };

const urls = {
  sandbox: { request: "https://sandbox.zarinpal.com/pg/v4/payment/request.json", verify: "https://sandbox.zarinpal.com/pg/v4/payment/verify.json", gateway: "https://sandbox.zarinpal.com/pg/StartPay/" },
  production: { request: "https://payment.zarinpal.com/pg/v4/payment/request.json", verify: "https://payment.zarinpal.com/pg/v4/payment/verify.json", gateway: "https://payment.zarinpal.com/pg/StartPay/" },
} as const;

const gatewayAmount = (toman: number, unit: ZarinpalConfig["amountUnit"]) => unit === "rial" ? Math.round(toman / 10) : Math.round(toman * 10);

export function zarinpalGatewayUrl(config: ZarinpalConfig, authority: string): string {
  return `${urls[config.sandbox ? "sandbox" : "production"].gateway}${encodeURIComponent(authority)}`;
}

async function post(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`zarinpal_http_${response.status}`);
  return response.json();
}

export async function requestZarinpalPayment(config: ZarinpalConfig, input: ZarinpalRequest) {
  const endpoint = urls[config.sandbox ? "sandbox" : "production"];
  const payload = await post(endpoint.request, { merchant_id: config.merchantId, amount: gatewayAmount(input.amountToman, config.amountUnit), currency: "IRT", description: input.description, callback_url: input.callbackUrl, metadata: { email: input.email, mobile: input.mobile } });
  const data = payload?.data ?? payload;
  const code = Number(data?.code ?? data?.Status);
  const authority = data?.authority ?? data?.Authority;
  if (![100, 101].includes(code) || !authority) throw new Error(`zarinpal_request_rejected_${code || "unknown"}`);
  return { authority: String(authority), gatewayUrl: zarinpalGatewayUrl(config, String(authority)), gatewayAmount: gatewayAmount(input.amountToman, config.amountUnit) };
}

export async function verifyZarinpalPayment(config: ZarinpalConfig, input: { authority: string; amountToman: number }): Promise<ZarinpalVerify> {
  const endpoint = urls[config.sandbox ? "sandbox" : "production"];
  const payload = await post(endpoint.verify, { merchant_id: config.merchantId, amount: gatewayAmount(input.amountToman, config.amountUnit), authority: input.authority });
  const data = payload?.data ?? payload;
  const code = Number(data?.code ?? data?.Status ?? -1);
  return { ok: [100, 101].includes(code), code, refId: data?.ref_id ?? data?.RefID, raw: payload };
}

export function getZarinpalConfig(env: { ZARINPAL_MERCHANT_ID?: string; ZARINPAL_SANDBOX?: string; ZARINPAL_AMOUNT_UNIT?: string }): ZarinpalConfig {
  if (!env.ZARINPAL_MERCHANT_ID) throw new Error("zarinpal_not_configured");
  return { merchantId: env.ZARINPAL_MERCHANT_ID, sandbox: env.ZARINPAL_SANDBOX === "true", amountUnit: env.ZARINPAL_AMOUNT_UNIT === "rial" ? "rial" : "toman" };
}
