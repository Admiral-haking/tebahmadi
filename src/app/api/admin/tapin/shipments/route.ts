import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z, ZodError } from 'zod';

import { requirePermission } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel, type InvoiceDocument } from '@/orders/models/Invoice';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';
import { TapinError } from '@/services/tapin/client';
import { invoiceToTapin } from '@/services/tapin/invoice';
import { findTapinOrderByManualId, registerTapinOrder } from '@/services/tapin/orders';
import {
  resolveTapinInsurance,
  resolveTapinPayType,
  resolveTapinPrePaidPrice,
} from '@/services/tapin/payment';
import { ensureTapinIndexes } from '@/services/tapin/indexes';
import {
  tapinManualInvoiceRequestSchema,
  tapinRegisterSchema,
  tapinRegisteredOrderSchema,
} from '@/services/tapin/validation';
import {
  isAmbiguousTapinRegistrationFailure,
  safeTapinErrorMessage,
} from '@/services/tapin/manual-registration-safety';

type ManualTapinInput = z.infer<typeof tapinManualInvoiceRequestSchema>;
type PreparedTapinRegistration = {
  payload: z.infer<typeof tapinRegisterSchema>;
};

function prepareTapinRegistration(
  invoice: Parameters<typeof invoiceToTapin>[0],
  input: ManualTapinInput,
): PreparedTapinRegistration {
  const payload = invoiceToTapin(invoice, {
    provinceCode: input.provinceCode,
    cityCode: input.cityCode,
    boxId: input.boxId,
    packetType: input.packetType,
    packageWeight: input.packageWeight,
    orderType: input.orderType,
    registerType: input.registerType,
    contentType: input.contentType,
    hasInsurance: input.hasInsurance,
    itemWeights: input.itemWeights,
  });
  if (input.shopId) payload.shop_id = input.shopId;

  const payType = resolveTapinPayType(
    invoice as Pick<InvoiceDocument, 'shippingPaymentMethod'>,
    input.payType,
  );
  payload.pay_type = payType;
  payload.has_insurance = resolveTapinInsurance(payType, input.hasInsurance);
  if (input.employeeCode !== undefined) payload.employee_code = input.employeeCode;
  payload.pre_paid_price = resolveTapinPrePaidPrice(payType, input.prePaidPrice ?? 0);
  if (input.packagingPrice !== undefined) payload.packaging_price = input.packagingPrice;
  if (input.presenterCode !== undefined) payload.presenter_code = input.presenterCode;
  if (input.kioskId !== undefined) payload.kiosk_id = input.kioskId;
  if (input.duration !== undefined) payload.duration = input.duration;
  if (input.parcelTurning !== undefined) payload.parcel_turning = input.parcelTurning;

  const parsed = tapinRegisterSchema.parse(payload);
  return { payload: parsed };
}

