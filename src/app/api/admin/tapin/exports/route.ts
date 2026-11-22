import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import {
  getTapinBarcodesByDate,
  getTapinInvoicesBulk,
  getTapinLabelsByDate,
} from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';

const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('labels'),
    fromDate: z.string().min(1),
    toDate: z.string().min(1),
    shopId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal('barcodes'),
    fromDate: z.string().min(1),
    toDate: z.string().min(1),
    shopId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal('invoices'),
    orderIds: z.array(z.coerce.number().int().positive()).min(1).max(50),
    shopId: z.string().uuid().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  try {
    const input = schema.parse(await request.json());
    const upstream =
      input.type === 'invoices'
        ? await getTapinInvoicesBulk(input.orderIds, input.shopId)
        : input.type === 'labels'
          ? await getTapinLabelsByDate(input.fromDate, input.toDate, input.shopId)
          : await getTapinBarcodesByDate(input.fromDate, input.toDate, input.shopId);
    const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';
    return new NextResponse(await upstream.arrayBuffer(), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="tapin-${input.type}.${contentType.includes('pdf') ? 'pdf' : 'html'}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    if (error instanceof TapinError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'دریافت خروجی تاپین ناموفق بود.' }, { status: 502 });
  }
}
