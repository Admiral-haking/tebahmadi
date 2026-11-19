'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Form, RHFSwitch } from '@/components/hook-form';
import type { SiteConfigDTO, SmsTemplateSettingsMap, SmsTemplateKind, EnvHealthSummary, EnvVariableSummary } from '../hooks';
import SmsTemplatesField from './components/sms-templates-field';
import SmartPopupField from './components/smart-popup-field';
import { SMS_TEMPLATE_KINDS } from './sms-template-presets';
import EnvironmentVariablesCard from './components/environment-card';
import EssentialConfigFieldset from './components/essential-config-fieldset';
import {
  configFieldsSchema,
  CONFIG_FIELD_DEFAULTS,
  type ConfigFieldValues,
  REQUIRED_CONFIG_FIELD_KEYS,
} from './config-field-presets';
import { useAuth } from '@/auth/auth-context';
import { userHasPermission } from '@/auth/permissions';
import useLocalStorage from '@/hooks/use-localStorage';

const smsTemplateVariableSchema = z.object({
  value: z.string().trim(),
});

const smsTemplateEntrySchema = z.object({
  template: z.string().trim().optional(),
  variables: z.array(smsTemplateVariableSchema),
});

const smsTemplatesSchema = z.object(
  Object.fromEntries(
    SMS_TEMPLATE_KINDS.map((kind) => [kind, smsTemplateEntrySchema]),
  ) as Record<SmsTemplateKind, typeof smsTemplateEntrySchema>
);

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
  enabled: z.boolean(),
  version: z.string().trim().default('1'),
  showOnce: z.boolean(),
  delayMs: z.coerce.number().nonnegative(),
  pagesText: z.string().optional().default(''),
  steps: z.array(smartPopupStepSchema).min(1),
});

const formSchema = z.object({
  isOnboardingComplete: z.boolean(),
  configFields: configFieldsSchema,
  smsTemplates: smsTemplatesSchema,
  smartPopup: smartPopupSchema,
});

export type SiteConfigFormValues = z.infer<typeof formSchema>;

export type SmsTemplateVariableFormValue = z.infer<typeof smsTemplateVariableSchema>;
export type SmsTemplateEntryFormValue = z.infer<typeof smsTemplateEntrySchema>;
export type SmsTemplatesFormValue = Record<SmsTemplateKind, SmsTemplateEntryFormValue>;
export type SmartPopupStepFormValue = z.infer<typeof smartPopupStepSchema>;
export type SmartPopupFormValue = z.infer<typeof smartPopupSchema>;

function createEmptySmsTemplates(): SmsTemplatesFormValue {
  return SMS_TEMPLATE_KINDS.reduce((acc, kind) => {
    acc[kind] = { template: '', variables: [] };
    return acc;
  }, {} as SmsTemplatesFormValue);
}

function createEmptyConfigFields(): ConfigFieldValues {
  return { ...CONFIG_FIELD_DEFAULTS };
}

function createEmptySmartPopupStep(): SmartPopupStepFormValue {
  return {
    title: '',
    body: '',
    imageUrl: '',
    imageMediaId: '',
    actionLabel: '',
    actionHref: '',
    aiTextPrompt: '',
    aiImagePrompt: '',
  };
}

function createEmptySmartPopup(): SmartPopupFormValue {
  return {
    enabled: false,
    version: '1',
    showOnce: true,
    delayMs: 1200,
    pagesText: '',
    steps: [createEmptySmartPopupStep()],
  };
}

