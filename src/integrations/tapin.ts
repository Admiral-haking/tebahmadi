export type TapinShipmentStatus = 'quoted' | 'registered' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';

export interface TapinConfig {
  token: string;
  shopId: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface TapinRecipient {
  name: string;
  mobile: string;
  address: string;
  postalCode: string;
}

export interface TapinItem {
  name: string;
  quantity: number;
  priceToman: number;
  weightGrams: number;
}

export interface TapinShipmentInput {
  manualId: string;
  provinceCode: number;
  cityCode: number;
  weightGrams: number;
  recipient: TapinRecipient;
  items: TapinItem[];
  payType?: number;
  orderType?: number;
  packetType?: number;
  contentType?: number;
}

export class TapinError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'TapinError';
  }
}

function assertConfigured(config: TapinConfig): void {
  if (!config.token.trim() || !config.shopId.trim()) throw new TapinError('tapin_not_configured');
}

async function callTapin(config: TapinConfig, path: string, body: Record<string, unknown>, fetchImpl: typeof fetch): Promise<any> {
  assertConfigured(config);
  const response = await fetchImpl(`${(config.baseUrl ?? 'https://api.tapin.ir/api/v2/public').replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { Authorization: config.token, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs ?? 10000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.error || result?.errors) {
    throw new TapinError('tapin_request_failed', response.status);
  }
  return result;
}

export async function quoteTapin(config: TapinConfig, input: Pick<TapinShipmentInput, 'provinceCode' | 'cityCode' | 'weightGrams'>, fetchImpl: typeof fetch = fetch) {
  return callTapin(config, '/order/post/check-price/', {
    shop_id: config.shopId,
    province: input.provinceCode,
    city: input.cityCode,
    weight: input.weightGrams,
    pay_type: 1,
    order_type: 1,
    packet_type: 2,
    content_type: 1,
  }, fetchImpl);
}

export async function registerTapin(config: TapinConfig, input: TapinShipmentInput, fetchImpl: typeof fetch = fetch) {
  if (!input.recipient.name || !input.recipient.mobile || !input.recipient.address || !/^\d{10}$/.test(input.recipient.postalCode)) {
    throw new TapinError('tapin_recipient_details_required', 422);
  }
  if (!input.weightGrams || !input.items.length) throw new TapinError('tapin_shipment_details_required', 422);
  return callTapin(config, '/order/post/register/', {
    shop_id: config.shopId,
    manual_id: input.manualId,
    province: input.provinceCode,
    city: input.cityCode,
    order_type: input.orderType ?? 1,
    register_type: 0,
    content_type: input.contentType ?? 1,
    packet_type: input.packetType ?? 2,
    weight: input.weightGrams,
    pay_type: input.payType ?? 1,
    recipient_name: input.recipient.name,
    recipient_mobile: input.recipient.mobile,
    recipient_address: input.recipient.address,
    recipient_postal_code: input.recipient.postalCode,
    products: input.items.map((item) => ({ name: item.name, count: item.quantity, price: item.priceToman, weight: item.weightGrams })),
  }, fetchImpl);
}

export async function trackTapin(config: TapinConfig, orderId: number, fetchImpl: typeof fetch = fetch) {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new TapinError('tapin_order_id_invalid', 422);
  return callTapin(config, '/order/post/get-status/report/', { orders_id: [orderId] }, fetchImpl);
}

export function mapTapinStatus(status: unknown): TapinShipmentStatus {
  const value = String(status ?? '');
  if (value === '7') return 'delivered';
  if (['13', '14', '15', '16', '17', '50'].includes(value)) return 'in_transit';
  if (['11', '80', '83', '102'].includes(value)) return 'cancelled';
  if (['3', '4', '6', '8', '9', '18', '81'].includes(value)) return 'failed';
  return 'registered';
}
