'use server';

import { revalidatePath } from 'next/cache';

import { updateInvoiceProgress, updateInvoiceStatus } from '@/orders/services/invoiceService';
import { cancelSnappPayPayment, settleTorobPayment, updateSnappPayPayment } from '@/payments/paymentService';
import type { InvoiceDocument } from '@/orders/models/Invoice';
import type { InvoiceProgressState } from '@/orders/constants/progress';

export async function changeInvoiceStatusAction(invoiceId: string, status: InvoiceDocument['status']) {
  if (!invoiceId) {
    return { ok: false as const, reason: 'missing_id' };
  }

  const result = await updateInvoiceStatus(invoiceId, status);
  if (!result.ok) {
    return { ok: false as const, reason: result.reason };
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${invoiceId}`);

  return { ok: true as const };
}

export async function changeInvoiceProgressAction(
  invoiceId: string,
  progress: InvoiceProgressState,
  trackingCode?: string,
) {
  if (!invoiceId) {
    return { ok: false as const, reason: 'missing_id' };
  }

  const result = await updateInvoiceProgress(invoiceId, progress, { trackingCode });
  if (!result.ok) {
    return { ok: false as const, reason: result.reason };
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${invoiceId}`);

  return { ok: true as const };
}

export async function settleTorobInvoiceAction(invoiceId: string) {
  if (!invoiceId) {
    return { ok: false as const, reason: 'missing_id' };
  }

  const result = await settleTorobPayment(invoiceId);
  if (!result.ok) {
    return { ok: false as const, reason: result.reason };
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${invoiceId}`);

  return { ok: true as const, alreadySettled: result.alreadySettled ?? false };
}

export async function updateSnappPayInvoiceAction(invoiceId: string, updateInput?: unknown) {
  if (!invoiceId) {
    return { ok: false as const, reason: 'missing_id' };
  }

  const result = await updateSnappPayPayment(invoiceId, updateInput);
  if (!result.ok) {
    return { ok: false as const, reason: result.reason, code: result.code };
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${invoiceId}`);

  return { ok: true as const, transactionId: result.transactionId };
}

export async function cancelSnappPayInvoiceAction(invoiceId: string) {
  if (!invoiceId) {
    return { ok: false as const, reason: 'missing_id' };
  }

  const result = await cancelSnappPayPayment(invoiceId);
  if (!result.ok) {
    return { ok: false as const, reason: result.reason, code: result.code };
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${invoiceId}`);

  return { ok: true as const, transactionId: result.transactionId };
}
