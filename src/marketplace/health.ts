import { DateTime } from "luxon";
import type { Model } from "mongoose";

import ProductModel from "@/catalog/models/Product";
import BslOrder from "@/basalaam/models/orders";
import BslVariantModel from "@/basalaam/models/variants";
import DgkOrder from "@/digikala/models/orders";
import DgkVariantModel from "@/digikala/models/variants";
import { PaymentTransactionModel } from "@/models/Payment";
import VendorModel from "@/settings/models/vendor";
import SnpOrder from "@/snapp/models/orders";
import SnapVariantModel from "@/snapp/models/variants";

type MarketplaceId = "digikala" | "snapp" | "basalaam" | "torob";
type MarketplaceStatus = "healthy" | "warning" | "critical";
type ServiceKey = "dgk" | "snapp" | "basalaam";

export type MarketplaceHealthItem = {
  id: MarketplaceId;
  title: string;
  status: MarketplaceStatus;
  score: number;
  connected: boolean;
  vendors: string[];
  lastSyncAt: string | null;
  lastOrderAt: string | null;
  actionHref: string;
  metrics: {
    totalVariants: number;
    stockMismatches: number;
    missingBarcodes: number;
    openOrders: number;
    ordersLast7Days: number;
    failedPayments?: number;
    paymentRequests?: number;
  };
  issues: string[];
};

export type MarketplaceHealthResponse = {
  generatedAt: string;
  summary: {
    healthy: number;
    warning: number;
    critical: number;
    totalOpenOrders: number;
    totalStockMismatches: number;
    totalMissingBarcodes: number;
  };
  services: MarketplaceHealthItem[];
};

type MarketplaceConfig = {
  id: Exclude<MarketplaceId, "torob">;
  service: ServiceKey;
  title: string;
  actionHref: string;
  variantModel: Model<any>;
  orderModel: Model<any>;
  openOrderQuery: Record<string, unknown>;
};

const marketplaceConfigs: MarketplaceConfig[] = [
  {
    id: "digikala",
    service: "dgk",
    title: "دیجی‌کالا",
    actionHref: "/admin/digikala",
    variantModel: DgkVariantModel,
    orderModel: DgkOrder,
    openOrderQuery: { status: "pending" },
  },
  {
    id: "snapp",
    service: "snapp",
    title: "اسنپ‌شاپ",
    actionHref: "/admin/snapp",
    variantModel: SnapVariantModel,
    orderModel: SnpOrder,
    openOrderQuery: {
      status: { $nin: ["delivered", "canceled", "cancelled", "returned", "completed", "done"] },
    },
  },
  {
    id: "basalaam",
    service: "basalaam",
    title: "باسلام",
    actionHref: "/admin/basalaam",
    variantModel: BslVariantModel,
    orderModel: BslOrder,
    openOrderQuery: { bslOrderStatus: { $nin: [40, 50, 60, 70] } },
  },
];

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hoursSince(value: string | null, now: DateTime): number | null {
  if (!value) return null;
  const date = DateTime.fromISO(value);
  if (!date.isValid) return null;
  return now.diff(date, "hours").hours;
}

