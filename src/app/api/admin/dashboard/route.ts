import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { requirePermission } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import UserModel from '@/models/User';
import { logErrorLater } from '@/observability/error-log';

type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'canceled' | 'refunded';

const TEHRAN_ZONE = 'Asia/Tehran';
const START_OF_WEEK = 'saturday';
const EXCLUDED_STATUSES: InvoiceStatus[] = ['canceled', 'draft'];
const SALE_STATUSES: InvoiceStatus[] = ['paid'];

interface SummaryResult {
  total: number;
  count: number;
}

interface SeriesPoint {
  date: string;
  total: number;
}

interface DashboardResponse {
  lastUpdated: string;
  stats: {
    salesToday: { value: number; change: number };
    ordersToday: { value: number; change: number };
    pendingOrders: { value: number; change: number };
    activeCustomers: { value: number; change: number };
  };
  revenueSeries: {
    week: SeriesPoint[];
    month: SeriesPoint[];
    quarter: SeriesPoint[];
  };
  topProducts: Array<{
    productId?: string;
    title: string;
    variantSummary?: string;
    revenue: number;
    units: number;
  }>;
  recentOrders: Array<{
    id: string;
    number: string;
    customer: string;
    total: number;
    status: InvoiceStatus;
    createdAt: string;
    city?: string;
    items: number;
  }>;
  statusBreakdown: Array<{
    status: InvoiceStatus;
    count: number;
    value: number;
  }>;
  conversion: {
    rate: number;
    paid: number;
    total: number;
  };
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function percentageChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) {
      return 0;
    }
    return 100;
  }
  return ((current - previous) / previous) * 100;
}

function startOfTehranWeek(dateTime: DateTime): DateTime {
  const zoned = dateTime.setZone(TEHRAN_ZONE);
  const weekday = zoned.weekday; // 1 (Mon) .. 7 (Sun)
  const daysSinceSaturday = (weekday + 1) % 7;
  return zoned.minus({ days: daysSinceSaturday }).startOf('day');
}

async function summarizeInvoices(from: Date, to: Date): Promise<SummaryResult> {
  const [result] = await InvoiceModel.aggregate<{ total: number; count: number }>([
    {
      $match: {
        createdAt: { $gte: from, $lt: to },
        status: { $in: SALE_STATUSES },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$grandTotal' },
        count: { $sum: 1 },
      },
    },
  ]).exec();

  return {
    total: result?.total ?? 0,
    count: result?.count ?? 0,
  };
}

async function countPending(from: Date, to: Date): Promise<number> {
  const total = await InvoiceModel.countDocuments({
    createdAt: { $gte: from, $lt: to },
    status: 'pending',
  }).exec();
  return total;
}

async function countActiveCustomers(from: Date, to: Date): Promise<number> {
  const [result] = await InvoiceModel.aggregate<{ count: number }>([
    {
      $match: {
        createdAt: { $gte: from, $lt: to },
        status: { $nin: EXCLUDED_STATUSES },
      },
    },
    {
      $group: { _id: '$userId' },
    },
    {
      $count: 'count',
    },
  ]).exec();
  return result?.count ?? 0;
}

type SeriesUnit = 'day' | 'week' | 'month';

function bucketStart(unit: SeriesUnit, anchor: DateTime): DateTime {
  if (unit === 'day') {
    return anchor.startOf('day');
  }
  if (unit === 'week') {
    return startOfTehranWeek(anchor);
  }
  if (unit === 'month') {
    return anchor.startOf('month');
  }
  return anchor;
}

const durationKey: Record<SeriesUnit, 'days' | 'weeks' | 'months'> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
};

