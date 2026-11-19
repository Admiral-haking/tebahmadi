'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Alert,
  CircularProgress,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';

import { changeInvoiceProgressAction } from '@/app/admin/orders/[id]/actions';
import {
  INVOICE_PROGRESS_STATES,
  type InvoiceProgressState,
} from '@/orders/constants/progress';
import { PROGRESS_LABELS, STATUS_LABELS, type InvoiceStatus } from '../constants';

const stepDateFormatter = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export interface InvoiceProgressView {
  current?: InvoiceProgressState;
  inProgressAt?: string;
  packagedPostedAt?: string;
  orderFinishedAt?: string;
  packagedPostedTrackingNumber?: string;
}

interface ProgressUpdateFormProps {
  invoiceId: string;
  status: InvoiceStatus;
  progress?: InvoiceProgressView | null;
  isFrozen: boolean;
  freezeDeadline?: string;
  onProgressChange?: (state: InvoiceProgressState) => void;
}

export default function ProgressUpdateForm({
  invoiceId,
  status,
  progress,
  isFrozen,
  freezeDeadline,
  onProgressChange,
}: ProgressUpdateFormProps) {
  const [currentProgress, setCurrentProgress] = useState<InvoiceProgressState | undefined>(
    progress?.current,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentProgress(progress?.current);
  }, [progress?.current]);

  const canEdit = status === 'paid' && !isFrozen;
  const updateProgress = changeInvoiceProgressAction.bind(null, invoiceId);
  const currentIndex = currentProgress
    ? INVOICE_PROGRESS_STATES.indexOf(currentProgress)
    : -1;
  const activeStep = currentIndex >= 0 ? currentIndex : 0;

  const stepDates = useMemo(
    () => ({
      'in-progress': progress?.inProgressAt,
      'packaged-posted': progress?.packagedPostedAt,
      'order-finished': progress?.orderFinishedAt,
    }),
    [progress?.inProgressAt, progress?.packagedPostedAt, progress?.orderFinishedAt],
  );

  const formatStepDate = (value?: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return stepDateFormatter.format(date);
  };

  const handleChange = (next: InvoiceProgressState) => {
    if (!canEdit) {
      return;
    }

    let trackingCode: string | undefined;

    if (next === 'packaged-posted') {
      const defaultValue = progress?.packagedPostedTrackingNumber ?? '';
      const input = window.prompt('شماره پیگیری پستی را وارد کنید', defaultValue);
      if (input === null) {
        return;
      }
      const trimmed = input.trim();
      if (!trimmed) {
        alert('لطفاً شماره پیگیری معتبر وارد کنید.');
        return;
      }
      trackingCode = trimmed;
    } else if (next === currentProgress) {
      return;
    }

    const confirm = window.confirm('از تغییر مرحله سفارش مطمئن هستید؟');
    if (!confirm) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await updateProgress(next, trackingCode);
      if (!result.ok) {
        const reason = result.reason;
        let message = 'امکان بروزرسانی مرحله سفارش وجود ندارد.';
        if (reason === 'tracking_code_required') {
          message = 'ثبت شماره پیگیری پستی الزامی است.';
        } else if (reason === 'status_not_paid') {
          message = 'تنها سفارش‌های پرداخت‌شده قابل بروزرسانی هستند.';
        } else if (reason === 'invoice_frozen') {
          message = 'به دلیل گذشت بیش از یک ماه از ارسال، امکان تغییر وجود ندارد.';
        }
        setError(message);
        return;
      }
      setCurrentProgress(next);
      onProgressChange?.(next);
    });
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="subtitle2" color="text.secondary">
          پیگیری مراحل سفارش
        </Typography>
        <Typography variant="caption" color="text.secondary">
          وضعیت پرداخت: {STATUS_LABELS[status]}
        </Typography>
      </Stack>
      <Stepper activeStep={activeStep} alternativeLabel nonLinear sx={{ pb: 1 }}>
        {INVOICE_PROGRESS_STATES.map((state, index) => {
          const reached = currentIndex >= index;
          const isClickable = canEdit && index <= currentIndex + 1;
          const label = PROGRESS_LABELS[state];
          const optional = formatStepDate(stepDates[state]);
          return (
            <Step key={state} completed={reached}>
              <StepButton
                color="inherit"
                onClick={() => handleChange(state)}
                disabled={!isClickable || isPending || (reached && index < currentIndex)}
              >
                <StepLabel
                  optional={
                    optional ? (
                      <Typography variant="caption" color="text.secondary">
                        {optional}
                      </Typography>
                    ) : undefined
                  }
                >
                  <Stack spacing={0.5}>
                    <Typography variant="body2" fontWeight={600}>
                      {label.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {label.helper}
                    </Typography>
                  </Stack>
                </StepLabel>
              </StepButton>
            </Step>
          );
        })}
      </Stepper>
      {isPending ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            در حال بروزرسانی مرحله سفارش...
          </Typography>
        </Stack>
      ) : null}
      {progress?.packagedPostedTrackingNumber ? (
        <Alert severity="success" variant="outlined">
          شماره پیگیری پستی: {progress.packagedPostedTrackingNumber}
        </Alert>
      ) : null}
      {!canEdit ? (
        <Alert severity="info">
          {isFrozen
            ? freezeDeadline
              ? `این سفارش از ${freezeDeadline} قفل شده و قابل ویرایش نیست.`
              : 'این سفارش به دلیل گذشت بیش از یک ماه از ارسال قفل شده است.'
            : 'تنها سفارش‌های پرداخت‌شده قابل بروزرسانی هستند.'}
        </Alert>
      ) : (
        <Typography variant="caption" color="text.secondary">
          برای تغییر مرحله بعدی روی آن کلیک کنید. امکان بازگشت به مراحل قبلی وجود ندارد.
        </Typography>
      )}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
