export type TapinConfig = { token: string; shopId: string; baseUrl: string };
export type TapinQuoteInput = { provinceCode: number; cityCode: number; weightGrams: number; payType?: 0 | 1 | 2 | 3; orderType?: 1 | 3 | 5; packetType?: 1 | 2 | 3; contentType?: 1 | 2 | 3 };
export type TapinShipmentInput = TapinQuoteInput & { manualId: string; recipient: { name: string; mobile: string; address: string; postalCode: string }; items: Array<{ name: string; quantity: number; priceToman: number; weightGrams: number }>; registerType?: 0 | 1 | 2 };

export class TapinError extends Error { constructor(message: string, readonly status?: number, readonly details?: unknown) { super(message); this.name = "TapinError"; } }

async function call<T>(config: TapinConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, { ...init, headers: { Authorization: config.token, Accept: "application/json", "Content-Type": "application/json", ...(init.headers || {}) }, signal: AbortSignal.timeout(10_000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error || data?.errors) throw new TapinError(data?.message || data?.error || "tapin_request_failed", response.status, data);
  return data as T;
}

export function getTapinConfig(env: { TAPIN_TOKEN?: string; TAPIN_SHOP_ID?: string; TAPIN_BASE_URL?: string }): TapinConfig {
  if (!env.TAPIN_TOKEN || !env.TAPIN_SHOP_ID) throw new TapinError("tapin_not_configured");
  return { token: env.TAPIN_TOKEN, shopId: env.TAPIN_SHOP_ID, baseUrl: env.TAPIN_BASE_URL || "https://api.tapin.ir/api/v2/public" };
}

export async function quoteTapin(config: TapinConfig, input: TapinQuoteInput) {
  return call<{ data?: Record<string, number> }>(config, "/order/post/check-price/", { method: "POST", body: JSON.stringify({ shop_id: config.shopId, province: input.provinceCode, city: input.cityCode, weight: input.weightGrams, pay_type: input.payType ?? 1, order_type: input.orderType ?? 1, packet_type: input.packetType ?? 2, content_type: input.contentType ?? 1 }) });
}

export async function registerTapinShipment(config: TapinConfig, input: TapinShipmentInput) {
  return call<{ data: { id?: string; order_id?: string; barcode?: string; status?: number; total_price?: number; send_price?: number } }>(config, "/order/post/register/", { method: "POST", body: JSON.stringify({ shop_id: config.shopId, manual_id: input.manualId, province: input.provinceCode, city: input.cityCode, order_type: input.orderType ?? 1, register_type: input.registerType ?? 0, content_type: input.contentType ?? 1, packet_type: input.packetType ?? 2, weight: input.weightGrams, pay_type: input.payType ?? 1, recipient_name: input.recipient.name, recipient_mobile: input.recipient.mobile, recipient_address: input.recipient.address, recipient_postal_code: input.recipient.postalCode, products: input.items.map((item) => ({ name: item.name, count: item.quantity, price: item.priceToman, weight: item.weightGrams })) }) });
}

export async function trackTapinShipment(config: TapinConfig, orderId: string | number) {
  const numericOrderId = Number(orderId);
  if (!Number.isSafeInteger(numericOrderId) || numericOrderId < 1) throw new TapinError("tapin_order_id_invalid");
  return call<{ list?: Array<{ order_id?: number; barcode?: string; status?: number; last_change_status?: string }> }>(config, "/order/post/get-status/report/", { method: "POST", body: JSON.stringify({ orders_id: [numericOrderId] }) });
}