async function buildRevenueSeries(unit: SeriesUnit, points: number, now: DateTime): Promise<SeriesPoint[]> {
  const lastBucketStart = bucketStart(unit, now);
  const rangeStart = bucketStart(unit, now.minus({ [durationKey[unit]]: points - 1 }));

  const pipeline: any[] = [
    {
      $match: {
        createdAt: { $gte: rangeStart.toJSDate(), $lte: now.endOf('day').toJSDate() },
        status: { $in: SALE_STATUSES },
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$createdAt',
            unit,
            timezone: TEHRAN_ZONE,
            ...(unit === 'week' ? { startOfWeek: START_OF_WEEK } : {}),
          },
        },
        total: { $sum: '$grandTotal' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ];

  const docs = await InvoiceModel.aggregate<{ _id: Date; total: number }>(pipeline).exec();
  const totals = new Map<number, number>();
  docs.forEach((doc) => {
    const time = asDate(doc._id).getTime();
    totals.set(time, doc.total);
  });

  const series: SeriesPoint[] = [];
  for (let idx = points - 1; idx >= 0; idx -= 1) {
    const bucketAnchor = now.minus({ [durationKey[unit]]: idx });
    const bucket = bucketStart(unit, bucketAnchor);
    const key = bucket.toJSDate().getTime();
    series.push({
      date: bucket.toISO() || "",
      total: totals.get(key) ?? 0,
    });
  }

  return series;
}

async function topProducts(now: DateTime) {
  const start = now.minus({ days: 30 }).startOf('day');
  const items = await InvoiceModel.aggregate<{
    _id: {
      productId?: Types.ObjectId;
      title?: string;
      variantSummary?: string;
    };
    revenue?: number;
    units?: number;
  }>([
    {
      $match: {
        createdAt: { $gte: start.toJSDate() },
        status: { $in: SALE_STATUSES },
      },
    },
    { $unwind: '$lines' },
    {
      $group: {
        _id: {
          productId: '$lines.productId',
          title: '$lines.title',
          variantSummary: '$lines.variantSummary',
        },
        revenue: { $sum: '$lines.lineTotal' },
        units: {
          $sum: {
            $ifNull: [
              '$lines.qty',
              {
                $ifNull: ['$lines.requestedQty', 0],
              },
            ],
          },
        },
      },
    },
    {
      $sort: { revenue: -1 },
    },
    { $limit: 5 },
  ]).exec();

  return items.map((item) => {
    const productId = item._id?.productId ? item._id.productId.toString() : undefined;
    return {
      productId,
      title: item._id?.title ?? 'محصول ناشناس',
      variantSummary: item._id?.variantSummary ?? undefined,
      revenue: item.revenue ?? 0,
      units: item.units ?? 0,
    };
  });
}

async function recentOrders(now: DateTime) {
  const invoices = await InvoiceModel.find({
    status: { $ne: 'draft' },
  })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean()
    .exec();

  const userIds = Array.from(
    new Set(
      invoices
        .map((invoice) => invoice.userId)
        .filter((id): id is Types.ObjectId => Boolean(id)),
    ),
  );

  const users = userIds.length
    ? await UserModel.find({ _id: { $in: userIds } })
      .select({ fname: 1, lname: 1, phone: 1 })
      .lean()
      .exec()
    : [];

  const userIndex = new Map<string, { fname?: string; lname?: string; phone?: string }>();
  users.forEach((user) => {
    userIndex.set(user._id.toString(), {
      fname: user.fname,
      lname: user.lname,
      phone: user.phone,
    });
  });

  return invoices.map((invoice) => {
    const user = invoice.userId ? userIndex.get(invoice.userId.toString()) : undefined;
    const name = [user?.fname, user?.lname].filter(Boolean).join(' ');
    const customer = name.length > 0 ? name : user?.phone ?? 'کاربر ناشناس';
    const items = (invoice.lines ?? []).reduce<number>((acc, line) => {
      const qty = line.qty ?? line.requestedQty ?? 0;
      return acc + (typeof qty === 'number' && Number.isFinite(qty) ? qty : 0);
    }, 0);

    const city =
      invoice.addressSnapshot?.city && invoice.addressSnapshot.city.trim().length > 0
        ? invoice.addressSnapshot.city
        : undefined;

    return {
      id: invoice._id.toString(),
      number: invoice.number,
      customer,
      total: invoice.grandTotal ?? 0,
      status: invoice.status as InvoiceStatus,
      createdAt: invoice.createdAt?.toISOString() ?? now.toISO(),
      city,
      items: items > 0 ? items : invoice.lines?.length ?? 0,
    };
  });
}

async function statusBreakdown() {
  const docs = await InvoiceModel.aggregate<
    { _id: InvoiceStatus; count: number; value: number }>([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          value: { $sum: '$grandTotal' },
        },
      },
    ]).exec();

  return docs.map((doc) => ({
    status: doc._id,
    count: doc.count ?? 0,
    value: doc.value ?? 0,
  }));
}

