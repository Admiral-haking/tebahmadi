export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";
export type PaymentRequest = { orderId: string; amountToman: number; callbackUrl: string };
export type PaymentVerifyRequest = { orderId: string; authority: string; amountToman: number };
export type PaymentResult = { status: PaymentStatus; authority?: string; redirectUrl?: string; reference?: string };
export interface PaymentProvider { createPayment(request: PaymentRequest): Promise<PaymentResult>; verifyPayment(request: PaymentVerifyRequest): Promise<PaymentResult>; refund(orderId: string, reference: string): Promise<PaymentResult>; }
export type ShippingQuote = { service: string; amountToman: number; etaDays: number };
export type ShippingRequest = { postalCode: string; province?: string; city?: string; provinceCode?: number; cityCode?: number; weightGrams?: number; recipient?: { name: string; mobile: string; address: string; postalCode: string }; items?: Array<{ name: string; quantity: number; priceToman: number; weightGrams: number }> };
export type ShipmentResult = { status: "pending" | "created" | "in_transit" | "delivered" | "cancelled" | "failed"; trackingCode?: string };
export interface ShippingProvider { quote(request: ShippingRequest): Promise<ShippingQuote[]>; createShipment(orderId: string, request: ShippingRequest): Promise<ShipmentResult>; track(trackingCode: string): Promise<ShipmentResult>; }

export class MockPaymentProvider implements PaymentProvider {
  async createPayment(request: PaymentRequest): Promise<PaymentResult> { const authority = `mock_${request.orderId}`; return { status: "pending", authority, redirectUrl: `${request.callbackUrl}${request.callbackUrl.includes("?") ? "&" : "?"}authority=${encodeURIComponent(authority)}&Status=OK` }; }
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentResult> { return request.amountToman > 0 && request.authority === `mock_${request.orderId}` ? { status: "paid", reference: `mock-ref-${request.orderId}` } : { status: "failed" }; }
  async refund(_orderId: string, reference: string): Promise<PaymentResult> { return reference ? { status: "refunded", reference } : { status: "failed" }; }
}

export class MockShippingProvider implements ShippingProvider {
  async quote(request: ShippingRequest): Promise<ShippingQuote[]> { void request; return [{ service: "ارسال عادی", amountToman: 85000, etaDays: 3 }]; }
  async createShipment(orderId: string, request: ShippingRequest): Promise<ShipmentResult> { void request; return { status: "created", trackingCode: `MOCK-${orderId.slice(0, 8).toUpperCase()}` }; }
  async track(trackingCode: string): Promise<ShipmentResult> { return trackingCode.startsWith("MOCK-") ? { status: "created", trackingCode } : { status: "failed" }; }
}

export class TapinShippingProvider implements ShippingProvider {
  constructor(private readonly config: ReturnType<typeof getTapinConfig>) {}
  async quote(request: ShippingRequest): Promise<ShippingQuote[]> {
    const result = await quoteTapin(this.config, { provinceCode: Number(request.provinceCode), cityCode: Number(request.cityCode), weightGrams: Number(request.weightGrams) });
    const data = result.data || {};
    return [{ service: "پست پیشتاز", amountToman: Number(data.send_price ?? data.price ?? data.total_price ?? 0), etaDays: 3 }];
  }
  async createShipment(orderId: string, request: ShippingRequest): Promise<ShipmentResult> {
    if (!request.recipient || !request.items?.length) throw new Error("tapin_shipment_details_required");
    const result = await registerTapinShipment(this.config, { manualId: orderId, provinceCode: Number(request.provinceCode), cityCode: Number(request.cityCode), weightGrams: Number(request.weightGrams), recipient: request.recipient, items: request.items });
    const data = result.data;
    return { status: data.barcode ? "created" : "failed", trackingCode: data.barcode || data.order_id || data.id };
  }
  async track(trackingCode: string): Promise<ShipmentResult> {
    const item = (await trackTapinShipment(this.config, trackingCode)).list?.[0];
    const raw = String(item?.status ?? "");
    const status = raw === "7" ? "delivered" : ["13", "14", "15", "16", "17", "50"].includes(raw) ? "in_transit" : ["3", "4", "6", "8", "9", "18", "81"].includes(raw) ? "failed" : ["11", "80", "83", "102"].includes(raw) ? "cancelled" : item ? "created" : "failed";
    return { status, trackingCode: item?.barcode || trackingCode };
  }
}

