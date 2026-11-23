'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AvatarVariantIds } from '@/types';
import type { SitePages } from '@/settings/site-pages';

export type SmsTemplateKind =
  | 'loginCode'
  | 'orderConfirmation'
  | 'paymentReceipt'
  | 'shipmentTracking'
  | 'reviewRequest';

export interface SmsTemplateConfigEntry {
  template?: string | null;
  variables?: string[] | null;
}

export type SmsTemplateSettingsMap = Partial<Record<SmsTemplateKind, SmsTemplateConfigEntry | null>>;

export interface SiteInfoDTO {
  _id?: string;
  appName: string;
  description?: string;
  addresses?: { label?: string; address: string }[];
  bio?: string;
  phones?: { label?: string; number: string }[];
  socials?: { platform: string; url: string }[];
  contentPages?: SitePages;
  support?: {
    title?: string;
    description?: string;
    hours?: string;
    responseTime?: string;
    ticketEnabled?: boolean;
  };
  customData?: Record<string, unknown>;
  logo?: AvatarVariantIds | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteConfigDTO {
  _id?: string;
  isOnboardingComplete: boolean;
  requiredKeys?: string[];
  values?: Record<string, unknown>;
  smsTemplates?: SmsTemplateSettingsMap | null;
  smartPopup?: SmartPopupConfig | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SmartPopupStep {
  title?: string;
  body?: string;
  imageUrl?: string;
  imageMediaId?: string;
  actionLabel?: string;
  actionHref?: string;
  aiTextPrompt?: string;
  aiImagePrompt?: string;
}

export interface SmartPopupConfig {
  enabled?: boolean;
  version?: string;
  showOnce?: boolean;
  delayMs?: number;
  pages?: string[];
  steps?: SmartPopupStep[];
}

export interface EnvVariableSummary {
  key: string;
  label: string;
  description: string;
  category: string;
  secret?: boolean;
  optional?: boolean;
  docUrl?: string;
  example?: string;
  format?: string;
  recommended?: string;
  callback?: boolean;
  group?: string;
  aliases?: string[];
  present: boolean;
  sourceKey?: string;
  status?: 'ok' | 'warning' | 'error';
  issues?: string[];
  callbackUrl?: string | null;
  value?: string | null;
  maskedValue?: string | null;
}

export interface EnvHealthSummary {
  total: number;
  healthy: number;
  warnings: number;
  errors: number;
  missingRequired: number;
  score: number;
  groupIssues?: {
    group: string;
    label: string;
    status: 'error' | 'warning';
    message: string;
    missingKeys?: string[];
  }[];
}

function parseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'خطا در برقراری ارتباط با سرور';
}

interface UseSiteInfoOptions {
  skip?: boolean;
}

export function useSiteInfo(options: UseSiteInfoOptions = {}) {
  const { skip = false } = options;
  const [data, setData] = useState<SiteInfoDTO | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (skip) {
        return;
      }
      try {
        setLoading(true);
        const response = await fetch('/api/settings/site-info', {
          credentials: 'include',
          signal,
        });

        if (!response.ok) {
          const message = (await response.text().catch(() => '')) || response.statusText;
          throw new Error(message || 'Failed to load site info');
        }

        const json = (await response.json()) as { data?: SiteInfoDTO | null };
        if (signal?.aborted) {
          return;
        }
        setData(json.data ?? null);
        setError(null);
      } catch (err) {
        if (signal?.aborted || skip) {
          return;
        }
        setError(parseError(err));
      } finally {
        if (!signal?.aborted && !skip) {
          setLoading(false);
        }
      }
    },
    [skip],
  );

  useEffect(() => {
    if (skip) {
      return;
    }
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData, skip]);

  const refresh = useCallback(async () => {
    if (skip) {
      return;
    }
    await fetchData();
  }, [fetchData, skip]);

  return { data, loading, error, refresh };
}

export function useSiteConfig() {
  const [data, setData] = useState<SiteConfigDTO | null>(null);
  const [status, setStatus] = useState<boolean | null>(null);
  const [envSummary, setEnvSummary] = useState<EnvVariableSummary[]>([]);
  const [envHealth, setEnvHealth] = useState<EnvHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/site-config', {
        credentials: 'include',
        signal,
      });

      if (!response.ok) {
        const message = (await response.text().catch(() => '')) || response.statusText;
        throw new Error(message || 'Failed to load site configuration');
      }

      const json = (await response.json()) as {
        data?: SiteConfigDTO | null;
        status?: boolean;
        env?: EnvVariableSummary[];
        envHealth?: EnvHealthSummary;
      };
      if (signal?.aborted) {
        return;
      }
      setData(json.data ?? null);
      setStatus(typeof json.status === 'boolean' ? json.status : null);
      setEnvSummary(Array.isArray(json.env) ? json.env : []);
      setEnvHealth(json.envHealth ?? null);
      setError(null);
    } catch (err) {
      if (signal?.aborted) {
        return;
      }
      setError(parseError(err));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { data, status, envSummary, envHealth, loading, error, refresh };
}