function calculateStatus(score: number): MarketplaceStatus {
  if (score < 45) return "critical";
  if (score < 78) return "warning";
  return "healthy";
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function countStockMismatches(variantModel: Model<any>): Promise<number> {
  const marketplaceVariants = await variantModel
    .find({}, { barcode: 1, quantity: 1 })
    .lean<Array<{ barcode?: string; quantity?: number }>>();
  const barcodes = Array.from(
    new Set(
      marketplaceVariants
        .map((item) => (typeof item.barcode === "string" ? item.barcode.trim() : ""))
        .filter(Boolean),
    ),
  );

  if (!barcodes.length) return 0;

  const localVariants = await ProductModel.aggregate<{
    barcode?: string;
    quantity?: number;
  }>([
    { $unwind: "$variants" },
    { $match: { "variants.barcode": { $in: barcodes } } },
    {
      $project: {
        _id: 0,
        barcode: "$variants.barcode",
        quantity: "$variants.inventory.quantity",
      },
    },
  ]).exec();

  const localByBarcode = new Map<string, number>();
  localVariants.forEach((item) => {
    if (item.barcode) {
      localByBarcode.set(String(item.barcode).trim(), Number(item.quantity ?? 0));
    }
  });

  return marketplaceVariants.reduce((count, item) => {
    const barcode = typeof item.barcode === "string" ? item.barcode.trim() : "";
    if (!barcode || !localByBarcode.has(barcode)) return count;
    return Number(item.quantity ?? 0) !== Number(localByBarcode.get(barcode) ?? 0) ? count + 1 : count;
  }, 0);
}

async function buildMarketplaceHealth(config: MarketplaceConfig, vendors: string[], now: DateTime): Promise<MarketplaceHealthItem> {
  const sevenDaysAgo = now.minus({ days: 7 }).toJSDate();
  const [
    totalVariants,
    missingBarcodes,
    openOrders,
    ordersLast7Days,
    lastVariant,
    lastOrder,
    stockMismatches,
  ] = await Promise.all([
    config.variantModel.countDocuments({}).exec(),
    config.variantModel
      .countDocuments({
        $or: [{ barcode: { $exists: false } }, { barcode: "" }, { barcode: null }],
      })
      .exec(),
    config.orderModel.countDocuments(config.openOrderQuery).exec(),
    config.orderModel.countDocuments({ createdAt: { $gte: sevenDaysAgo } }).exec(),
    config.variantModel.findOne({}, { updatedAt: 1 }).sort({ updatedAt: -1 }).lean<{ updatedAt?: Date }>(),
    config.orderModel.findOne({}, { updatedAt: 1, createdAt: 1 }).sort({ updatedAt: -1 }).lean<{ updatedAt?: Date; createdAt?: Date }>(),
    countStockMismatches(config.variantModel),
  ]);

  const lastSyncAt = toIso(lastVariant?.updatedAt);
  const lastOrderAt = toIso(lastOrder?.updatedAt ?? lastOrder?.createdAt);
  const syncAgeHours = hoursSince(lastSyncAt, now);
  const connected = vendors.length > 0;
  const issues: string[] = [];
  let score = 100;

  if (!connected) {
    issues.push("هیچ فروشنده‌ای برای این سرویس ثبت نشده است.");
    score -= 45;
  }
  if (!lastSyncAt) {
    issues.push("هنوز داده موجودی/کالا برای این سرویس ذخیره نشده است.");
    score -= 28;
  } else if (syncAgeHours !== null && syncAgeHours > 24) {
    issues.push("آخرین بروزرسانی موجودی بیش از ۲۴ ساعت قبل بوده است.");
    score -= syncAgeHours > 72 ? 24 : 14;
  }
  if (missingBarcodes > 0) {
    issues.push(`${missingBarcodes.toLocaleString("fa-IR")} آیتم بدون بارکد/کد فروشنده است.`);
    score -= Math.min(20, missingBarcodes * 2);
  }
  if (stockMismatches > 0) {
    issues.push(`${stockMismatches.toLocaleString("fa-IR")} اختلاف موجودی با سایت پیدا شد.`);
    score -= Math.min(28, stockMismatches * 3);
  }
  if (openOrders > 20) {
    issues.push("تعداد سفارش‌های باز بالاست و نیاز به بررسی دارد.");
    score -= 10;
  }

  const safeScore = clampScore(score);

  return {
    id: config.id,
    title: config.title,
    status: calculateStatus(safeScore),
    score: safeScore,
    connected,
    vendors,
    lastSyncAt,
    lastOrderAt,
    actionHref: config.actionHref,
    metrics: {
      totalVariants,
      stockMismatches,
      missingBarcodes,
      openOrders,
      ordersLast7Days,
    },
    issues: issues.length ? issues : ["مورد بحرانی فعالی دیده نشد."],
  };
}

async function buildTorobHealth(now: DateTime): Promise<MarketplaceHealthItem> {
  const credentials = [
    process.env.TOROBPAY_CLIENT_ID,
    process.env.TOROBPAY_CLIENT_SECRET,
    process.env.TOROBPAY_USERNAME,
    process.env.TOROBPAY_PASSWORD,
  ];
  const connected = credentials.every((value) => typeof value === "string" && value.trim().length > 0);
  const sevenDaysAgo = now.minus({ days: 7 }).toJSDate();
  const [paymentRequests, failedPayments, lastPayment] = await Promise.all([
    PaymentTransactionModel.countDocuments({ gateway: "torob", createdAt: { $gte: sevenDaysAgo } }).exec(),
    PaymentTransactionModel.countDocuments({ gateway: "torob", status: "failed", createdAt: { $gte: sevenDaysAgo } }).exec(),
    PaymentTransactionModel.findOne({ gateway: "torob" }, { updatedAt: 1, createdAt: 1 })
      .sort({ updatedAt: -1 })
      .lean<{ updatedAt?: Date; createdAt?: Date }>(),
  ]);

  const issues: string[] = [];
  let score = 100;
  if (!connected) {
    issues.push("تنظیمات TorobPay کامل نیست.");
    score -= 55;
  }
  if (failedPayments > 0) {
    issues.push(`${failedPayments.toLocaleString("fa-IR")} پرداخت ناموفق ترب‌پی در ۷ روز اخیر ثبت شده است.`);
    score -= Math.min(35, failedPayments * 8);
  }
  if (paymentRequests === 0) {
    issues.push("در ۷ روز اخیر پرداختی از ترب‌پی ثبت نشده است.");
    score -= connected ? 8 : 0;
  }

  const safeScore = clampScore(score);

  return {
    id: "torob",
    title: "ترب‌پی",
    status: calculateStatus(safeScore),
    score: safeScore,
    connected,
    vendors: connected ? ["TorobPay"] : [],
    lastSyncAt: toIso(lastPayment?.updatedAt ?? lastPayment?.createdAt),
    lastOrderAt: null,
    actionHref: "/admin/orders",
    metrics: {
      totalVariants: 0,
      stockMismatches: 0,
      missingBarcodes: 0,
      openOrders: 0,
      ordersLast7Days: 0,
      failedPayments,
      paymentRequests,
    },
    issues: issues.length ? issues : ["پرداخت‌های ترب‌پی مشکل فعالی نشان نمی‌دهند."],
  };
}

export async function getMarketplaceHealth(): Promise<MarketplaceHealthResponse> {
  const now = DateTime.now().setZone("Asia/Tehran");
  const vendorDocs = await VendorModel.find({}).lean<Array<{ service: ServiceKey; vendors?: string[] }>>();
  const vendorsByService = new Map<ServiceKey, string[]>();
  vendorDocs.forEach((doc) => {
    vendorsByService.set(doc.service, Array.isArray(doc.vendors) ? doc.vendors.filter(Boolean) : []);
  });

  const services = await Promise.all([
    ...marketplaceConfigs.map((config) =>
      buildMarketplaceHealth(config, vendorsByService.get(config.service) ?? [], now),
    ),
    buildTorobHealth(now),
  ]);

  return {
    generatedAt: now.toISO() ?? new Date().toISOString(),
    summary: {
      healthy: services.filter((item) => item.status === "healthy").length,
      warning: services.filter((item) => item.status === "warning").length,
      critical: services.filter((item) => item.status === "critical").length,
      totalOpenOrders: services.reduce((sum, item) => sum + item.metrics.openOrders, 0),
      totalStockMismatches: services.reduce((sum, item) => sum + item.metrics.stockMismatches, 0),
      totalMissingBarcodes: services.reduce((sum, item) => sum + item.metrics.missingBarcodes, 0),
    },
    services,
  };
}
