import { Types } from 'mongoose';

import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import { PaymentTransactionModel } from '@/models/Payment';
import { RefundModel } from '@/models/Refund';
import { cancelSnappPayPayment } from '@/payments/paymentService';

export function validateRefundAmount(amount: number, invoiceTotal: number, alreadyRefunded = 0) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > invoiceTotal) {
    throw new Error('invalid_refund_amount');
  }
  if (alreadyRefunded + amount > invoiceTotal) throw new Error('refund_exceeds_paid_amount');
  return amount;
}

export async function requestInvoiceRefund(input: {
  invoiceId: string;
  amount?: number;
  reason?: string;
  /** Stable caller-generated key for a partial refund; full refunds use `full`. */
  operation?: string;
  actorId?: string;
}) {
  await connectMongoose();
  if (!Types.ObjectId.isValid(input.invoiceId)) throw new Error('invalid_invoice_id');
  const invoice = await InvoiceModel.findById(input.invoiceId);
  if (!invoice || !['paid', 'refunded', 'canceled'].includes(invoice.status)) {
    throw new Error('invoice_not_refundable');
  }
  const payment = await PaymentTransactionModel.findOne({
    invoiceId: invoice._id,
    status: 'paid',
  }).sort({ paidAt: -1, createdAt: -1 });
  if (!payment) throw new Error('paid_transaction_not_found');
  const amount = input.amount ?? invoice.grandTotal;
  const operation =
    input.operation?.trim() || (amount === invoice.grandTotal ? 'full' : `partial:${amount}`);
  if (!/^[a-zA-Z0-9:_-]{1,160}$/.test(operation)) throw new Error('invalid_refund_operation');
  const gateway = String(payment.gateway ?? '').trim();
  if (!gateway) throw new Error('refund_gateway_missing');

  // Claim the gateway operation before inspecting totals or calling the gateway.
  // The partial unique index turns concurrent equal requests into one operation.
  let refund;
  try {
    refund = await RefundModel.create({
      invoiceId: invoice._id,
      paymentTransactionId: payment._id,
      amount,
      gateway,
      operation,
      requestedBy: input.actorId,
      reason: input.reason,
      status: 'requested',
      requestedAt: new Date(),
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const existing = await RefundModel.findOne({ invoiceId: invoice._id, gateway, operation });
    if (existing?.status === 'completed') {
      return {
        refund: existing,
        automated: gateway === 'snapppay',
        requiresManualAction: false,
        idempotent: true,
      };
    }
    throw new Error('refund_already_in_progress');
  }

  const existingCompleted = await RefundModel.aggregate([
    { $match: { invoiceId: invoice._id, status: 'completed' } },
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ]);
  const completedAmount = Number(existingCompleted[0]?.amount ?? 0);
  try {
    validateRefundAmount(amount, invoice.grandTotal, completedAmount);
  } catch (error) {
    refund.status = 'rejected';
    refund.meta = { reason: 'over_refund' };
    await refund.save();
    throw error;
  }

  // Distinct partial-refund operations have distinct idempotency keys, so the
  // unique Refund index alone cannot cap their combined amount. Reserve against
  // the invoice with a single conditional update; concurrent writers contend on
  // this document and only the one(s) within the remaining balance can proceed.
  const reserved = await InvoiceModel.findOneAndUpdate(
    {
      _id: invoice._id,
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ['$refundReservedAmount', 0] }, amount] },
          invoice.grandTotal - completedAmount,
        ],
      },
    },
    { $inc: { refundReservedAmount: amount } },
    { new: true },
  );
  if (!reserved) {
    refund.status = 'rejected';
    refund.meta = { reason: 'over_refund_or_concurrent_reservation' };
    await refund.save();
    throw new Error('refund_exceeds_paid_amount');
  }
  if (gateway !== 'snapppay' || amount !== invoice.grandTotal) {
    refund.meta = { requiresGatewayAction: true, partialRefund: amount !== invoice.grandTotal };
    await refund.save();
    return { refund, automated: false, requiresManualAction: true, idempotent: false };
  }
  const result = await cancelSnappPayPayment(input.invoiceId);
  if (!result.ok) {
    refund.status = 'failed';
    refund.meta = { error: result.reason, code: result.code };
    await refund.save();
    await InvoiceModel.updateOne({ _id: invoice._id }, { $inc: { refundReservedAmount: -amount } });
    return {
      refund,
      automated: true,
      requiresManualAction: true,
      error: result.reason,
      idempotent: false,
    };
  }
  refund.status = 'completed';
  refund.completedAt = new Date();
  refund.gatewayRefId = result.transactionId;
  refund.meta = { automatedBy: 'snapppay.cancel' };
  await refund.save();
  await InvoiceModel.updateOne(
    { _id: invoice._id },
    { $set: { status: 'refunded', refundedAt: refund.completedAt } },
  );
  return { refund, automated: true, requiresManualAction: false, idempotent: false };
}
