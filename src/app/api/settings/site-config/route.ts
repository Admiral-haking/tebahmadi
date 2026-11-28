import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { getSiteConfig, isConfigured, updateSiteConfig } from '@/settings/services/settingsService';
import type { SiteConfigDocument } from '@/settings/models/SiteConfig';
import { requirePermission } from '@/lib/auth';
import { ENV_REQUIREMENTS } from '@/settings/site-config/env-presets';

type EnvValidationStatus = 'ok' | 'warning' | 'error';
type EnvSummaryItem = (typeof ENV_REQUIREMENTS)[number] & {
  present: boolean;
  sourceKey: string;
  status: EnvValidationStatus;
  issues: string[];
  callbackUrl: string | null;
  value: string | null;
  maskedValue: string | null;
};

const ENV_GROUPS: Record<string, { label: string; requiredKeys: string[]; optionalKeys?: string[] }> = {
  zarinpal: {
    label: 'زرین‌پال',
    requiredKeys: ['ZARINPAL_MERCHANT_ID'],
  },
  torobpay: {
    label: 'ترب‌پی',
    requiredKeys: ['TOROBPAY_CLIENT_ID', 'TOROBPAY_CLIENT_SECRET', 'TOROBPAY_USERNAME', 'TOROBPAY_PASSWORD'],
    optionalKeys: ['TOROBPAY_BASE_URL', 'TOROBPAY_CALLBACK_PATH'],
  },
  azkivam: {
    label: 'ازکی‌وام',
    requiredKeys: ['AZKIVAM_MERCHANT_ID', 'AZKIVAM_USERNAME', 'AZKIVAM_PASSWORD', 'AZKIVAM_API_KEY'],
    optionalKeys: ['AZKIVAM_BASE_URL', 'AZKIVAM_MERCHANT_NAME'],
  },
  digipay: {
    label: 'دیجی‌پی',
    requiredKeys: ['DIGIPAY_CLIENT_ID', 'DIGIPAY_CLIENT_SECRET', 'DIGIPAY_USERNAME', 'DIGIPAY_PASSWORD'],
    optionalKeys: ['DIGIPAY_BASE_URL', 'DIGIPAY_CALLBACK_PATH', 'DIGIPAY_PREFERRED_GATEWAY'],
  },
  snapppay: {
    label: 'اسنپ‌پی',
    requiredKeys: ['SNAPPPAY_BASE_URL', 'SNAPPPAY_CLIENT_ID', 'SNAPPPAY_CLIENT_SECRET', 'SNAPPPAY_USERNAME', 'SNAPPPAY_PASSWORD'],
    optionalKeys: ['SNAPPPAY_CALLBACK_PATH', 'SNAPPPAY_PAYMENT_METHOD_TYPES', 'SNAPPPAY_VENTURE'],
  },
  bajetpay: {
    label: 'باجت‌پی',
    requiredKeys: ['BAJETPAY_TERMINAL_ID', 'BAJETPAY_USERNAME', 'BAJETPAY_PASSWORD'],
    optionalKeys: ['BAJETPAY_BASE_URL', 'BAJETPAY_CALLBACK_PATH'],
  },
};

const smsTemplateSchema = z.object({
  template: z.string().trim().min(1),
  variables: z.array(z.string().trim()).optional(),
});

const smsTemplatesSchema = z
  .object({
    loginCode: smsTemplateSchema.optional(),
    orderConfirmation: smsTemplateSchema.optional(),
    paymentReceipt: smsTemplateSchema.optional(),
    shipmentTracking: smsTemplateSchema.optional(),
    reviewRequest: smsTemplateSchema.optional(),
  })
  .partial()
  .optional();

const smartPopupStepSchema = z.object({
  title: z.string().trim().optional().default(''),
  body: z.string().trim().optional().default(''),
  imageUrl: z.string().trim().optional().default(''),
  imageMediaId: z.string().trim().optional().default(''),
  actionLabel: z.string().trim().optional().default(''),
  actionHref: z.string().trim().optional().default(''),
  aiTextPrompt: z.string().trim().optional().default(''),
  aiImagePrompt: z.string().trim().optional().default(''),
});

const smartPopupSchema = z.object({
  enabled: z.boolean().optional().default(false),
  version: z.string().trim().optional().default('1'),
  showOnce: z.boolean().optional().default(true),
  delayMs: z.coerce.number().nonnegative().optional().default(1200),
  pages: z.array(z.string().trim()).optional().default([]),
  steps: z.array(smartPopupStepSchema).optional().default([]),
}).optional();

