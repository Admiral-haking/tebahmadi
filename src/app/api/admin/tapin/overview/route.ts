import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import {
  getTapinCredit,
  getTapinShop,
  listTapinOrders,
  listTapinShops,
  listTapinTasks,
  listTapinTransactions,
  listTapinCustomers,
  listTapinEmployees,
} from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';
import { getTapinSyncHealth } from '@/services/tapin/sync';

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1);
  const params = new URL(request.url).searchParams;
  const orderId = Number(params.get('orderId')) || undefined;
  const barcode = params.get('barcode')?.trim().slice(0, 64) || undefined;
  const rawStatus = params.get('status');
  const status = rawStatus !== null && rawStatus !== '' ? Number(rawStatus) : undefined;
  const shopId = params.get('shopId')?.trim().slice(0, 64) || undefined;
  const numeric = (name: string, allowZero = false) => {
    const value = Number(params.get(name));
    return Number.isInteger(value) && (allowZero ? value >= 0 : value > 0) ? value : undefined;
  };
  try {
    await connectMongoose();
    const warnings: string[] = [];
    const optional = async <T>(label: string, promise: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await promise;
      } catch {
        warnings.push(label);
        return fallback;
      }
    };
    const credit = await optional('اعتبار کیف پول', getTapinCredit(shopId), { credit: 0 });
    const remote = await optional(
      'مرسوله‌ها',
      listTapinOrders(page, 20, {
        orderId,
        barcode,
        status: Number.isInteger(status) ? status : undefined,
        firstName: params.get('firstName')?.trim().slice(0, 100) || undefined,
        lastName: params.get('lastName')?.trim().slice(0, 100) || undefined,
        province: numeric('province'),
        city: numeric('city'),
        payType: numeric('payType', true),
        orderType: numeric('orderType', true),
        createdAt: params.get('createdAt')?.trim().slice(0, 30) || undefined,
        shopId,
      }),
      { list: [], page, count: 20, total_count: 0 },
    );
    const [transactions, tasks, shops, shop, customers, employees, linked, active, syncFailures] =
      await Promise.all([
        optional('transactions', listTapinTransactions(1, 10, shopId), {
          list: [],
          total_count: 0,
        }),
        optional('tasks', listTapinTasks(1, 10), { list: [], total_count: 0 }),
        optional('shops', listTapinShops(), { list: [], total_count: 0 }),
        optional('shop', getTapinShop(shopId), {
          title: '',
          status: 0,
          status_display: '',
          owner_first_name: '',
          owner_last_name: '',
          owner_mobile: '',
          address: '',
        }),
        optional('customers', listTapinCustomers(1, 10, { shopId }), {
          list: [],
          total_count: 0,
        }),
        optional('employees', listTapinEmployees(shopId), { list: [], total_count: 0 }),
        InvoiceModel.countDocuments({ 'tapinShipment.orderId': { $type: 'number' } }),
        InvoiceModel.countDocuments({
          'tapinShipment.orderId': { $type: 'number' },
          'tapinShipment.status': { $nin: [7, 80, 102] },
        }),
        InvoiceModel.countDocuments({ 'tapinShipment.syncFailureCount': { $gt: 0 } }),
      ]);
    return NextResponse.json({
      data: {
        credit: credit.credit,
        remote,
        transactions,
        tasks,
        shops,
        shop,
        customers,
        employees,
        linked,
        active,
        syncFailures,
        warnings,
        syncHealth: getTapinSyncHealth(),
      },
    });
  } catch (error) {
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'دریافت داشبورد تاپین ناموفق بود.' }, { status: 502 });
  }
}
