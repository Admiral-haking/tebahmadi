import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ZodError } from 'zod';

import { requirePermission } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';
import { TapinError } from '@/services/tapin/client';
import { invoiceToTapin } from '@/services/tapin/invoice';
import { registerTapinOrder } from '@/services/tapin/orders';
import {
  resolveTapinInsurance,
  resolveTapinPayType,
  resolveTapinPrePaidPrice,
} from '@/services/tapin/payment';
import { ensureTapinIndexes } from '@/services/tapin/indexes';
import {
  tapinManualInvoiceRequestSchema,
  tapinRegisterSchema,
} from '@/services/tapin/validation';

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

    const lockToken = randomUUID();
    const staleBefore = new Date(Date.now() - 2 * 60_000);
    const claimed = await InvoiceModel.findOneAndUpdate(
      {
        _id: input.invoiceId,
        'tapinShipment.orderId': { $exists: false },
        $or: [
          { 'tapinRegistrationLock.claimedAt': { $exists: false } },
          { 'tapinRegistrationLock.claimedAt': { $lt: staleBefore } },
        ],
      },
      { $set: { tapinRegistrationLock: { token: lockToken, claimedAt: new Date() } } },
      { new: true },
    ).lean();
    if (!claimed) {
      return NextResponse.json(
        { error: 'ثبت این مرسوله هم‌اکنون در حال انجام است.' },
        { status: 409 },
      );
    }
    invoice = claimed;

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
    const payType = resolveTapinPayType(invoice, input.payType);
    payload.pay_type = payType;
    payload.has_insurance = resolveTapinInsurance(payType, input.hasInsurance);
    payload.employee_code = input.employeeCode;
    const prePaidPrice = resolveTapinPrePaidPrice(payType, input.prePaidPrice ?? 0);
    payload.pre_paid_price = prePaidPrice;
    payload.packaging_price = input.packagingPrice;
    if (input.presenterCode) payload.presenter_code = input.presenterCode;
    if (input.kioskId) payload.kiosk_id = input.kioskId;
    if (input.duration) payload.duration = input.duration;
    if (input.parcelTurning !== undefined) payload.parcel_turning = input.parcelTurning;

    let registered;
    try {
      registered = await registerTapinOrder(tapinRegisterSchema.parse(payload));
    } catch (error) {
      await InvoiceModel.updateOne(
        { _id: invoice._id, 'tapinRegistrationLock.token': lockToken },
        { $unset: { tapinRegistrationLock: 1 } },
      );
      throw error;
    }

    const shipment = {
      id: registered.id,
      orderId: registered.order_id,
      barcode: registered.barcode,
      status: registered.status,
      totalPrice: registered.total_price,
      sendPrice: registered.send_price,
      registeredAt: new Date(),
      syncedAt: new Date(),
      provinceCode: input.provinceCode,
      cityCode: input.cityCode,
      boxId: input.boxId,
      packetType: input.packetType,
      packageWeight: input.packageWeight,
      orderType: input.orderType,
      contentType: input.contentType,
      hasInsurance: input.hasInsurance,
      shopId: input.shopId,
      payType,
      employeeCode: input.employeeCode,
      prePaidPrice,
      packagingPrice: input.packagingPrice,
      presenterCode: input.presenterCode,
      kioskId: input.kioskId,
      duration: input.duration,
      parcelTurning: input.parcelTurning,
      itemWeights: input.itemWeights?.map((item) => ({
        variantId: new Types.ObjectId(item.variantId),
        weightGrams: item.weightGrams,
      })),
      statusHistory: [
        {
          status: registered.status,
          barcode: registered.barcode,
          changedAt: new Date(),
          source: 'register' as const,
        },
      ],
      syncFailureCount: 0,
    };
    await InvoiceModel.updateOne(
      { _id: invoice._id, 'tapinRegistrationLock.token': lockToken },
      { $set: { tapinShipment: shipment }, $unset: { tapinRegistrationLock: 1 } },
    );
    logAuditLater({
      action: 'create',
      entity: 'tapinShipment',
      entityId: registered.id,
      entityLabel: invoice.number,
      summary: 'ثبت مرسوله در تاپین',
      actor: actorFromUser(user),
      metadata: { invoiceId: input.invoiceId, tapinOrderId: registered.order_id },
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
