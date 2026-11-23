import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { requirePermission } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import { TapinError } from '@/services/tapin/client';
import { getTapinLabels } from '@/services/tapin/orders';

type Context = { params: Promise<{ invoiceId: string }> };

export async function GET(request: NextRequest, context: Context) {
  await requirePermission(request, 'orders:read');
  const { invoiceId } = await context.params;
  if (!Types.ObjectId.isValid(invoiceId)) {
    return NextResponse.json({ error: 'شناسه سفارش معتبر نیست.' }, { status: 400 });
  }
  await connectMongoose();
  const invoice = await InvoiceModel.findById(invoiceId).select('tapinShipment').lean();
  if (!invoice) return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
  if (!invoice.tapinShipment?.id) {
    return NextResponse.json({ error: 'مرسوله تاپین ثبت نشده است.' }, { status: 409 });
  }
  try {
    const upstream = await getTapinLabels(
      [invoice.tapinShipment.id],
      invoice.tapinShipment.shopId ?? undefined,
    );
    const body = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="tapin-${invoiceId}.${contentType.includes('html') ? 'html' : 'pdf'}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
    }
    return NextResponse.json({ error: 'دریافت لیبل تاپین ناموفق بود.' }, { status: 502 });
  }
}