export class ZarinPalPaymentProvider implements PaymentProvider {
  constructor(private readonly config: ReturnType<typeof getZarinpalConfig>) {}
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    const result = await requestZarinpalPayment(this.config, { ...request, description: `سفارش طب احمدی ${request.orderId.slice(0, 8)}` });
    return { status: "pending", authority: result.authority, redirectUrl: result.gatewayUrl };
  }
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentResult> {
    const result = await verifyZarinpalPayment(this.config, { authority: request.authority, amountToman: request.amountToman });
    return result.ok ? { status: "paid", reference: result.refId || request.authority } : { status: "failed" };
  }
  async refund(_orderId: string, reference: string): Promise<PaymentResult> {
    // ZarinPal refund availability depends on the merchant contract. Never
    // claim success until a dedicated refund endpoint is configured.
    return { status: "failed", reference: reference || undefined };
  }
}

export class HttpPaymentProvider implements PaymentProvider {
  constructor(private readonly baseUrl: string, private readonly token: string) {}
  private async call(path: string, body: unknown): Promise<any> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`payment provider returned ${response.status}`);
    return response.json();
  }
  async createPayment(request: PaymentRequest): Promise<PaymentResult> { const data = await this.call("/payments", request); return { status: "pending", authority: String(data.authority), redirectUrl: data.redirectUrl }; }
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentResult> { const data = await this.call("/payments/verify", request); return { status: data.paid ? "paid" : "failed", reference: data.reference }; }
  async refund(orderId: string, reference: string): Promise<PaymentResult> { const data = await this.call("/payments/refund", { orderId, reference }); return { status: data.refunded ? "refunded" : "failed", reference }; }
}

export class HttpShippingProvider implements ShippingProvider {
  constructor(private readonly baseUrl: string, private readonly token: string) {}
  private async call(path: string, body: unknown): Promise<any> { const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(`shipping provider returned ${response.status}`); return response.json(); }
  async quote(request: ShippingRequest): Promise<ShippingQuote[]> { const data = await this.call("/quotes", request); return Array.isArray(data.quotes) ? data.quotes : []; }
  async createShipment(orderId: string, request: ShippingRequest): Promise<ShipmentResult> { const data = await this.call("/shipments", { orderId, ...request }); return { status: data.trackingCode ? "created" : "failed", trackingCode: data.trackingCode }; }
  async track(trackingCode: string): Promise<ShipmentResult> { const data = await this.call("/tracking", { trackingCode }); return { status: data.found ? "created" : "failed", trackingCode }; }
}

export function getPaymentProvider(env: { PAYMENT_PROVIDER?: string; PAYMENT_API_URL?: string; PAYMENT_API_TOKEN?: string; ZARINPAL_MERCHANT_ID?: string; ZARINPAL_SANDBOX?: string; ZARINPAL_AMOUNT_UNIT?: string }): PaymentProvider {
  if (env.PAYMENT_PROVIDER === "mock") return new MockPaymentProvider();
  if (env.PAYMENT_PROVIDER === "http" && env.PAYMENT_API_URL && env.PAYMENT_API_TOKEN) return new HttpPaymentProvider(env.PAYMENT_API_URL, env.PAYMENT_API_TOKEN);
  if (env.PAYMENT_PROVIDER === "zarinpal") return new ZarinPalPaymentProvider(getZarinpalConfig(env));
  throw new Error("payment_provider_not_configured");
}

export function getShippingProvider(env: { SHIPPING_PROVIDER?: string; SHIPPING_API_URL?: string; SHIPPING_API_TOKEN?: string; TAPIN_TOKEN?: string; TAPIN_SHOP_ID?: string; TAPIN_BASE_URL?: string }): ShippingProvider {
  if (env.SHIPPING_PROVIDER === "mock") return new MockShippingProvider();
  if (env.SHIPPING_PROVIDER === "http" && env.SHIPPING_API_URL && env.SHIPPING_API_TOKEN) return new HttpShippingProvider(env.SHIPPING_API_URL, env.SHIPPING_API_TOKEN);
  if (env.SHIPPING_PROVIDER === "tapin") return new TapinShippingProvider(getTapinConfig(env));
  throw new Error("shipping_provider_not_configured");
}
import { getZarinpalConfig, requestZarinpalPayment, verifyZarinpalPayment } from "./zarinpal";
import { getTapinConfig, quoteTapin, registerTapinShipment, trackTapinShipment } from "./tapin";

