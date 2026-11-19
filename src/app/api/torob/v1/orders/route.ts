import { NextRequest, NextResponse } from 'next/server';
import { importSPKI, jwtVerify } from 'jose';
import { Types } from 'mongoose';

import ProductModel from '@/catalog/models/Product';
import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import { getSiteConfig } from '@/settings/services/settingsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOROB_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----`;

let torobPublicKeyPromise: ReturnType<typeof importSPKI> | undefined;

function getTorobPublicKey() {
  if (!torobPublicKeyPromise) {
    torobPublicKeyPromise = importSPKI(TOROB_PUBLIC_KEY, 'EdDSA');
  }
  return torobPublicKeyPromise;
}

function isoMicro(date: Date): string {
  return date.toISOString().replace(/\.(\d{3})Z$/, '.$1000Z');
}

function parseLimit(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1000) return null;
  return Math.floor(parsed);
}

function parseUtcDate(value: string | null): Date | null {
  if (!value || !value.includes('T') || !value.endsWith('Z')) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeHost(host: string | null): string {
  return (host ?? '').trim().toLowerCase();
}

function getRequestAudience(req: NextRequest): string {
  return normalizeHost(req.headers.get('host'));
}

async function validateTorobToken(req: NextRequest) {
  const token = req.headers.get('X-Torob-Token');
  const version = req.headers.get('X-Torob-Token-Version');
  if (!token) {
    throw new Error('missing_token');
  }
  if (version && version !== '1') {
    throw new Error('invalid_token_version');
  }

  const publicKey = await getTorobPublicKey();
  await jwtVerify(token, publicKey, {
    algorithms: ['EdDSA'],
    audience: getRequestAudience(req),
  });
}

async function isTorobOrderTrackingEnabled(): Promise<boolean> {
  if (process.env.TOROB_ORDER_TRACKING_ENABLED === 'true') return true;
  if (process.env.TOROB_ORDER_TRACKING_ENABLED === 'false') return false;

  const config = await getSiteConfig();
  const values = (config?.values ?? {}) as Record<string, unknown>;
  return values.torobOrderTrackingEnabled === true || values.torobOrderTrackingEnabled === 'true';
}

function resolvePsp(paymentMethod?: string | null): string | undefined {
  const normalized = paymentMethod?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'torob' || normalized === 'torobpay') return 'torobpay';
  return normalized;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await validateTorobToken(req);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'invalid_token' },
      { status: 401 },
    );
  }

  await connectMongoose();

  if (!(await isTorobOrderTrackingEnabled())) {
    return NextResponse.json({ success: false, error: 'torob_order_tracking_disabled' }, { status: 403 });
  }

  const purchaseTimestampGt = parseUtcDate(req.nextUrl.searchParams.get('purchase_timestamp_gt'));
  if (!purchaseTimestampGt) {
    return NextResponse.json(
      { success: false, error: 'purchase_timestamp_gt must be a valid ISO 8601 UTC timestamp' },
      { status: 400 },
    );
  }

  const limit = parseLimit(req.nextUrl.searchParams.get('limit'));
  if (!limit) {
    return NextResponse.json(
      { success: false, error: 'limit is required and must be between 1 and 1000' },
      { status: 400 },
    );
  }

  const invoices = await InvoiceModel.find({
    torobClid: { $exists: true, $ne: '' },
    status: { $in: ['paid', 'canceled', 'refunded'] },
    $or: [
      { createdAt: { $gt: purchaseTimestampGt } },
      {
        createdAt: { $gte: new Date(purchaseTimestampGt.getTime() - 7 * 24 * 60 * 60 * 1000) },
        updatedAt: { $gt: purchaseTimestampGt },
      },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean()
    .exec();

  if (!invoices.length) {
    return NextResponse.json({ success: true, data: [] });
  }

  const productIds = Array.from(
    new Set(
      invoices
        .flatMap((invoice) => invoice.lines ?? [])
        .map((line) => line.productId?.toString?.() ?? '')
        .filter((id) => Types.ObjectId.isValid(id)),
    ),
  );

  const products = productIds.length
    ? await ProductModel.find(
      { _id: { $in: productIds.map((id) => new Types.ObjectId(id)) } },
      { slug: 1 },
    ).lean()
    : [];

  const slugByProductId = new Map(products.map((product) => [product._id.toString(), String(product.slug ?? '')]));
  const baseUrl = (process.env.APP_BASE_URL || 'https://tebahmadi.ir').replace(/\/+$/, '');

  const data = invoices.map((invoice) => {
    const productsPayload = (invoice.lines ?? []).map((line) => {
      const productId = line.productId?.toString?.() ?? '';
      const slug = slugByProductId.get(productId) || line.productSlug || '';
      const quantity = Math.max(1, Math.floor(line.qty ?? line.requestedQty ?? 1));
      return {
        product_url: slug ? `${baseUrl}/product/${slug}` : `${baseUrl}/store`,
        product_price: Math.max(0, Math.floor(line.unitPriceEffective ?? line.unitPriceBase ?? 0)),
        quantity,
      };
    });

    const status = invoice.status === 'canceled' || invoice.status === 'refunded' ? 'cancelled' : 'completed';
    const psp = resolvePsp(invoice.paymentMethod);
    const invoiceExtras = invoice as unknown as { torobClid?: unknown };
    const payload: Record<string, unknown> = {
      purchase_timestamp: isoMicro(new Date(invoice.createdAt ?? Date.now())),
      last_updated_timestamp: isoMicro(new Date(invoice.updatedAt ?? invoice.createdAt ?? Date.now())),
      torob_clid: typeof invoiceExtras.torobClid === 'string' ? invoiceExtras.torobClid : undefined,
      status,
      order_value: Math.max(0, Math.floor((invoice.subtotal ?? 0) - (invoice.discountTotal ?? 0))),
      shipping_amount: Math.max(0, Math.floor(invoice.shippingTotal ?? invoice.shippingPrice ?? 0)),
      phone_number: invoice.addressSnapshot?.phone,
      products: productsPayload,
    };

    if (psp) payload.psp = psp;
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || payload[key] === null) delete payload[key];
    });
    return payload;
  });

  return NextResponse.json(
    { success: true, data },
    { headers: { 'Content-Type': 'application/json' } },
  );
}
