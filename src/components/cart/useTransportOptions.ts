'use client';

import useSWR from 'swr';
import { fetchTransportOptions, type TransportOption } from './transport-options';

export type { TransportOption } from './transport-options';

export function useTransportOptions() {
  const { data, error, isLoading, mutate } = useSWR('/api/transport?isActive=true', fetchTransportOptions, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000,
    errorRetryCount: 3,
    errorRetryInterval: 1_500,
    keepPreviousData: true,
  });

  return {
    options: data?.data ?? [],
    isLoading,
    error: error instanceof Error ? error : null,
    retry: () => void mutate(),
  };
}
