import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import { checkTapinPrice } from '@/services/tapin/orders';
import { invoiceToTapin } from '@/services/tapin/invoice';
import { TapinError } from '@/services/tapin/client';
import {
  tapinManualInvoiceRequestSchema,
  tapinShipmentSchema,
} from '@/services/tapin/validation';
import {
  resolveTapinInsurance,
  resolveTapinPayType,
  resolveTapinPrePaidPrice,
} from '@/services/tapin/payment';

export async function POST(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  try {
    const input = tapinManualInvoiceRequestSchema.parse(await request.json());
    if (!Types.ObjectId.isValid(input.invoiceId)) {
      return NextResponse.json({ error: 'شناسه سفارش معتبر نیست.' }, { status: 400 });
    }
    await connectMongoose();
    const invoice = await InvoiceModel.findById(input.invoiceId).lean();
    if (!invoice) return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
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
    const { register_type: _registerType, manual_id: _manualId, ...quotePayload } = payload;
    if (input.shopId) quotePayload.shop_id = input.shopId;
    const payType = resolveTapinPayType(invoice, input.payType);
    quotePayload.pay_type = payType;
    quotePayload.has_insurance = resolveTapinInsurance(payType, input.hasInsurance);
    quotePayload.employee_code = input.employeeCode;
    quotePayload.pre_paid_price = resolveTapinPrePaidPrice(payType, input.prePaidPrice ?? 0);
    quotePayload.packaging_price = input.packagingPrice;
    if (input.kioskId) quotePayload.kiosk_id = input.kioskId;
    if (input.duration) quotePayload.duration = input.duration;
    if (input.parcelTurning !== undefined) quotePayload.parcel_turning = input.parcelTurning;
    return NextResponse.json({
      data: await checkTapinPrice(tapinShipmentSchema.parse(quotePayload)),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof TapinError) {
      return NextResponse.json(
        { error: error.message, details: error.data },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : 'استعلام تاپین ناموفق بود.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
