export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      MONGO_URI: string;
      NODE_ENV?: 'development' | 'production' | 'test';
      APP_BASE_URL?: string;
      JWT_SECRET: string;
      JWT_TTL_SECONDS?: string;
      ZARINPAL_MERCHANT_ID: string;
      ZARINPAL_SANDBOX?: 'true' | 'false';
      PAYMENT_CALLBACK_PATH?: string;
      GHASEDAK_API_KEY: string;
      SMS_PROVIDER?: 'mock' | 'sms_ir' | 'sms.ir' | 'smsir';
      SMS_IR_API_KEY?: string;
      SMS_IR_OTP_TEMPLATE_ID?: string;
      SMS_IR_TEMPLATE_ID?: string;
      SMS_IR_TEMPLATE_PARAMETER?: string;
      TAPIN_TOKEN?: string;
      TAPIN_SHOP_ID?: string;
      TAPIN_BASE_URL?: string;
      TAPIN_TIMEOUT_MS?: string;
    }
  }
}
