import type { TapinContentType, TapinOrderType, TapinPayType } from './types';

export type TapinAutomationConfigValues = {
  tapinAutoRegisterEnabled?: unknown;
  tapinAutoRegisterShopId?: unknown;
  tapinAutoRegisterBoxId?: unknown;
  tapinAutoRegisterPackageWeightGrams?: unknown;
  tapinAutoRegisterOrderType?: unknown;
  tapinAutoRegisterPacketType?: unknown;
  tapinAutoRegisterContentType?: unknown;
  tapinAutoRegisterPayType?: unknown;
  tapinAutoRegisterHasInsurance?: unknown;
  tapinAutoRegisterMaxAttempts?: unknown;
  tapinAutoRegisterRetryDelaySeconds?: unknown;
};

export type TapinAutomationSettings =
  | { enabled: false }
  | {
      enabled: true;
      shopId: string;
      boxId: number;
      packageWeightGrams: number;
      orderType: TapinOrderType;
      packetType: 1 | 2 | 3;
      contentType: TapinContentType;
      payType: TapinPayType;
      hasInsurance: boolean;
      maxAttempts: number;
      retryDelaySeconds: number;
    };

export type TapinAutomationConfigIssue = {
  key: string;
  message: string;
};

export class TapinAutomationConfigError extends Error {
  constructor(public readonly issues: TapinAutomationConfigIssue[]) {
    super('تنظیمات ثبت خودکار تاپین کامل نیست.');
    this.name = 'TapinAutomationConfigError';
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredInteger(
  values: TapinAutomationConfigValues,
  key: keyof TapinAutomationConfigValues,
  label: string,
  issues: TapinAutomationConfigIssue[],
  options: { min?: number; max?: number } = {},
): number | undefined {
  const raw = text(values[key]);
  if (!raw || !/^\d+$/.test(raw)) {
    issues.push({ key: String(key), message: `${label} باید به‌صورت عدد صحیح وارد شود.` });
    return undefined;
  }

  const number = Number(raw);
  const min = options.min ?? 0;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    issues.push({ key: String(key), message: `${label} باید بین ${min} و ${max} باشد.` });
    return undefined;
  }
  return number;
}

function requiredChoice<T extends number>(
  values: TapinAutomationConfigValues,
  key: keyof TapinAutomationConfigValues,
  label: string,
  choices: readonly T[],
  issues: TapinAutomationConfigIssue[],
): T | undefined {
  const value = requiredInteger(values, key, label, issues);
  if (value === undefined) return undefined;
  if (!choices.includes(value as T)) {
    issues.push({ key: String(key), message: `${label} انتخاب معتبری ندارد.` });
    return undefined;
  }
  return value as T;
}

function requiredBoolean(
  values: TapinAutomationConfigValues,
  key: keyof TapinAutomationConfigValues,
  label: string,
  issues: TapinAutomationConfigIssue[],
): boolean | undefined {
  const value = values[key];
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  issues.push({ key: String(key), message: `${label} باید مشخص شود.` });
  return undefined;
}

export function parseTapinAutomationSettings(
  values: TapinAutomationConfigValues | null | undefined,
): TapinAutomationSettings {
  const input = values ?? {};
  const enabled = input.tapinAutoRegisterEnabled === true || input.tapinAutoRegisterEnabled === 'true';
  if (!enabled) return { enabled: false };

  const issues: TapinAutomationConfigIssue[] = [];
  const shopId = text(input.tapinAutoRegisterShopId);
  if (!shopId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shopId)) {
    issues.push({ key: 'tapinAutoRegisterShopId', message: 'شناسه فروشگاه تاپین باید UUID معتبر باشد.' });
  }

  const boxId = requiredInteger(input, 'tapinAutoRegisterBoxId', 'شناسه جعبه تاپین', issues, { min: 1 });
  const packageWeightGrams = requiredInteger(
    input,
    'tapinAutoRegisterPackageWeightGrams',
    'وزن بسته‌بندی',
    issues,
    { min: 0, max: 30_000 },
  );
  const orderType = requiredChoice(input, 'tapinAutoRegisterOrderType', 'نوع سفارش', [0, 1, 3, 5] as const, issues);
  const packetType = requiredChoice(input, 'tapinAutoRegisterPacketType', 'نوع بسته', [1, 2, 3] as const, issues);
  const contentType = requiredChoice(input, 'tapinAutoRegisterContentType', 'نوع محتوا', [1, 2, 3, 4] as const, issues);
  const payType = requiredChoice(input, 'tapinAutoRegisterPayType', 'نوع پرداخت', [0, 1, 2, 3] as const, issues);
  const hasInsurance = requiredBoolean(input, 'tapinAutoRegisterHasInsurance', 'وضعیت بیمه', issues);
  const maxAttempts = requiredInteger(input, 'tapinAutoRegisterMaxAttempts', 'تعداد تلاش مجاز', issues, {
    min: 1,
    max: 5,
  });
  const retryDelaySeconds = requiredInteger(
    input,
    'tapinAutoRegisterRetryDelaySeconds',
    'فاصله تلاش مجدد',
    issues,
    { min: 1, max: 86_400 },
  );

  if (issues.length > 0 || !boxId || packageWeightGrams === undefined || orderType === undefined || packetType === undefined || contentType === undefined || payType === undefined || hasInsurance === undefined || maxAttempts === undefined || retryDelaySeconds === undefined || !shopId) {
    throw new TapinAutomationConfigError(issues);
  }

  return {
    enabled: true,
    shopId,
    boxId,
    packageWeightGrams,
    orderType,
    packetType,
    contentType,
    payType,
    hasInsurance,
    maxAttempts,
    retryDelaySeconds,
  };
}

export function mergeAndParseTapinAutomationSettings(
  current: TapinAutomationConfigValues | null | undefined,
  incoming: TapinAutomationConfigValues | null | undefined,
): TapinAutomationSettings {
  return parseTapinAutomationSettings({ ...(current ?? {}), ...(incoming ?? {}) });
}
