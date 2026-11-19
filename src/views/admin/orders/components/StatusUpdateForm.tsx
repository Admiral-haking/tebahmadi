'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';

import { changeInvoiceStatusAction } from '@/app/admin/orders/[id]/actions';
import { INVOICE_STATUSES, STATUS_LABELS, type InvoiceStatus } from '../constants';

interface StatusUpdateFormProps {
  invoiceId: string;
  status: InvoiceStatus;
  disabled?: boolean;
  onStatusChange?: (status: InvoiceStatus) => void;
}

export default function StatusUpdateForm({ invoiceId, status, disabled = false, onStatusChange }: StatusUpdateFormProps) {
  const [currentStatus, setCurrentStatus] = useState<InvoiceStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateStatus = changeInvoiceStatusAction.bind(null, invoiceId);

  const handleSubmit = (nextStatus: InvoiceStatus) => {
    if (nextStatus === currentStatus) return;
    const confirm = window.confirm("ایا از طریق وضعیت سفارش فعلی اطمینان دارید؟");

    if (!confirm) return;

    const confirm2 = window.confirm("در نظر داشته باشید بعد از تغییر وضعیت، دیگر قابل به بازگشت به وضعیت دیگر نخواید بود. ایا میخواید تغییر دهید؟");

    if (!confirm2) return;
    startTransition(async () => {
      setError(null);
      const result = await updateStatus(nextStatus);
      if (!result.ok) {
        setError('امکان تغییر وضعیت وجود ندارد.');
        return;
      }
      setCurrentStatus(nextStatus);
      onStatusChange?.(nextStatus);
    });
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        تغییر وضعیت سفارش
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {INVOICE_STATUSES.map((item) => {
          const active = currentStatus === item;
          return (
            <Button
              key={item}
              size="small"
              variant={active ? 'contained' : 'outlined'}
              color={active ? 'primary' : 'inherit'}
              onClick={() => handleSubmit(item)}
              startIcon={isPending && active ? <CircularProgress size={14} /> : null}
              disabled={isPending || disabled}
            >
              {STATUS_LABELS[item]}
            </Button>
          );
        })}
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