const updateSchema = z.object({
  isOnboardingComplete: z.boolean().optional(),
  requiredKeys: z.array(z.string()).optional(),
  values: z.record(z.string(), z.unknown()).optional(),
  smsTemplates: smsTemplatesSchema,
  smartPopup: smartPopupSchema,
});

function maskSecretValue(value: string | undefined, secret?: boolean): string | null {
  if (!value) {
    return null;
  }
  if (!secret) {
    return value;
  }
  if (value.length <= 6) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function readEnvValue(key: string) {
  const rawValue = process.env[key];
  return typeof rawValue === 'string' ? rawValue.trim() : '';
}

function readRequirementValue(requirement: (typeof ENV_REQUIREMENTS)[number]) {
  const primary = readEnvValue(requirement.key);
  if (primary) {
    return { value: primary, sourceKey: requirement.key };
  }

  for (const alias of requirement.aliases ?? []) {
    const aliasValue = readEnvValue(alias);
    if (aliasValue) {
      return { value: aliasValue, sourceKey: alias };
    }
  }

  return { value: '', sourceKey: requirement.key };
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasDuplicateEnvValues(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  let count = 0;
  for (const requirement of ENV_REQUIREMENTS) {
    const keys = [requirement.key, ...(requirement.aliases ?? [])];
    for (const key of keys) {
      if (readEnvValue(key).toLowerCase() === normalized) {
        count += 1;
      }
    }
  }

  return count > 1;
}

function buildCallbackUrl(baseUrl: string | undefined, path: string) {
  if (!baseUrl || !isHttpUrl(baseUrl) || !path.startsWith('/')) {
    return null;
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return new URL(path, `${normalizedBase}/`).toString();
}

function validateEnvValue(requirement: (typeof ENV_REQUIREMENTS)[number], rawValue: string | undefined) {
  const value = rawValue?.trim() ?? '';
  const present = value.length > 0;
  const issues: string[] = [];
  let status: EnvValidationStatus = 'ok';

  const pushIssue = (message: string, severity: 'warning' | 'error') => {
    issues.push(message);
    if (severity === 'error' || status !== 'error') {
      status = severity;
    }
  };

  if (!present) {
    if (!requirement.optional) {
      pushIssue('این متغیر ضروری است و هنوز تنظیم نشده.', 'error');
    }
    return { status, issues, normalizedValue: value || null };
  }

  if (requirement.secret && requirement.minLength && value.length < requirement.minLength) {
    pushIssue(`طول مقدار سری بهتر است حداقل ${requirement.minLength} کاراکتر باشد.`, requirement.optional ? 'warning' : 'error');
  }

  if (requirement.secret && present && /^(changeme|change-me|secret|password|test|123456)$/i.test(value)) {
    pushIssue('این مقدار شبیه secret پیش‌فرض یا ناامن است.', 'error');
  }

  if (requirement.secret && present && value.length >= 8 && hasDuplicateEnvValues(value)) {
    pushIssue('این secret با یک متغیر دیگر یکسان است؛ برای هر سرویس کلید جداگانه امن‌تر است.', 'warning');
  }

  if (requirement.format === 'url' && !isHttpUrl(value)) {
    pushIssue('باید یک URL معتبر با http یا https باشد.', 'error');
  }

  if (requirement.format === 'path' && (!value.startsWith('/') || value.startsWith('//'))) {
    pushIssue('باید مسیر نسبی معتبر و شروع‌شونده با / باشد، نه URL کامل.', 'error');
  }

  if (requirement.format === 'boolean' && !['true', 'false'].includes(value.toLowerCase())) {
    pushIssue('فقط مقدار true یا false معتبر است.', 'error');
  }

  if (requirement.format === 'number' && !Number.isFinite(Number(value))) {
    pushIssue('باید مقدار عددی معتبر باشد.', 'error');
  }

  if (requirement.key === 'JWT_TTL_SECONDS' && Number.isFinite(Number(value))) {
    const ttl = Number(value);
    if (ttl < 300) pushIssue('TTL کمتر از ۵ دقیقه است و ممکن است ورود کاربران را ناپایدار کند.', 'warning');
    if (ttl > 60 * 60 * 24 * 30) pushIssue('TTL بیشتر از ۳۰ روز است و از نظر امنیتی بهتر است کوتاه‌تر شود.', 'warning');
  }

  if (requirement.format === 'csv') {
    const values = value.split(',').map((item) => item.trim()).filter(Boolean);
    if (values.length === 0) {
      pushIssue('لیست نباید بعد از جدا کردن با کاما خالی باشد.', 'error');
    }
    if (requirement.key === 'SNAPPPAY_PAYMENT_METHOD_TYPES') {
      const allowed = new Set(['INSTALLMENT', 'FINANCING', 'DIRECT_DEBIT', 'BNPL']);
      const unknown = values.filter((item) => !allowed.has(item.toUpperCase()));
      if (unknown.length) {
        pushIssue(`روش‌های ناشناخته برای اسنپ‌پی: ${unknown.join(', ')}`, 'warning');
      }
    }
  }

  if (requirement.recommended && value !== requirement.recommended) {
    pushIssue(`مقدار پیشنهادی: ${requirement.recommended}`, 'warning');
  }

  if (requirement.key === 'APP_BASE_URL' && process.env.NODE_ENV === 'production' && value.startsWith('http://')) {
    pushIssue('در production بهتر است APP_BASE_URL با https تنظیم شود.', 'warning');
  }

  if (requirement.key === 'AZKIVAM_API_KEY' && !/^[a-f0-9]{32}$|^[a-f0-9]{48}$|^[a-f0-9]{64}$/i.test(value)) {
    pushIssue('AZKIVAM_API_KEY باید hex با طول 16، 24 یا 32 بایت باشد.', 'error');
  }

  if (requirement.key === 'DIGIPAY_PREFERRED_GATEWAY' && Number.isFinite(Number(value)) && ![0, 2].includes(Number(value))) {
    pushIssue('طبق تنظیمات فعلی معمولاً مقدار 2 برای IPG یا 0 برای Wallet استفاده می‌شود.', 'warning');
  }

  return { status, issues, normalizedValue: value || null };
}

function buildGroupIssues() {
  return Object.entries(ENV_GROUPS).flatMap(([groupKey, group]) => {
    const keys = [...group.requiredKeys, ...(group.optionalKeys ?? [])];
    const presentKeys = keys.filter((key) => readEnvValue(key));
    const missingRequiredKeys = group.requiredKeys.filter((key) => !readEnvValue(key));

    if (presentKeys.length === 0 || missingRequiredKeys.length === 0) {
      return [];
    }

    return [
      {
        group: groupKey,
        label: group.label,
        status: 'error' as const,
        message: `${group.label} نیمه‌کاره تنظیم شده است. کلیدهای ضروری ناقص: ${missingRequiredKeys.join(', ')}`,
        missingKeys: missingRequiredKeys,
      },
    ];
  });
}

function buildEnvSummary(): EnvSummaryItem[] {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  return ENV_REQUIREMENTS.map((requirement) => {
    const resolved = readRequirementValue(requirement);
    const rawValue = resolved.value || undefined;
    const present = resolved.value.length > 0;
    const validation = validateEnvValue(requirement, rawValue);
    return {
      ...requirement,
      present,
      sourceKey: resolved.sourceKey,
      status: validation.status,
      issues: validation.issues,
      callbackUrl: requirement.callback && validation.normalizedValue ? buildCallbackUrl(appBaseUrl, validation.normalizedValue) : null,
      value: requirement.secret ? null : rawValue ?? null,
      maskedValue: maskSecretValue(rawValue, requirement.secret),
    };
  });
}

function buildEnvHealth(env: ReturnType<typeof buildEnvSummary>) {
  const total = env.length;
  const errors = env.filter((item) => item.status === 'error').length;
  const warnings = env.filter((item) => item.status === 'warning').length;
  const missingRequired = env.filter((item) => !item.optional && !item.present).length;
  const healthy = env.filter((item) => item.present && item.status === 'ok').length;
  const groupIssues = buildGroupIssues();

  return {
    total,
    healthy,
    warnings,
    errors,
    missingRequired,
    groupIssues,
    score: Math.max(0, Math.min(100, Math.round(((total - errors - warnings * 0.35) / Math.max(total, 1)) * 100))),
  };
}

export async function GET() {
  const env = buildEnvSummary();
  try {
    await connectMongoose();
    const [config, status] = await Promise.all([getSiteConfig(), isConfigured()]);
    return NextResponse.json({ data: config, status, env, envHealth: buildEnvHealth(env) });
  } catch (error) {
    console.warn('Site config status is temporarily unavailable', error);
    return NextResponse.json({
      data: null,
      status: { ok: false, missingKeys: [] },
      env,
      envHealth: buildEnvHealth(env),
    });
  }
}

export async function PATCH(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'users:write');
  try {
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    const config = await updateSiteConfig(parsed as Partial<SiteConfigDocument>);
    const status = await isConfigured();
    return NextResponse.json({ data: config, status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error('Failed to update site config', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