async function conversionStats(now: DateTime) {
  const start = now.minus({ days: 30 }).startOf('day').toJSDate();
  const end = now.endOf('day').toJSDate();
  const total = await InvoiceModel.countDocuments({
    createdAt: { $gte: start, $lte: end },
    status: { $ne: 'draft' },
  }).exec();
  const paid = await InvoiceModel.countDocuments({
    createdAt: { $gte: start, $lte: end },
    status: 'paid',
  }).exec();
  const rate = total === 0 ? 0 : (paid / total) * 100;
  return { rate, paid, total };
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'orders:read');
    await connectMongoose();

    const now = DateTime.now().setZone(TEHRAN_ZONE);
    const startOfToday = now.startOf('day');
    const startOfTomorrow = startOfToday.plus({ days: 1 });
    const startOfYesterday = startOfToday.minus({ days: 1 });
    const startOfDayBeforeYesterday = startOfYesterday.minus({ days: 1 });

    const [
      todaySummary,
      yesterdaySummary,
      pendingToday,
      pendingYesterday,
      activeCurrent,
      activePrevious,
      weeklySeries,
      monthlySeries,
      quarterlySeries,
      topProductsList,
      recentOrdersList,
      breakdown,
      conversion,
    ] = await Promise.all([
      summarizeInvoices(startOfToday.toJSDate(), startOfTomorrow.toJSDate()),
      summarizeInvoices(startOfYesterday.toJSDate(), startOfToday.toJSDate()),
      countPending(startOfToday.toJSDate(), startOfTomorrow.toJSDate()),
      countPending(startOfYesterday.toJSDate(), startOfToday.toJSDate()),
      countActiveCustomers(now.minus({ days: 30 }).startOf('day').toJSDate(), startOfTomorrow.toJSDate()),
      countActiveCustomers(now.minus({ days: 60 }).startOf('day').toJSDate(), now.minus({ days: 30 }).startOf('day').toJSDate()),
      buildRevenueSeries('day', 7, now),
      buildRevenueSeries('week', 5, now),
      buildRevenueSeries('month', 3, now),
      topProducts(now),
      recentOrders(now),
      statusBreakdown(),
      conversionStats(now),
    ]);

    const stats: DashboardResponse['stats'] = {
      salesToday: {
        value: todaySummary.total,
        change: percentageChange(todaySummary.total, yesterdaySummary.total),
      },
      ordersToday: {
        value: todaySummary.count,
        change: percentageChange(todaySummary.count, yesterdaySummary.count),
      },
      pendingOrders: {
        value: pendingToday,
        change: percentageChange(pendingToday, pendingYesterday),
      },
      activeCustomers: {
        value: activeCurrent,
        change: percentageChange(activeCurrent, activePrevious),
      },
    };

    const payload: DashboardResponse = {
      lastUpdated: now.toISO() || "",
      stats,
      revenueSeries: {
        week: weeklySeries,
        month: monthlySeries,
        quarter: quarterlySeries,
      },
      topProducts: topProductsList,
      recentOrders: recentOrdersList,
      statusBreakdown: breakdown,
      conversion,
    };

    return NextResponse.json({ data: payload });
  } catch (error) {
    console.error('Failed to fetch dashboard metrics', error);
    logErrorLater({
      category: 'api',
      source: 'admin.dashboard',
      error,
      statusCode: 500,
      route: request.nextUrl.pathname,
      method: request.method,
    });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