function dateOrFallback(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function buildPersistedShipment(
  registered: z.infer<typeof tapinRegisteredOrderSchema>,
  input: ManualTapinInput,
  prepared: PreparedTapinRegistration,
  fallbackRegisteredAt: Date,
) {
  const now = new Date();
  return {
    id: registered.id,
    orderId: registered.order_id,
    barcode: registered.barcode,
    status: registered.status,
    totalPrice: registered.total_price,
    sendPrice: registered.send_price,
    registeredAt: dateOrFallback(registered.created_at, fallbackRegisteredAt),
    syncedAt: now,
    provinceCode: prepared.payload.province_code,
    cityCode: prepared.payload.city_code,
    boxId: prepared.payload.box_id,
    packetType: prepared.payload.packet_type,
    packageWeight: prepared.payload.package_weight,
    orderType: prepared.payload.order_type,
    contentType: prepared.payload.content_type,
    hasInsurance: Boolean(prepared.payload.has_insurance),
    shopId: input.shopId,
    payType: prepared.payload.pay_type,
    employeeCode: prepared.payload.employee_code,
    prePaidPrice: prepared.payload.pre_paid_price,
    packagingPrice: prepared.payload.packaging_price,
    presenterCode: prepared.payload.presenter_code,
    kioskId: prepared.payload.kiosk_id,
    duration: prepared.payload.duration,
    parcelTurning: prepared.payload.parcel_turning,
    itemWeights: input.itemWeights?.map((item) => ({
      variantId: new Types.ObjectId(item.variantId),
      weightGrams: item.weightGrams,
    })),
    statusHistory: [
      {
        status: registered.status,
        barcode: registered.barcode,
        changedAt: now,
        source: 'register' as const,
      },
    ],
    syncFailureCount: 0,
  };
}

async function releaseTapinAttempt(invoiceId: string, manualId: string) {
  await InvoiceModel.updateOne(
    { _id: invoiceId, 'tapinRegistrationAttempt.manualId': manualId },
    { $unset: { tapinRegistrationAttempt: 1, tapinRegistrationLock: 1 } },
  );
}

async function markTapinAttemptUnknown(invoiceId: string, manualId: string, error: unknown) {
  try {
    await InvoiceModel.updateOne(
      { _id: invoiceId, 'tapinRegistrationAttempt.manualId': manualId },
      {
        $set: {
          'tapinRegistrationAttempt.state': 'unknown',
          'tapinRegistrationAttempt.lastCheckedAt': new Date(),
          'tapinRegistrationAttempt.lastError': safeTapinErrorMessage(error),
        },
        $unset: { tapinRegistrationLock: 1 },
      },
    );
  } catch {
    // Keeping the durable attempt is safer than allowing a second external
    // registration when the recovery write itself fails.
  }
}

async function persistTapinShipment(
  invoiceId: string,
  manualId: string,
  shipment: ReturnType<typeof buildPersistedShipment>,
) {
  return InvoiceModel.updateOne(
    {
      _id: invoiceId,
      'tapinShipment.orderId': { $exists: false },
      'tapinRegistrationAttempt.manualId': manualId,
    },
    {
      $set: { tapinShipment: shipment },
      $unset: { tapinRegistrationAttempt: 1, tapinRegistrationLock: 1 },
    },
  );
}

function ambiguousRegistrationResponse(manualId: string, error: unknown) {
  return NextResponse.json(
    {
      error: 'نتیجه ثبت در تاپین نامشخص است؛ برای جلوگیری از ثبت تکراری، ثبت مجدد انجام نشد.',
      manualId,
      details: safeTapinErrorMessage(error),
    },
    { status: 409 },
  );
}

async function reconcilePreviousAttempt(
  invoice: any,
  attempt: any,
  user: any,
  request: NextRequest,
) {
  const manualId = String(attempt.manualId || '');
  const parsedInput = tapinManualInvoiceRequestSchema.safeParse(attempt.input);
  if (!manualId || !parsedInput.success) {
    await markTapinAttemptUnknown(invoice._id.toString(), manualId, 'اطلاعات تلاش قبلی قابل بازیابی نیست.');
    return NextResponse.json(
      { error: 'اطلاعات تلاش قبلی ثبت ناقص است؛ ثبت مجدد خودکار انجام نشد.', manualId },
      { status: 409 },
    );
  }

  let remoteOrder;
  try {
    remoteOrder = await findTapinOrderByManualId(manualId, parsedInput.data.shopId);
  } catch (error) {
    await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
    if (error instanceof TapinError) {
      return NextResponse.json(
        { error: 'نتیجه تلاش قبلی از تاپین قابل بررسی نیست؛ ثبت مجدد انجام نشد.', manualId },
        { status: error.status >= 500 ? 502 : error.status },
      );
    }
    return ambiguousRegistrationResponse(manualId, error);
  }

  if (!remoteOrder) {
    const error = new Error('مرسوله‌ای با شناسه سفارش در تاپین پیدا نشد.');
    await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
    return ambiguousRegistrationResponse(manualId, error);
  }

  const parsedRemote = tapinRegisteredOrderSchema.safeParse(remoteOrder);
  if (!parsedRemote.success) {
    const error = new Error('پاسخ بازیابی‌شده از تاپین ناقص است.');
    await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
    return ambiguousRegistrationResponse(manualId, error);
  }

  let prepared: PreparedTapinRegistration;
  try {
    prepared = prepareTapinRegistration(invoice, parsedInput.data);
  } catch (error) {
    await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
    return NextResponse.json(
      { error: 'اطلاعات سفارش برای تکمیل بازیابی مرسوله معتبر نیست؛ ثبت مجدد انجام نشد.', manualId },
      { status: 409 },
    );
  }

  const startedAt = new Date(attempt.startedAt);
  const shipment = buildPersistedShipment(
    parsedRemote.data,
    parsedInput.data,
    prepared,
    Number.isNaN(startedAt.getTime()) ? new Date() : startedAt,
  );
  try {
    const persisted = await persistTapinShipment(invoice._id.toString(), manualId, shipment);
    if (persisted.matchedCount !== 1) {
      const error = new Error('ذخیره مرسوله در سفارش انجام نشد.');
      await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
      return ambiguousRegistrationResponse(manualId, error);
    }
  } catch (error) {
    await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
    return ambiguousRegistrationResponse(manualId, error);
  }

  logAuditLater({
    action: 'create',
    entity: 'tapinShipment',
    entityId: parsedRemote.data.id,
    entityLabel: invoice.number,
    summary: 'بازیابی مرسوله ثبت‌شده در تاپین',
    actor: actorFromUser(user),
    metadata: { invoiceId: invoice._id.toString(), tapinOrderId: parsedRemote.data.order_id },
    ...requestContext(request),
  });
  return NextResponse.json({ data: shipment, reconciled: true }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'orders:write');
  try {
    const input = tapinManualInvoiceRequestSchema.parse(await request.json());
    if (!Types.ObjectId.isValid(input.invoiceId)) {
      return NextResponse.json({ error: 'شناسه سفارش معتبر نیست.' }, { status: 400 });
    }
    await connectMongoose();
    await ensureTapinIndexes();
    let invoice = await InvoiceModel.findById(input.invoiceId).lean();
    if (!invoice) return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
    if (invoice.tapinShipment?.orderId) {
      return NextResponse.json({ data: invoice.tapinShipment, alreadyRegistered: true });
    }

    if (invoice.tapinRegistrationAttempt?.manualId) {
      return reconcilePreviousAttempt(invoice, invoice.tapinRegistrationAttempt, user, request);
    }

    // Validate all invoice and admin packaging data before claiming the lock.
    const prepared = prepareTapinRegistration(invoice, input);
    const lockToken = randomUUID();
    const manualId = prepared.payload.manual_id;
    const claimed = await InvoiceModel.findOneAndUpdate(
      {
        _id: input.invoiceId,
        'tapinShipment.orderId': { $exists: false },
        'tapinRegistrationAttempt.manualId': { $exists: false },
        'tapinRegistrationLock.token': { $exists: false },
      },
      {
        $set: {
          tapinRegistrationLock: { token: lockToken, claimedAt: new Date() },
          tapinRegistrationAttempt: {
            manualId,
            state: 'registering',
            startedAt: new Date(),
            input,
          },
        },
      },
      { new: true },
    ).lean();
    if (!claimed) {
      return NextResponse.json(
        { error: 'برای این سفارش یک تلاش ثبت فعال یا نامشخص وجود دارد؛ ثبت مجدد انجام نشد.' },
        { status: 409 },
      );
    }
    invoice = claimed;

    let registeredRaw;
    try {
      registeredRaw = await registerTapinOrder(prepared.payload);
    } catch (error) {
      if (isAmbiguousTapinRegistrationFailure(error)) {
        await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
        return ambiguousRegistrationResponse(manualId, error);
      }
      try {
        await releaseTapinAttempt(invoice._id.toString(), manualId);
      } catch {
        await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
      }
      throw error;
    }

    const parsedRegistered = tapinRegisteredOrderSchema.safeParse(registeredRaw);
    if (!parsedRegistered.success) {
      const error = new Error('پاسخ ثبت تاپین ناقص است و نتیجه قابل تأیید نیست.');
      await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
      return ambiguousRegistrationResponse(manualId, error);
    }

    const shipment = buildPersistedShipment(parsedRegistered.data, input, prepared, new Date());
    try {
      const persisted = await persistTapinShipment(invoice._id.toString(), manualId, shipment);
      if (persisted.matchedCount !== 1) {
        const error = new Error('مرسوله در سفارش ذخیره نشد؛ نتیجه ثبت تاپین نامشخص است.');
        await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
        return ambiguousRegistrationResponse(manualId, error);
      }
    } catch (error) {
      await markTapinAttemptUnknown(invoice._id.toString(), manualId, error);
      return ambiguousRegistrationResponse(manualId, error);
    }

    logAuditLater({
      action: 'create',
      entity: 'tapinShipment',
      entityId: parsedRegistered.data.id,
      entityLabel: invoice.number,
      summary: 'ثبت مرسوله در تاپین',
      actor: actorFromUser(user),
      metadata: { invoiceId: input.invoiceId, tapinOrderId: parsedRegistered.data.order_id },
      ...requestContext(request),
    });
    return NextResponse.json({ data: shipment }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'ثبت مرسوله در تاپین ناموفق بود.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