const EMPTY_VALUES: SiteConfigFormValues = {
  isOnboardingComplete: false,
  configFields: createEmptyConfigFields(),
  smsTemplates: createEmptySmsTemplates(),
  smartPopup: createEmptySmartPopup(),
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toSmartPopupFormValues(data: SiteConfigDTO | null): SmartPopupFormValue {
  const popup = data?.smartPopup;
  const steps = (popup?.steps ?? [])
    .map((step) => ({
      title: cleanText(step.title),
      body: cleanText(step.body),
      imageUrl: cleanText(step.imageUrl),
      imageMediaId: cleanText(step.imageMediaId),
      actionLabel: cleanText(step.actionLabel),
      actionHref: cleanText(step.actionHref),
      aiTextPrompt: cleanText(step.aiTextPrompt),
      aiImagePrompt: cleanText(step.aiImagePrompt),
    }))
    .filter((step) => Object.values(step).some((value) => value.length > 0));

  return {
    enabled: Boolean(popup?.enabled),
    version: cleanText(popup?.version) || '1',
    showOnce: popup?.showOnce !== false,
    delayMs: Number.isFinite(Number(popup?.delayMs)) ? Number(popup?.delayMs) : 1200,
    pagesText: (popup?.pages ?? []).map((page) => cleanText(page)).filter(Boolean).join(', '),
    steps: steps.length ? steps : [createEmptySmartPopupStep()],
  };
}

function toFormValues(data: SiteConfigDTO | null): SiteConfigFormValues {
  if (!data) {
    return {
      ...EMPTY_VALUES,
      smsTemplates: createEmptySmsTemplates(),
      configFields: createEmptyConfigFields(),
      smartPopup: createEmptySmartPopup(),
    };
  }

  const configFields: any = createEmptyConfigFields();
  (Object.keys(configFields) as Array<keyof ConfigFieldValues>).forEach((key) => {
    const current = configFields[key];
    const rawValue = data.values?.[key];
    if (typeof current === 'boolean') {
      configFields[key] = (typeof rawValue === 'boolean' ? rawValue : rawValue === 'true')
      return;
    }

    if (typeof rawValue === 'string') {
      configFields[key] = rawValue
    } else if (typeof rawValue === 'number') {
      configFields[key] = String(rawValue)
    } else if (typeof rawValue === 'boolean') {
      configFields[key] = (rawValue ? 'true' : '')
    }
  });

  const smsTemplates = createEmptySmsTemplates();
  SMS_TEMPLATE_KINDS.forEach((kind) => {
    const entry = data.smsTemplates?.[kind];
    if (!entry) {
      return;
    }
    smsTemplates[kind] = {
      template: entry.template ?? '',
      variables: (entry.variables ?? [])
        .filter((item): item is string => typeof item === 'string')
        .map((value) => ({ value })),
    };
  });

  return {
    isOnboardingComplete: Boolean(data.isOnboardingComplete),
    configFields,
    smsTemplates,
    smartPopup: toSmartPopupFormValues(data),
  };
}

function buildPayload(values: SiteConfigFormValues) {
  const payload: Record<string, unknown> = {
    isOnboardingComplete: values.isOnboardingComplete,
  };

  payload.requiredKeys = REQUIRED_CONFIG_FIELD_KEYS;

  const configValues: Record<string, unknown> = { ...values.configFields };
  const threshold = Number(values.configFields.lowStockThreshold);
  if (!Number.isNaN(threshold)) {
    configValues.lowStockThreshold = threshold;
  }
  payload.values = configValues;

  const smsTemplates: SmsTemplateSettingsMap = {};
  SMS_TEMPLATE_KINDS.forEach((kind) => {
    const entry = values.smsTemplates?.[kind];
    const templateName = entry?.template?.trim();
    if (!templateName) {
      return;
    }
    const variables = (entry?.variables ?? [])
      .map((item) => item.value?.trim())
      .filter((item): item is string => Boolean(item && item.length > 0));

    smsTemplates[kind] = {
      template: templateName,
      variables,
    };
  });

  payload.smsTemplates = smsTemplates;
  payload.smartPopup = {
    enabled: Boolean(values.smartPopup.enabled),
    version: cleanText(values.smartPopup.version) || '1',
    showOnce: values.smartPopup.showOnce !== false,
    delayMs: Math.max(0, Number(values.smartPopup.delayMs) || 0),
    pages: (values.smartPopup.pagesText ?? '')
      .split(/[\n,،]+/)
      .map((page) => cleanText(page))
      .filter(Boolean),
    steps: (values.smartPopup.steps ?? [])
      .map((step) => ({
        title: cleanText(step.title),
        body: cleanText(step.body),
        imageUrl: cleanText(step.imageUrl),
        imageMediaId: cleanText(step.imageMediaId),
        actionLabel: cleanText(step.actionLabel),
        actionHref: cleanText(step.actionHref),
        aiTextPrompt: cleanText(step.aiTextPrompt),
        aiImagePrompt: cleanText(step.aiImagePrompt),
      }))
      .filter((step) => Object.values(step).some((value) => value.length > 0)),
  };

  return payload;
}

interface SiteConfigFormProps {
  data: SiteConfigDTO | null;
  envSummary: EnvVariableSummary[];
  envHealth?: EnvHealthSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void> | void;
}

export default function SiteConfigForm({ data, envSummary, envHealth, loading, error, refresh }: SiteConfigFormProps) {
  const methods = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_VALUES,
    mode: 'onBlur',
  });
  const { user } = useAuth();
  const canEdit = userHasPermission(user, 'users:write');
  const [saving, setSaving] = useState(false);
  const hasDataLoadedRef = useRef(false);

  const [llmURL, setLlmURL] = useLocalStorage("llm", "")
  const [gtpURL, setGptURL] = useLocalStorage("gpt", "")

  const initialValues = useMemo(() => toFormValues(data), [data]);
  const envLookup = useMemo(
    () =>
      envSummary.reduce<Record<string, EnvVariableSummary>>((acc, item) => {
        acc[item.key] = item;
        return acc;
      }, {}),
    [envSummary],
  );

  useEffect(() => {
    if (!loading) {
      methods.reset(initialValues);
      hasDataLoadedRef.current = true;
    }
  }, [initialValues, loading, methods]);

  const handleSubmit = methods.handleSubmit(async (values) => {
    if (!canEdit) {
      toast.warning('شما مجوز ویرایش این بخش را ندارید.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/settings/site-config', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(values)),
      });

      if (!response.ok) {
        const message = (await response.text().catch(() => '')) || response.statusText;
        throw new Error(message || 'خطا در ذخیره پیکربندی');
      }

      toast.success('پیکربندی با موفقیت به‌روزرسانی شد.');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ذخیره تنظیمات ناموفق بود');
    } finally {
      setSaving(false);
    }
  });

  const handleReset = () => {
    methods.reset(initialValues);
  };

  if (loading && !hasDataLoadedRef.current) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" minHeight={200}>
            <CircularProgress size={28} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardHeader title="پیکربندی کلان" subheader="کلیدهای ضروری و مقادیر پایه را مشخص کنید." />
      <Divider />
      <CardContent>
        <Stack spacing={3}>
          {error ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => refresh()}>
                  تلاش مجدد
                </Button>
              }
            >
              {error}
            </Alert>
          ) : null}

          {!canEdit ? (
            <Alert severity="info">
              شما تنها مجاز به مشاهده تنظیمات هستید. برای ویرایش با مدیر سیستم هماهنگ شوید.
            </Alert>
          ) : null}

          {envSummary.length ? <EnvironmentVariablesCard envSummary={envSummary} envHealth={envHealth} /> : null}

          <Form methods={methods as any} onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <RHFSwitch
                name="isOnboardingComplete"
                label="فرآیند راه‌اندازی کامل شده است"
                slotProps={{ wrapper: { display: 'flex', alignItems: 'center' } }}
                disabled={saving || !canEdit}
              />

              <TextField
                label="ادرس نقطه اتصال به دیپ سیک"
                onChange={e => setLlmURL(e.target.value)}
                value={llmURL}
              />

              <TextField
                label="ادرس نقطه اتصال به جی پی تی تصویر"
                onChange={e => setGptURL(e.target.value)}
                value={gtpURL}
              />

              <EssentialConfigFieldset disabled={saving || !canEdit} envLookup={envLookup} />
              <SmsTemplatesField disabled={saving || !canEdit} />
              <SmartPopupField disabled={saving || !canEdit} />

              <CardActions sx={{ px: 0 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving || !canEdit}
                  startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
                >
                  ذخیره تغییرات
                </Button>
                <Button variant="text" onClick={handleReset} disabled={saving}>
                  بازنشانی
                </Button>
              </CardActions>
            </Stack>
          </Form>
        </Stack>
      </CardContent>
    </Card>
  );
}
