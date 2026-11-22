import type { PaymentGateway } from './paymentTypes';
import { getSiteConfig, updateSiteConfig } from '@/settings/services/settingsService';

export type { PaymentGateway } from './paymentTypes';

export type PaymentGatewayControl = {
  gateway: PaymentGateway;
  label: string;
  configured: boolean;
  visible: boolean;
  enabled: boolean;
};

export type PaymentGatewayControlMap = Partial<
  Record<PaymentGateway, { visible?: boolean; enabled?: boolean }>
>;

export const PAYMENT_GATEWAY_META: Array<{ gateway: PaymentGateway; label: string }> = [
  { gateway: 'zarinpal', label: 'زرین‌پال' },
  { gateway: 'torob', label: 'ترب‌پی' },
  { gateway: 'digipay', label: 'دیجی‌پی' },
  { gateway: 'azkivam', label: 'ازکی‌وام' },
  { gateway: 'snapppay', label: 'اسنپ‌پی' },
  { gateway: 'bajetpay', label: 'باجت‌پی' },
];

const PAYMENT_GATEWAY_IDS = new Set(PAYMENT_GATEWAY_META.map((item) => item.gateway));

export function isPaymentGateway(value: string): value is PaymentGateway {
  return PAYMENT_GATEWAY_IDS.has(value as PaymentGateway);
}

function hasEnv(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

export function isGatewayConfigured(gateway: PaymentGateway): boolean {
  switch (gateway) {
    case 'zarinpal':
      return hasEnv('ZARINPAL_MERCHANT_ID');
    case 'torob':
      return hasEnv(
        'TOROBPAY_CLIENT_ID',
        'TOROBPAY_CLIENT_SECRET',
        'TOROBPAY_USERNAME',
        'TOROBPAY_PASSWORD',
      );
    case 'digipay':
      return hasEnv(
        'DIGIPAY_CLIENT_ID',
        'DIGIPAY_CLIENT_SECRET',
        'DIGIPAY_USERNAME',
        'DIGIPAY_PASSWORD',
      );
    case 'azkivam':
      return Boolean(
        process.env.AZKIVAM_MERCHANT_ID?.trim() &&
          (hasEnv('AZKIVAM_USERNAME', 'AZKIVAM_PASSWORD') ||
            hasEnv('AZKIVAM_API_KEY') ||
            hasEnv('AZKIVAM_CONNECTION_KEY') ||
            hasEnv('AZKIVAM_SIGNATURE_KEY')),
      );
    case 'snapppay':
      return hasEnv(
        'SNAPPPAY_CLIENT_ID',
        'SNAPPPAY_CLIENT_SECRET',
        'SNAPPPAY_USERNAME',
        'SNAPPPAY_PASSWORD',
      );
    case 'bajetpay':
      return hasEnv('BAJETPAY_TERMINAL_ID', 'BAJETPAY_USERNAME', 'BAJETPAY_PASSWORD');
    default:
      return false;
  }
}

function normalizeControlMap(value: unknown): PaymentGatewayControlMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return PAYMENT_GATEWAY_META.reduce<PaymentGatewayControlMap>((acc, item) => {
    const control = raw[item.gateway];
    if (!control || typeof control !== 'object' || Array.isArray(control)) return acc;
    const record = control as Record<string, unknown>;
    acc[item.gateway] = {
      visible: typeof record.visible === 'boolean' ? record.visible : undefined,
      enabled: typeof record.enabled === 'boolean' ? record.enabled : undefined,
    };
    return acc;
  }, {});
}

export function buildPaymentGatewayControls(
  configured: Partial<Record<PaymentGateway, boolean>>,
  persisted: PaymentGatewayControlMap,
): PaymentGatewayControl[] {
  return PAYMENT_GATEWAY_META.map((item) => {
    const isConfigured = configured[item.gateway] === true;
    const saved = persisted[item.gateway];
    const defaultEnabled = item.gateway !== 'zarinpal' && isConfigured;
    const enabled = isConfigured && (saved?.enabled ?? defaultEnabled);
    const visible = isConfigured && (saved?.visible ?? defaultEnabled);
    return {
      ...item,
      configured: isConfigured,
      visible,
      enabled,
    };
  });
}

export function getVisiblePaymentGatewaysFromControls(
  controls: PaymentGatewayControl[],
): PaymentGateway[] {
  return controls
    .filter((control) => control.configured && control.visible && control.enabled)
    .map((control) => control.gateway);
}

export async function getPaymentGatewayControls(): Promise<PaymentGatewayControl[]> {
  const config = await getSiteConfig();
  const values = (config?.values ?? {}) as Record<string, unknown>;
  const persisted = normalizeControlMap(values.paymentGateways);
  const configured = PAYMENT_GATEWAY_META.reduce<Partial<Record<PaymentGateway, boolean>>>(
    (acc, item) => {
      acc[item.gateway] = isGatewayConfigured(item.gateway);
      return acc;
    },
    {},
  );
  return buildPaymentGatewayControls(configured, persisted);
}

export async function getVisiblePaymentGateways(): Promise<PaymentGateway[]> {
  return getVisiblePaymentGatewaysFromControls(await getPaymentGatewayControls());
}

export async function isPaymentGatewayEnabled(gateway: PaymentGateway): Promise<boolean> {
  return (await getVisiblePaymentGateways()).includes(gateway);
}

export async function updatePaymentGatewayControls(nextControls: PaymentGatewayControlMap) {
  const config = await getSiteConfig();
  const values = { ...((config?.values ?? {}) as Record<string, unknown>) };
  values.paymentGateways = normalizeControlMap(nextControls);
  return updateSiteConfig({ values });
}
