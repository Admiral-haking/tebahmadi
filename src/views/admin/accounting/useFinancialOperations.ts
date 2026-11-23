import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseCsv } from '@/utils/csv';
import { accountTypeLabels, settlementStatusLabels, today } from './financial-operations-utils';
import { fetchFinancialOperations, postFinancialOperation } from './financial-operations-api';
import type { FinancialData } from './financial-operations-types';
import type { FinancialTab } from './components/FinancialTabs';

export function useFinancialOperations({ from, to }: { from?: string; to?: string } = {}) {
  const [tab, setTab] = useState<FinancialTab>('statements');
  const [data, setData] = useState<FinancialData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ date: today(), settledAt: today() });
  const [settlementLines, setSettlementLines] = useState<Record<string, unknown>[]>([]);
  const [digikalaSettlement, setDigikalaSettlement] = useState<Record<string, unknown> | null>(
    null,
  );

  const load = useCallback(async () => {
    setData(await fetchFinancialOperations(from, to));
  }, [from, to]);

  useEffect(() => {
    void load().catch((reason) =>
      setError(reason instanceof Error ? reason.message : 'load_failed'),
    );
  }, [load]);

  const submit = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      await postFinancialOperation(payload);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'operation_failed');
    } finally {
      setBusy(false);
    }
  };

  const readSettlementCsv = async (file?: File) => {
    if (!file) return;
    const [header, ...rows] = parseCsv(await file.text());
    if (!header) throw new Error('empty_settlement_csv');
    setSettlementLines(
      rows.map((values) => {
        const record = Object.fromEntries(header.map((key, index) => [key, values[index]]));
        return {
          invoiceId: record.invoiceId,
          orderId: record.orderId,
          grossAmount: Number(record.grossAmount ?? 0),
          feeAmount: Number(record.feeAmount ?? 0),
          taxAmount: Number(record.taxAmount ?? 0),
          otherDeduction: Number(record.otherDeduction ?? 0),
          netAmount: Number(record.netAmount ?? 0),
        };
      }),
    );
  };

  const readDigikalaSettlementJson = async (file?: File) => {
    if (!file) return;
    setDigikalaSettlement(JSON.parse(await file.text()));
  };

  const statementSlices = useMemo(
    () =>
      Object.entries(data?.accountTypeSummary ?? {})
        .filter(([, value]) => Math.abs(value) > 0)
        .map(([key, value], index) => ({
          key,
          label: accountTypeLabels[key] ?? key,
          value: Math.abs(value),
          color: ['#1f7a5b', '#b45309', '#2563eb', '#9333ea', '#dc2626', '#64748b'][index % 6],
        })),
    [data],
  );

  const settlementSlices = useMemo(
    () =>
      ['imported', 'reconciled', 'posted', 'unknown']
        .map((key, index) => ({
          key,
          label: settlementStatusLabels[key],
          value: data?.settlementSummary?.[key] ?? 0,
          color: ['#d97706', '#2563eb', '#16a34a', '#64748b'][index],
        }))
        .filter((slice) => slice.value > 0),
    [data],
  );

  return {
    tab,
    setTab,
    data,
    error,
    busy,
    form,
    setForm,
    settlementLines,
    digikalaSettlement,
    submit,
    readSettlementCsv,
    readDigikalaSettlementJson,
    statementSlices,
    settlementSlices,
  };
}
