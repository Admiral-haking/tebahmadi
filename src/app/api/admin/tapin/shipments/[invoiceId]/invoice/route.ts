import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { requirePermission } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import { TapinError } from '@/services/tapin/client';
import { getTapinInvoiceDocument } from '@/services/tapin/orders';

type Context = { params: Promise<{ invoiceId: string }> };

export async function GET(request: NextRequest, context: Context) {
  await requirePermission(request, 'orders:read');
  const { invoiceId } = await context.params;
  if (!Types.ObjectId.isValid(invoiceId)) {
    return NextResponse.json({ error: 'شناسه سفارش معتبر نیست.' }, { status: 400 });
  }
  await connectMongoose();
  const invoice = await InvoiceModel.findById(invoiceId)
    .select('tapinShipment.orderId tapinShipment.shopId')
    .lean();
  if (!invoice) return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
  if (!invoice.tapinShipment?.orderId) {
    return NextResponse.json({ error: 'مرسوله تاپین ثبت نشده است.' }, { status: 409 });
  }
  try {
    const upstream = await getTapinInvoiceDocument(
      invoice.tapinShipment.orderId,
      invoice.tapinShipment.shopId ?? undefined,
    );
    return new NextResponse(await upstream.arrayBuffer(), {
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="tapin-invoice-${invoiceId}.html"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'دریافت فاکتور تاپین ناموفق بود.' }, { status: 502 });
  }
}
