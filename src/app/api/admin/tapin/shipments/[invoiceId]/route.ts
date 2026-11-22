import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z, ZodError } from 'zod';

import { requirePermission } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';
import { TapinError } from '@/services/tapin/client';
import {
  changeTapinOrderStatus,
  editTapinOrder,
  getTapinOrder,
} from '@/services/tapin/orders';
import { hasTapinShipmentEditConfiguration, invoiceToTapin } from '@/services/tapin/invoice';
import {
  resolveTapinInsurance,
  resolveTapinPayType,
  resolveTapinPrePaidPrice,
} from '@/services/tapin/payment';

type Context = { params: Promise<{ invoiceId: string }> };

async function invoiceShipment(invoiceId: string) {
  if (!Types.ObjectId.isValid(invoiceId)) return null;
  await connectMongoose();
  return InvoiceModel.findById(invoiceId).select('tapinShipment number').lean();
}

export async function GET(request: NextRequest, context: Context) {
  await requirePermission(request, 'orders:read');
  const { invoiceId } = await context.params;
  const invoice = await invoiceShipment(invoiceId);
  if (!invoice) return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
  if (!invoice.tapinShipment?.orderId) {
    return NextResponse.json({ error: 'برای این سفارش مرسوله تاپین ثبت نشده است.' }, { status: 409 });
  }
  try {
    const detail = await getTapinOrder(
      invoice.tapinShipment.orderId,
      invoice.tapinShipment.shopId ?? undefined,
    );
    const status = typeof detail.status === 'number' ? detail.status : invoice.tapinShipment.status;
    const barcode =
      typeof detail.barcode === 'string' ? detail.barcode : invoice.tapinShipment.barcode;
    const changed =
      status !== invoice.tapinShipment.status || barcode !== invoice.tapinShipment.barcode;
    await InvoiceModel.updateOne(
      { _id: invoice._id },
      {
        $set: {
          'tapinShipment.status': status,
          'tapinShipment.barcode': barcode,
          'tapinShipment.syncedAt': new Date(),
        },
        ...(changed
          ? {
              $push: {
                'tapinShipment.statusHistory': {
                  status,
                  barcode,
                  changedAt: new Date(),
                  source: 'sync',
                },
              },
            }
          : {}),
      },
    );
    return NextResponse.json({ data: detail });
  } catch (error) {
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
    }
    return NextResponse.json({ error: 'دریافت وضعیت تاپین ناموفق بود.' }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const user = await requirePermission(request, 'orders:write');
  try {
    const { status } = z
      .object({ status: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(80)]) })
      .parse(await request.json());
    const { invoiceId } = await context.params;
    const invoice = await invoiceShipment(invoiceId);
    if (!invoice) return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
    if (!invoice.tapinShipment?.orderId) {
      return NextResponse.json({ error: 'مرسوله تاپین ثبت نشده است.' }, { status: 409 });
    }
    const changed = await changeTapinOrderStatus(
      invoice.tapinShipment.orderId,
      status,
      invoice.tapinShipment.shopId ?? undefined,
    );
    await InvoiceModel.updateOne(
      { _id: invoice._id },
      {
        $set: {
          'tapinShipment.status': changed.status,
          'tapinShipment.barcode': changed.barcode,
          'tapinShipment.syncedAt': new Date(),
        },
        $push: {
          'tapinShipment.statusHistory': {
            status: changed.status,
            barcode: changed.barcode,
            changedAt: new Date(),
            source: 'manual',
          },
        },
      },
    );
    logAuditLater({
      action: 'update',
      entity: 'tapinShipment',
      entityId: invoice.tapinShipment.id,
      entityLabel: invoice.number,
      summary: 'تغییر وضعیت مرسوله تاپین',
      actor: actorFromUser(user),
      changes: [{ field: 'status', before: invoice.tapinShipment.status, after: changed.status }],
      ...requestContext(request),
    });
    return NextResponse.json({ data: changed });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
    }
    return NextResponse.json({ error: 'تغییر وضعیت تاپین ناموفق بود.' }, { status: 502 });
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const user = await requirePermission(request, 'orders:write');
  const { invoiceId } = await context.params;
  if (!Types.ObjectId.isValid(invoiceId)) {
    return NextResponse.json({ error: 'شناسه سفارش معتبر نیست.' }, { status: 400 });
  }
  await connectMongoose();
  const invoice = await InvoiceModel.findById(invoiceId).lean();
  if (!invoice?.tapinShipment?.orderId) {
    return NextResponse.json({ error: 'مرسوله تاپین ثبت نشده است.' }, { status: 409 });
  }
  if (![0, 1, 100, -1].includes(invoice.tapinShipment.status)) {
    return NextResponse.json({ error: 'مرسوله در وضعیت فعلی قابل ویرایش نیست.' }, { status: 409 });
  }
  const config = invoice.tapinShipment;
  if (!hasTapinShipmentEditConfiguration(config)) {
    return NextResponse.json(
      { error: 'تنظیمات اولیه این مرسوله ذخیره نشده و ویرایش خودکار ممکن نیست.' },
      { status: 409 },
    );
  }
  try {
    const payload = invoiceToTapin(invoice, {
      provinceCode: config.provinceCode,
      cityCode: config.cityCode,
      boxId: config.boxId,
      packetType: config.packetType ?? 2,
      packageWeight: config.packageWeight ?? 0,
      orderType: config.orderType as 0 | 1 | 3 | 5,
      registerType: 0,
      contentType: (config.contentType ?? 1) as 1 | 2 | 3 | 4,
      hasInsurance: config.hasInsurance ?? true,
      itemWeights: Array.isArray(config.itemWeights)
        ? config.itemWeights.map((item) => ({
            variantId: String(item.variantId),
            weightGrams: Number(item.weightGrams ?? 0),
          }))
        : undefined,
    });
    const { register_type: _registerType, manual_id: _manualId, ...editPayload } = payload;
    const payType = resolveTapinPayType(invoice, config.payType ?? undefined);
    editPayload.pay_type = payType;
    editPayload.has_insurance = resolveTapinInsurance(payType, Boolean(config.hasInsurance));
    editPayload.employee_code = config.employeeCode ?? -1;
    editPayload.pre_paid_price = resolveTapinPrePaidPrice(payType, config.prePaidPrice ?? 0);
    editPayload.packaging_price = config.packagingPrice ?? 0;
    if (config.kioskId) editPayload.kiosk_id = config.kioskId;
    if (config.duration) editPayload.duration = config.duration;
    if (config.parcelTurning !== null && config.parcelTurning !== undefined) {
      editPayload.parcel_turning = config.parcelTurning;
    }
    const changed = await editTapinOrder(config.orderId, editPayload, config.shopId ?? undefined);
    await InvoiceModel.updateOne(
      { _id: invoice._id },
      {
        $set: {
          'tapinShipment.status': changed.status,
          'tapinShipment.barcode': changed.barcode,
          'tapinShipment.totalPrice': changed.total_price,
          'tapinShipment.sendPrice': changed.send_price,
          'tapinShipment.syncedAt': new Date(),
        },
        $push: {
          'tapinShipment.statusHistory': {
            status: changed.status,
            barcode: changed.barcode,
            changedAt: new Date(),
            source: 'manual',
          },
        },
      },
    );
    logAuditLater({
      action: 'update',
      entity: 'tapinShipment',
      entityId: config.id,
      entityLabel: invoice.number,
      summary: 'ویرایش مرسوله تاپین',
      actor: actorFromUser(user),
      metadata: { orderId: config.orderId },
      ...requestContext(request),
    });
    return NextResponse.json({ data: changed });
  } catch (error) {
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ویرایش مرسوله ناموفق بود.' },
      { status: 400 },
    );
  }
}
