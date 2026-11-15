declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    APP_ENV?: string;
    BUCKET?: R2Bucket;
    ADMIN_SESSION_SECRET?: string;
    OTP_PEPPER?: string;
    SMS_IR_API_KEY?: string;
    SMS_IR_TEMPLATE_ID?: string;
    SMS_PROVIDER?: string;
    PAYMENT_PROVIDER?: string;
    SHIPPING_PROVIDER?: string;
    PAYMENT_API_URL?: string;
    PAYMENT_API_TOKEN?: string;
    SHIPPING_API_URL?: string;
    SHIPPING_API_TOKEN?: string;
    ZARINPAL_MERCHANT_ID?: string;
    ZARINPAL_SANDBOX?: string;
    ZARINPAL_AMOUNT_UNIT?: string;
    TAPIN_TOKEN?: string;
    TAPIN_SHOP_ID?: string;
    TAPIN_BASE_URL?: string;
  }
}

// Cloudflare/DOM response payloads are validated at application boundaries;
// keep the existing route handlers compatible with the runtime's JSON shape.
interface Response {
  json(): Promise<any>;
}

interface ExecutionContext<TProps = unknown> {
  props?: TProps;
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
