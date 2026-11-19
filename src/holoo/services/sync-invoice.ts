import { DateTime } from "luxon";

import ProductModel from "@/catalog/models/Product";
import DgkVariantModel from "@/digikala/models/variants";
import BslVariantModel from "@/basalaam/models/variants";
import SnapVariantModel from "@/snapp/models/variants";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { InvoiceModel, type InvoiceDocument } from "@/orders/models/Invoice";
import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService";
import { TrackerModel } from "@/tracking";

import { HOLOO_CONNECTION_ID, isHolooConfigured } from "../constants/config";
import { createHolooCustomer, listHolooCustomers } from "./customer";
import { createHolooProduct, listHolooProducts } from "./product";
import { createHolooInvoice, listHolooInvoices } from "./invoice";
import { resolveSidegroupForBarcode } from "./subgroup";
import type { HolooInvoiceDetailInput } from "../types";

const SALE_INVOICE_TYPE = 1;       // 1 = فروش
const RETURN_INVOICE_TYPE = 2;     // 2 = برگشت از فروش

/**
 * تبدیل تومان به ریال. سایت همهٔ قیمت‌ها را به تومان نگه می‌دارد
 * (مثل `unitPriceEffective`) ولی هلو ریال می‌خواهد، پس هر تومان = ۱۰ ریال.
 * ⚠️ فقط برای مسیر «سایت» استفاده شود؛ مسیر مارکت‌پلیس از `tracker.amount`
 * استفاده می‌کند که از قبل ریال است (در `become-seller` در ۱۰ ضرب می‌شود).
 */
function toRial(tomanAmount: number): number {
    return Math.round((Number(tomanAmount) || 0) * 10);
}

export type SyncInvoiceResult =
    | { ok: true; erpcode: string; number?: string }
    | { ok: false; skipped: string; detail?: unknown };

/** Auto-sync is on whenever Holoo is configured, unless explicitly disabled. */
export function isHolooAutoSyncEnabled(): boolean {
    return isHolooConfigured() && process.env.HOLOO_AUTO_SYNC !== "false";
}

function holooDate(value: Date): string {
    return DateTime.fromJSDate(value, { zone: "Asia/Tehran" }).toFormat("yyyy-MM-dd");
}
function holooTime(value: Date): string {
    return DateTime.fromJSDate(value, { zone: "Asia/Tehran" }).toFormat("HH:mm");
}

// ─────────────────────────────────────────────────────────────
// 409 conflict handling
// ─────────────────────────────────────────────────────────────

/** Shape persisted in the dedup marker once an invoice is (or appears) posted. */
type SyncMarker = {
    erpcode?: string;
    number?: string;
    /** Set when Holoo rejected the post as a duplicate we could not reconcile. */
    conflict?: boolean;
    reconciled?: boolean;
    syncedAt?: number;
    /** Permanently unsyncable (e.g. all lines reference deleted products). */
    skipped?: boolean;
    reason?: string;
    missingSkus?: string[];
};

function isConflict(error: unknown): boolean {
    const status = (error as any)?.status ?? (error as any)?.holooCode;
    return String(status) === "409";
}

/**
 * Holoo returned 409 — the invoice id/number already exists. This happens when a
 * previous run posted the document but crashed before writing the dedup marker.
 * We must NOT re-post (that would duplicate the accounting document). Instead,
 * best-effort match the existing invoice by customer + date + type (+ sum as a
 * tiebreaker). If the match is unambiguous we recover its ErpCode; otherwise we
 * persist a `conflict` marker so the caller stops retrying and flags it for review.
 */
async function reconcileConflict(
    markerKey: string,
    match: { customererpcode: string; date: string; type: number; total: number },
): Promise<SyncMarker> {
    let rows: Awaited<ReturnType<typeof listHolooInvoices>> = [];
    try {
        rows = await listHolooInvoices({
            Type: String(match.type),
            "date.from": match.date,
            "date.to": match.date,
        });
    } catch {
        // Lookup itself failed — fall through to an unresolved conflict marker.
    }

    let candidates = rows.filter((r) => String(r.CustomerErpCode) === match.customererpcode);
    if (candidates.length > 1 && match.total > 0) {
        const byTotal = candidates.filter(
            (r) => Math.round(Number(r.SumPrice) || 0) === match.total,
        );
        if (byTotal.length) candidates = byTotal;
    }

    const marker: SyncMarker =
        candidates.length === 1 && candidates[0].ErpCode
            ? { erpcode: candidates[0].ErpCode, reconciled: true, syncedAt: Date.now() }
            : { conflict: true, syncedAt: Date.now() };

    await setServiceInfo("holoo", markerKey, HOLOO_CONNECTION_ID, marker);
    return marker;
}

// ─────────────────────────────────────────────────────────────
// Channel configuration
// ─────────────────────────────────────────────────────────────

/** Sales channels that can be synced to Holoo. */
export type SalesChannel = "site" | "digikala" | "basalaam" | "snapp";

/** Human-readable Persian labels for each channel. */
const CHANNEL_LABELS: Record<SalesChannel, string> = {
    site: "سایت",
    digikala: "دیجی‌کالا",
    basalaam: "باسلام",
    snapp: "اسنپ‌شاپ",
};

/**
 * Base customer names for each channel.
 * Environment variables allow overriding per deployment.
 */
const CHANNEL_CUSTOMER_NAMES: Record<SalesChannel, string> = {
    site: (process.env.HOLOO_CUSTOMER_SITE || "مشتری سایت").trim(),
    digikala: (process.env.HOLOO_CUSTOMER_DIGIKALA || "مشتری دیجیکالا").trim(),
    basalaam: (process.env.HOLOO_CUSTOMER_BASALAAM || "مشتری باسلام").trim(),
    snapp: (process.env.HOLOO_CUSTOMER_SNAPP || "مشتری اسنپ شاپ").trim(),
};

/**
 * Map serviceId from TrackerModel → SalesChannel.
 * Used when syncing marketplace orders to Holoo.
 */
const SERVICE_TO_CHANNEL: Record<string, SalesChannel> = {
    dgk: "digikala",
    basalaam: "basalaam",
    snapp: "snapp",
    website: "site",
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function normalizeFa(value: string): string {
    return (value || "")
        .replace(/[يى]/g, "ی")
        .replace(/ك/g, "ک")
        .replace(/‌/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function gatewayLabel(method?: string): string {
    const m = (method || "").toLowerCase();
    if (!m) return "نامشخص";
    if (m.includes("snapp")) return "اسنپ‌پی";
    if (m.includes("torob")) return "ترب‌پی";
    if (m.includes("digipay")) return "دیجی‌پی";
    if (m.includes("azki")) return "ازکی‌وام";
    if (m.includes("zarin")) return "زرین‌پال";
    if (m.includes("cod") || m.includes("cash")) return "پرداخت در محل";
    return method as string;
}

function faDateTime(d: Date): string {
    try {
        return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(d);
    } catch {
        return d.toISOString().slice(0, 16);
    }
}

/** Build a rich comment for the invoice line, including buyer and order info. */
function buildComment(
    invoice: InvoiceDocument,
    channel: SalesChannel,
    vendorLabel?: string,
): string {
    const a = invoice.addressSnapshot;
    const name = `${a?.fname ?? ""} ${a?.lname ?? ""}`.trim();
    const addr = [a?.state, a?.city, a?.address].filter(Boolean).join("، ");
    const created = invoice.createdAt instanceof Date ? invoice.createdAt : new Date();
    const channelDisplay = vendorLabel
        ? `${CHANNEL_LABELS[channel]} ${vendorLabel}`
        : CHANNEL_LABELS[channel];

    return [
        `خرید از ${channelDisplay}`,
        name && `خریدار: ${name}`,
        a?.phone && `تلفن: ${a.phone}`,
        addr && `آدرس: ${addr}`,
        a?.postalCode && `کدپستی: ${a.postalCode}`,
        `درگاه: ${gatewayLabel(invoice.paymentMethod)}`,
        `تاریخ: ${faDateTime(created)}`,
        `سفارش: ${invoice.number}`,
    ].filter(Boolean).join(" | ");
}

/**
 * Build a comment for marketplace orders (from TrackerModel). Includes the
 * buyer's contact/address when the tracker carries them (Digikala/marketplaces
 * provide these), falling back gracefully when a field is absent.
 */
function buildMarketplaceComment(tracker: {
    serviceId?: string;
    vendorId?: string;
    orderId?: string;
    amount?: number;
    createdAt?: Date;
    customerName?: string;
    customerPhone?: string;
    customerPostalCode?: string;
    customerAddress?: string;
    customerCity?: string;
    customerState?: string;
}): string {
    const channel = SERVICE_TO_CHANNEL[String(tracker.serviceId || "")] || "site";
    const channelDisplay = `${CHANNEL_LABELS[channel]} ${tracker.vendorId ?? ""}`.trim();
    const addr = [tracker.customerState, tracker.customerCity, tracker.customerAddress]
        .filter(Boolean)
        .join("، ");
    const createdAt = tracker.createdAt instanceof Date ? tracker.createdAt : new Date();

    return [
        `خرید از ${channelDisplay}`,
        tracker.customerName && `خریدار: ${tracker.customerName}`,
        tracker.customerPhone && `تلفن: ${tracker.customerPhone}`,
        addr && `آدرس: ${addr}`,
        tracker.customerPostalCode && `کدپستی: ${tracker.customerPostalCode}`,
        `شناسه سفارش: ${tracker.orderId ?? ""}`,
        `مبلغ: ${(tracker.amount || 0).toLocaleString()} ریال`,
        `تاریخ: ${faDateTime(createdAt)}`,
    ].filter(Boolean).join(" | ");
}

// ─────────────────────────────────────────────────────────────
// Customer resolution
// ─────────────────────────────────────────────────────────────

/** servicesService key holding `{ "<channel>:<vendor>": customerErpCode }`. */
export const VENDOR_CUSTOMER_MAP_KEY = "config:vendor_customer_map";

/** Build the map key for a channel + optional vendor panel. */
export function vendorCustomerKey(channel: SalesChannel, vendorLabel?: string): string {
    return `${channel}:${normalizeFa(vendorLabel || "")}`;
}

/** Read the admin-defined channel/vendor → Holoo customer ErpCode map. */
export async function getVendorCustomerMap(): Promise<Record<string, string>> {
    const cfg = await getServiceInfo<Record<string, string>>(
        "holoo", VENDOR_CUSTOMER_MAP_KEY, HOLOO_CONNECTION_ID,
    );
    return cfg && typeof cfg === "object" ? cfg : {};
}

/** Persist the full map. */
export async function setVendorCustomerMap(map: Record<string, string>): Promise<void> {
    await setServiceInfo("holoo", VENDOR_CUSTOMER_MAP_KEY, HOLOO_CONNECTION_ID, map);
}

/** The explicitly-linked customer ErpCode for this channel+vendor, if any. */
async function getVendorCustomerErpCode(
    channel: SalesChannel,
    vendorLabel?: string,
): Promise<string | null> {
    const map = await getVendorCustomerMap();
    return map[vendorCustomerKey(channel, vendorLabel)] || null;
}

/**
 * Resolve (and cache) the Holoo account for a sales channel + vendor panel.
 * An admin-defined override (see VENDOR_CUSTOMER_MAP_KEY) wins; otherwise falls
 * back to a name-based account (e.g. "مشتری دیجیکالا قلب دوم شاپ"), created if absent.
 */
async function resolveChannelCustomerErpCode(
    channel: SalesChannel,
    vendorLabel?: string,
): Promise<string> {
    const base = CHANNEL_CUSTOMER_NAMES[channel];
    const name = vendorLabel?.trim() ? `${base} ${vendorLabel.trim()}` : base;
    const target = normalizeFa(name);

    // Admin override: if this channel+vendor is explicitly linked to a Holoo
    // customer, route invoices there. Takes priority over the name-based auto
    // account so the admin can point a panel at a specific طرف‌حساب.
    const override = await getVendorCustomerErpCode(channel, vendorLabel);
    if (override) return override;

    const cacheKey = `customer:channel:${channel}:${normalizeFa(vendorLabel || "")}`;
    const cached = await getServiceInfo<{ erpcode: string }>("holoo", cacheKey, HOLOO_CONNECTION_ID);
    if (cached?.erpcode) return cached.erpcode;

    const all = await listHolooCustomers({});
    const match =
        all.find((c) => normalizeFa(String(c.Name || "")) === target) ||
        all.find((c) => normalizeFa(String(c.Name || "")).includes(target));
    let erpcode = match?.ErpCode;

    if (!erpcode) {
        const created = await createHolooCustomer({
            name,
            ispurchaser: true,
            isseller: false,
            custtype: 0,
        });
        erpcode = created.ErpCode;
    }

    await setServiceInfo("holoo", cacheKey, HOLOO_CONNECTION_ID, { erpcode });
    return erpcode;
}

// ─────────────────────────────────────────────────────────────
// Product resolution
// ─────────────────────────────────────────────────────────────

/**
 * Look up a variant's barcode (= its full accounting code) by SKU.
 * Invoice/tracker lines only carry the SKU, so we resolve the barcode here.
 */
async function barcodeForSku(sku: string): Promise<string | null> {
    const doc = await ProductModel.findOne(
        { "variants.sku": sku },
        { "variants.sku": 1, "variants.barcode": 1 },
    ).lean();
    const variants = (doc as { variants?: Array<{ sku?: string; barcode?: string }> } | null)?.variants ?? [];
    const v = variants.find((x) => x.sku === sku);
    const barcode = String(v?.barcode ?? "").trim();
    return barcode || null;
}

/**
 * Resolve (and cache) a Holoo product ErpCode.
 *
 * The product's barcode is its accounting code ("<prefix>-<seq>"); Holoo's
 * product `Code` must equal that barcode, and the product must live under the
 * SideGroup the admin linked to that prefix. We never invent a code or pick a
 * fallback group: if the barcode is missing or its prefix is unmapped, we skip.
 *
 * Returns `{ erpcode }` on success, or `{ skip }` describing why we bailed.
 */
async function resolveProductErpCode(
    sku: string,
    opts?: { name?: string; price?: number },
): Promise<{ erpcode: string } | { skip: "no_barcode" | "unmapped_prefix" }> {
    // Accounting code = the site variant's barcode.
    const barcode = await barcodeForSku(sku);
    if (!barcode) return { skip: "no_barcode" };
    return resolveProductErpCodeByBarcode(barcode, opts);
}

/**
 * Map a marketplace order line to the SITE accounting barcode.
 *
 * Marketplace tracker items only carry the *platform's* product id
 * (`serviceVariantId`), e.g. Digikala's `dgkVariantId`. Holoo, however, is keyed
 * by the site's accounting barcode. Each platform keeps a variant→barcode map
 * (dgkvariants / bslvariants / snpvariants), so we look the barcode up there.
 */
async function barcodeForMarketplaceItem(
    serviceId: string,
    serviceVariantId: string,
    vendorId?: string,
): Promise<string | null> {
    const sv = String(serviceVariantId || "").trim();
    if (!sv) return null;
    const vendor = String(vendorId || "").trim();

    let barcode: string | null | undefined;
    if (serviceId === "dgk") {
        const n = Number(sv);
        if (!Number.isFinite(n)) return null;
        const doc = await DgkVariantModel.findOne(
            { dgkVariantId: n, ...(vendor ? { vendorId: vendor } : {}) },
            { barcode: 1 },
        ).lean();
        barcode = (doc as { barcode?: string } | null)?.barcode;
    } else if (serviceId === "basalaam") {
        const n = Number(sv);
        if (!Number.isFinite(n)) return null;
        const doc = await BslVariantModel.findOne(
            { bslVariantId: n, ...(vendor ? { vendorId: vendor } : {}) },
            { barcode: 1 },
        ).lean();
        barcode = (doc as { barcode?: string } | null)?.barcode;
    } else if (serviceId === "snapp") {
        // serviceVariantId is now the site barcode (= snapp sku); older trackers
        // may still hold the Snapp product id. Match either so both resolve.
        const doc = await SnapVariantModel.findOne(
            { $or: [{ barcode: sv }, { snpProductId: sv }], ...(vendor ? { vendorId: vendor } : {}) },
            { barcode: 1 },
        ).lean();
        barcode = (doc as { barcode?: string } | null)?.barcode;
    }

    const trimmed = String(barcode ?? "").trim();
    return trimmed || null;
}

/**
 * Resolve (and cache) a Holoo product ErpCode from a site accounting barcode.
 * Shared by site invoices (barcode via SKU) and marketplace orders (barcode via
 * the platform variant map) so both route to the SAME Holoo product.
 */
async function resolveProductErpCodeByBarcode(
    barcode: string,
    opts?: { name?: string; price?: number },
): Promise<{ erpcode: string } | { skip: "no_barcode" | "unmapped_prefix" }> {
    const code = String(barcode || "").trim();
    if (!code) return { skip: "no_barcode" };

    const key = `product:barcode:${code}`;
    const cached = await getServiceInfo<{ erpcode: string }>("holoo", key, HOLOO_CONNECTION_ID);
    if (cached?.erpcode) return { erpcode: cached.erpcode };

    // The SideGroup is whatever the admin linked this prefix to.
    const sg = await resolveSidegroupForBarcode(code);
    if (!sg) return { skip: "unmapped_prefix" };

    // Match an existing Holoo product by its accounting code (barcode).
    const matches = await listHolooProducts({ code });
    let erpcode = matches.find((p) => p.ErpCode)?.ErpCode;

    if (!erpcode && opts?.name) {
        const created = await createHolooProduct({
            name: opts.name.slice(0, 150),
            code,
            sidegrouperpcode: sg.erpcode,
            sellprice: opts.price && opts.price > 0 ? Math.round(opts.price) : undefined,
        });
        erpcode = created.ErpCode;
        logErrorLater({
            level: "info",
            category: "system",
            source: "holoo.sync-invoice",
            message: "holoo_product_created_with_accounting_code",
            metadata: { code, prefix: sg.prefix, sidegroup: sg.erpcode, erpcode },
        });
    }

    if (!erpcode) return { skip: "unmapped_prefix" };
    await setServiceInfo("holoo", key, HOLOO_CONNECTION_ID, { erpcode });
    return { erpcode };
}

// ─────────────────────────────────────────────────────────────
// Sync: Website Invoice → Holoo
// ─────────────────────────────────────────────────────────────

/**
 * Post a paid store invoice into Holoo as a sales invoice.
 * Best-effort and idempotent.
 */
export async function syncInvoiceToHoloo(
    invoiceId: string,
): Promise<SyncInvoiceResult> {
    if (!isHolooConfigured()) return { ok: false, skipped: "not_configured" };

    await connectMongoose();
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) return { ok: false, skipped: "not_found" };
    if (invoice.status !== "paid") return { ok: false, skipped: "not_paid" };

    const markerKey = `invoice:${invoice.number}`;
    const already = await getServiceInfo<SyncMarker>(
        "holoo", markerKey, HOLOO_CONNECTION_ID,
    );
    if (already?.erpcode) {
        return { ok: true, erpcode: already.erpcode };
    }
    if (already?.conflict) {
        return { ok: false, skipped: "conflict_unresolved" };
    }
    if (already?.skipped) {
        return { ok: false, skipped: already.reason || "skipped" };
    }

    let customererpcode = "";
    let totalSum = 0;
    try {
        // Website invoices always go to "مشتری سایت"
        const channel: SalesChannel = "site";
        customererpcode = await resolveChannelCustomerErpCode(channel);
        const note = buildComment(invoice, channel);

        const detailinfo: HolooInvoiceDetailInput[] = [];
        const missing: string[] = [];
        let goodsSum = 0;

        for (const line of invoice.lines) {
            const res = await resolveProductErpCode(line.sku, {
                name: line.variantSummary ? `${line.title} - ${line.variantSummary}` : line.title,
                price: line.unitPriceEffective,
            });
            if ("skip" in res) {
                missing.push(`${line.sku} (${res.skip})`);
                continue;
            }
            const few = line.qty ?? line.requestedQty ?? 1;
            // قیمت سایت تومان است؛ هلو ریال می‌خواهد → ضرب در ۱۰.
            const price = toRial(line.unitPriceEffective);
            goodsSum += price * few;
            detailinfo.push({
                id: String(line.variantId),
                ProductErpCode: res.erpcode,
                few,
                price,
                Comment: note,
            });
        }

        if (missing.length) {
            logErrorLater({
                level: "warning",
                category: "system",
                source: "holoo.sync-invoice",
                message: "holoo_missing_product_mapping",
                metadata: { invoice: invoice.number, missingSkus: missing },
            });
            // `no_barcode` means the line's product no longer exists in the
            // catalog (deleted) → this invoice can NEVER sync. Persist a skip
            // marker so the bulk/sweep queue advances instead of retrying the
            // same old invoices forever ("0 of 25"). `unmapped_prefix` is
            // fixable (map the prefix), so we keep retrying those.
            const allDeleted = missing.every((m) => m.includes("(no_barcode)"));
            if (allDeleted) {
                await setServiceInfo("holoo", markerKey, HOLOO_CONNECTION_ID, {
                    skipped: true,
                    reason: "deleted_products",
                    missingSkus: missing,
                    syncedAt: Date.now(),
                } as SyncMarker);
                return { ok: false, skipped: "deleted_products", detail: missing };
            }
            return { ok: false, skipped: "missing_products", detail: missing };
        }

        // Optional: shipping line
        const shippingErp = process.env.HOLOO_SHIPPING_PRODUCT_ERPCODE?.trim();
        const shippingTotal = toRial(invoice.shippingTotal || 0); // تومان → ریال
        totalSum = goodsSum;
        if (shippingErp && shippingTotal > 0) {
            detailinfo.push({
                id: "shipping",
                ProductErpCode: shippingErp,
                few: 1,
                price: shippingTotal,
            });
            totalSum += shippingTotal;
        }

        const discount = toRial(invoice.discountTotal || 0); // تومان → ریال
        const createdAt =
            invoice.createdAt instanceof Date ? invoice.createdAt : new Date();

        logErrorLater({
            level: "info",
            category: "system",
            source: "holoo.sync-invoice",
            message: "holoo_site_invoice_amounts_rial",
            metadata: { invoice: invoice.number, goodsSum, shippingTotal, discount, totalSum },
        });

        const success = await createHolooInvoice({
            id: invoice.number,
            Type: SALE_INVOICE_TYPE,
            customererpcode,
            date: holooDate(createdAt),
            time: holooTime(createdAt),
            Nesiyeh: Math.max(0, totalSum - discount),
            Discount: discount,
            detailinfo,
        });

        await setServiceInfo("holoo", markerKey, HOLOO_CONNECTION_ID, {
            erpcode: success.ErpCode,
            number: success.ReturnParam1,
            syncedAt: Date.now(),
        });

        return {
            ok: true,
            erpcode: success.ErpCode,
            number: success.ReturnParam1,
        };
    } catch (error) {
        if (isConflict(error)) {
            const m = await reconcileConflict(markerKey, {
                customererpcode,
                date: holooDate(invoice.createdAt instanceof Date ? invoice.createdAt : new Date()),
                type: SALE_INVOICE_TYPE,
                total: totalSum,
            });
            if (m.erpcode) return { ok: true, erpcode: m.erpcode, number: m.number };
        }
        logErrorLater({
            category: "system",
            source: "holoo.sync-invoice",
            error,
            message: "holoo_invoice_sync_failed",
            metadata: {
                invoice: invoice.number,
                status: (error as any)?.status,
                code: (error as any)?.holooCode,
                data: (error as any)?.data,
            },
        });
        return {
            ok: false,
            skipped: isConflict(error) ? "conflict_unresolved" : "error",
            detail: {
                message: (error as any)?.message,
                holooCode: (error as any)?.holooCode,
                status: (error as any)?.status,
            },
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Resync: correct an already-posted site invoice (برگشت + فاکتور جدید)
// ─────────────────────────────────────────────────────────────

/** Shape persisted in the site invoice dedup marker, extended for resyncs. */
type ResyncMarker = SyncMarker & {
    /** How many times this invoice has been corrected (re-posted). */
    resyncGen?: number;
    /** ErpCode of the previous sale document we reversed. */
    supersededErpcode?: string;
};

/**
 * Build the Holoo sale lines (in ریال) for a site invoice. Shared by the sale
 * sync and the resync so both stay in lockstep on pricing (toman→rial).
 * Returns `{ skip }` when a line's product can't be mapped.
 */
async function buildSiteInvoiceLines(
    invoice: InvoiceDocument,
    note: string,
): Promise<
    | { detailinfo: HolooInvoiceDetailInput[]; goodsSum: number; shippingTotal: number; discount: number; totalSum: number }
    | { skip: string[] }
> {
    const detailinfo: HolooInvoiceDetailInput[] = [];
    const missing: string[] = [];
    let goodsSum = 0;

    for (const line of invoice.lines) {
        const res = await resolveProductErpCode(line.sku, {
            name: line.variantSummary ? `${line.title} - ${line.variantSummary}` : line.title,
            price: line.unitPriceEffective,
        });
        if ("skip" in res) {
            missing.push(`${line.sku} (${res.skip})`);
            continue;
        }
        const few = line.qty ?? line.requestedQty ?? 1;
        const price = toRial(line.unitPriceEffective); // تومان → ریال
        goodsSum += price * few;
        detailinfo.push({
            id: String(line.variantId),
            ProductErpCode: res.erpcode,
            few,
            price,
            Comment: note,
        });
    }

    if (missing.length) return { skip: missing };

    const shippingErp = process.env.HOLOO_SHIPPING_PRODUCT_ERPCODE?.trim();
    const shippingTotal = toRial(invoice.shippingTotal || 0); // تومان → ریال
    let totalSum = goodsSum;
    if (shippingErp && shippingTotal > 0) {
        detailinfo.push({ id: "shipping", ProductErpCode: shippingErp, few: 1, price: shippingTotal });
        totalSum += shippingTotal;
    }

    const discount = toRial(invoice.discountTotal || 0); // تومان → ریال
    return { detailinfo, goodsSum, shippingTotal, discount, totalSum };
}

/**
 * Correct a site invoice that was already posted to Holoo.
 *
 * Holoo accounting documents are append-only: you cannot edit a posted invoice.
 * To correct one without double-counting we (1) post a return-from-sale (Type=2)
 * that reverses the original sale document, then (2) post a fresh sale invoice
 * with the invoice's current amounts under a new id (`<number>-r<gen>`).
 *
 * Safe to call when the invoice was never synced — it just posts the sale via
 * the normal path. Idempotency for the *new* document is provided by Holoo's id.
 */
export async function resyncInvoiceToHoloo(
    invoiceId: string,
): Promise<SyncInvoiceResult> {
    if (!isHolooConfigured()) return { ok: false, skipped: "not_configured" };

    await connectMongoose();
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) return { ok: false, skipped: "not_found" };
    if (invoice.status !== "paid") return { ok: false, skipped: "not_paid" };

    const markerKey = `invoice:${invoice.number}`;
    const marker = await getServiceInfo<ResyncMarker>("holoo", markerKey, HOLOO_CONNECTION_ID);

    // Never synced (and not a stuck conflict) → a plain sale post is correct.
    if (!marker?.erpcode && !marker?.conflict) {
        return syncInvoiceToHoloo(invoiceId);
    }

    const channel: SalesChannel = "site";
    const createdAt = invoice.createdAt instanceof Date ? invoice.createdAt : new Date();
    const customererpcode = await resolveChannelCustomerErpCode(channel);
    const gen = (marker.resyncGen ?? 0) + 1;

    try {
        // 1) Reverse the previously-posted sale document (if any) with a return.
        if (marker.erpcode) {
            const built = await buildSiteInvoiceLines(
                invoice,
                `ابطال فاکتور قبلی جهت اصلاح - سفارش ${invoice.number}`,
            );
            if ("skip" in built) return { ok: false, skipped: "missing_products", detail: built.skip };

            await createHolooInvoice({
                id: `${invoice.number}-rev${gen}`.slice(0, 50),
                Type: RETURN_INVOICE_TYPE,
                customererpcode,
                date: holooDate(createdAt),
                time: holooTime(createdAt),
                Nesiyeh: Math.max(0, built.totalSum - built.discount),
                Discount: built.discount,
                detailinfo: built.detailinfo,
            });
        }

        // 2) Post a fresh sale with the invoice's *current* amounts, new id.
        const built = await buildSiteInvoiceLines(invoice, buildComment(invoice, channel));
        if ("skip" in built) return { ok: false, skipped: "missing_products", detail: built.skip };

        const success = await createHolooInvoice({
            id: `${invoice.number}-r${gen}`.slice(0, 50),
            Type: SALE_INVOICE_TYPE,
            customererpcode,
            date: holooDate(createdAt),
            time: holooTime(createdAt),
            Nesiyeh: Math.max(0, built.totalSum - built.discount),
            Discount: built.discount,
            detailinfo: built.detailinfo,
        });

        const next: ResyncMarker = {
            erpcode: success.ErpCode,
            number: success.ReturnParam1,
            resyncGen: gen,
            supersededErpcode: marker.erpcode,
            syncedAt: Date.now(),
        };
        await setServiceInfo("holoo", markerKey, HOLOO_CONNECTION_ID, next);

        logErrorLater({
            level: "info",
            category: "system",
            source: "holoo.resync-invoice",
            message: "holoo_invoice_resynced",
            metadata: {
                invoice: invoice.number,
                gen,
                reversedErpcode: marker.erpcode,
                newErpcode: success.ErpCode,
                totalRial: built.totalSum,
            },
        });

        return { ok: true, erpcode: success.ErpCode, number: success.ReturnParam1 };
    } catch (error) {
        logErrorLater({
            category: "system",
            source: "holoo.resync-invoice",
            error,
            message: "holoo_invoice_resync_failed",
            metadata: { invoice: invoice.number, gen, status: (error as any)?.status, data: (error as any)?.data },
        });
        return {
            ok: false,
            skipped: "error",
            detail: { message: (error as any)?.message, holooCode: (error as any)?.holooCode },
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Sync: Return / Refund (برگشت از فروش)
// ─────────────────────────────────────────────────────────────

/**
 * When an invoice is canceled or refunded, send a return-from-sale invoice
 * (Type=2) to Holoo to reverse the original transaction.
 */
export async function syncReturnToHoloo(
    invoiceId: string,
): Promise<SyncInvoiceResult> {
    if (!isHolooConfigured()) return { ok: false, skipped: "not_configured" };

    await connectMongoose();
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) return { ok: false, skipped: "not_found" };

    // Only process canceled or refunded invoices
    if (invoice.status !== "canceled" && invoice.status !== "refunded") {
        return { ok: false, skipped: "not_canceled_or_refunded" };
    }

    // A return-from-sale must reverse a sale that was actually posted to Holoo.
    // If the original sale never synced (canceled before sync, or it failed),
    // there is nothing to reverse — posting a return would create a phantom
    // negative document. Require the sale marker (invoice:<number>) first.
    const saleMarker = await getServiceInfo<SyncMarker>(
        "holoo", `invoice:${invoice.number}`, HOLOO_CONNECTION_ID,
    );
    if (!saleMarker?.erpcode) {
        return { ok: false, skipped: "no_prior_sale" };
    }

    const markerKey = `return:${invoice.number}`;
    const already = await getServiceInfo<SyncMarker>(
        "holoo", markerKey, HOLOO_CONNECTION_ID,
    );
    if (already?.erpcode) {
        return { ok: true, erpcode: already.erpcode };
    }
    if (already?.conflict) {
        return { ok: false, skipped: "conflict_unresolved" };
    }

    let customererpcode = "";
    let goodsSum = 0;
    try {
        // Same channel as the original invoice would be
        const channel: SalesChannel = "site";
        customererpcode = await resolveChannelCustomerErpCode(channel);

        const detailinfo: HolooInvoiceDetailInput[] = [];
        const missing: string[] = [];

        for (const line of invoice.lines) {
            const res = await resolveProductErpCode(line.sku, {
                name: line.variantSummary ? `${line.title} - ${line.variantSummary}` : line.title,
                price: line.unitPriceEffective,
            });
            if ("skip" in res) {
                missing.push(`${line.sku} (${res.skip})`);
                continue;
            }
            const few = line.qty ?? line.requestedQty ?? 1;
            // قیمت سایت تومان است؛ هلو ریال می‌خواهد → ضرب در ۱۰.
            const price = toRial(line.unitPriceEffective);
            goodsSum += price * few;
            detailinfo.push({
                id: String(line.variantId),
                ProductErpCode: res.erpcode,
                few,           // Positive = return quantity
                price,
                Comment: `برگشت از فروش - سفارش ${invoice.number} - ${faDateTime(
                    invoice.createdAt instanceof Date ? invoice.createdAt : new Date(),
                )}`,
            });
        }

        if (missing.length) {
            return { ok: false, skipped: "missing_products", detail: missing };
        }

        const createdAt =
            invoice.createdAt instanceof Date ? invoice.createdAt : new Date();

        // برگشت از فروش: Type=2, مبالغ مثبت
        const success = await createHolooInvoice({
            id: `RET-${invoice.number}`,
            Type: RETURN_INVOICE_TYPE,
            customererpcode,
            date: holooDate(createdAt),
            time: holooTime(createdAt),
            Nesiyeh: Math.max(0, goodsSum),
            Discount: 0,
            detailinfo,
        });

        await setServiceInfo("holoo", markerKey, HOLOO_CONNECTION_ID, {
            erpcode: success.ErpCode,
            number: success.ReturnParam1,
            syncedAt: Date.now(),
        });

        return {
            ok: true,
            erpcode: success.ErpCode,
            number: success.ReturnParam1,
        };
    } catch (error) {
        if (isConflict(error)) {
            const m = await reconcileConflict(markerKey, {
                customererpcode,
                date: holooDate(invoice.createdAt instanceof Date ? invoice.createdAt : new Date()),
                type: RETURN_INVOICE_TYPE,
                total: goodsSum,
            });
            if (m.erpcode) return { ok: true, erpcode: m.erpcode, number: m.number };
        }
        logErrorLater({
            category: "system",
            source: "holoo.sync-return",
            error,
            message: "holoo_return_sync_failed",
            metadata: { invoice: invoice.number, status: (error as any)?.status, data: (error as any)?.data },
        });
        return {
            ok: false,
            skipped: isConflict(error) ? "conflict_unresolved" : "error",
            detail: (error as any)?.message,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Sync: Marketplace Tracker → Holoo
// ─────────────────────────────────────────────────────────────

/**
 * Sync a marketplace order (from TrackerModel) to Holoo as a sales invoice.
 * Each marketplace+panel combination maps to its own customer account.
 *
 * @example
 *   Tracker { serviceId: "dgk", vendorId: "قلب دوم شاپ" }
 *   → Holoo customer "مشتری دیجیکالا قلب دوم شاپ"
 *   → Sales invoice in Holoo
 */
export async function syncTrackerToHoloo(
    trackerId: string,
): Promise<SyncInvoiceResult> {
    if (!isHolooConfigured()) return { ok: false, skipped: "not_configured" };

    await connectMongoose();
    const tracker = await TrackerModel.findById(trackerId);
    if (!tracker) return { ok: false, skipped: "not_found" };

    const serviceId = String(tracker.serviceId || "");
    const channel = SERVICE_TO_CHANNEL[serviceId];
    if (!channel || channel === "site") {
        return { ok: false, skipped: "unsupported_service", detail: serviceId };
    }

    const vendorId = String(tracker.vendorId || "").trim();
    const orderId = String(tracker.orderId || tracker._id || "");

    const markerKey = `tracker:${serviceId}:${orderId}`;
    const already = await getServiceInfo<SyncMarker>(
        "holoo", markerKey, HOLOO_CONNECTION_ID,
    );
    if (already?.erpcode) {
        return { ok: true, erpcode: already.erpcode };
    }
    if (already?.conflict) {
        return { ok: false, skipped: "conflict_unresolved" };
    }

    let customererpcode = "";
    let goodsSum = 0;
    try {
        // Resolve customer: "مشتری دیجیکالا قلب دوم شاپ"
        customererpcode = await resolveChannelCustomerErpCode(channel, vendorId);

        const items = Array.isArray(tracker.items) ? tracker.items : [];
        const detailinfo: HolooInvoiceDetailInput[] = [];
        const missing: string[] = [];

        for (const item of items) {
            const serviceVariantId = String(item.serviceVariantId || "").trim();
            if (!serviceVariantId) continue;

            // Marketplace lines carry the PLATFORM's product id; map it to the
            // SITE accounting barcode (the basis Holoo expects) before resolving.
            const barcode = await barcodeForMarketplaceItem(serviceId, serviceVariantId, vendorId);
            if (!barcode) {
                missing.push(`${serviceVariantId} (no_barcode_mapping)`);
                continue;
            }

            const res = await resolveProductErpCodeByBarcode(barcode, {
                name: String(item.title || "کالا"),
            });

            if ("skip" in res) {
                missing.push(`${serviceVariantId}→${barcode} (${res.skip})`);
                continue;
            }

            const qty = Number(item.quantity) || 1;
            // Estimate unit price from total amount
            const unitPrice = Math.round((tracker.amount || 0) / Math.max(items.length, 1) / qty);
            const price = Math.max(unitPrice, 1);
            goodsSum += price * qty;

            detailinfo.push({
                id: barcode,
                ProductErpCode: res.erpcode,
                few: qty,
                price,
                Comment: buildMarketplaceComment({
                    serviceId,
                    vendorId,
                    orderId,
                    amount: tracker.amount || 0,
                    createdAt: (tracker as { createdAt?: Date }).createdAt instanceof Date ? (tracker as { createdAt?: Date }).createdAt! : new Date(),
                    customerName: tracker.customerName,
                    customerPhone: tracker.customerPhone,
                    customerPostalCode: tracker.customerPostalCode,
                    customerAddress: tracker.customerAddress,
                    customerCity: tracker.customerCity,
                    customerState: tracker.customerState,
                }),
            });
        }

        if (missing.length) {
            // Log so failed transfers (e.g. Snapp lines whose barcode can't be
            // mapped) are traceable by order number instead of failing silently.
            logErrorLater({
                category: "sync",
                source: "holoo.sync-tracker",
                message: "holoo_tracker_missing_products",
                metadata: { serviceId, orderId, vendorId, missing },
            });
            return { ok: false, skipped: "missing_products", detail: missing };
        }

        if (detailinfo.length === 0) {
            logErrorLater({
                category: "sync",
                source: "holoo.sync-tracker",
                message: "holoo_tracker_no_valid_items",
                metadata: { serviceId, orderId, vendorId },
            });
            return { ok: false, skipped: "no_valid_items" };
        }

        const createdAt =
            (tracker as { createdAt?: Date }).createdAt instanceof Date ? (tracker as { createdAt?: Date }).createdAt! : new Date();
        const discount = Math.round(Number(tracker.discount) || 0);

        const success = await createHolooInvoice({
            id: `${serviceId}-${orderId}`.slice(0, 50),
            Type: SALE_INVOICE_TYPE,
            customererpcode,
            date: holooDate(createdAt),
            time: holooTime(createdAt),
            Nesiyeh: Math.max(0, goodsSum - discount),
            Discount: discount,
            detailinfo,
        });

        await setServiceInfo("holoo", markerKey, HOLOO_CONNECTION_ID, {
            erpcode: success.ErpCode,
            number: success.ReturnParam1,
            syncedAt: Date.now(),
        });

        return {
            ok: true,
            erpcode: success.ErpCode,
            number: success.ReturnParam1,
        };
    } catch (error) {
        if (isConflict(error)) {
            const m = await reconcileConflict(markerKey, {
                customererpcode,
                date: holooDate(
                    (tracker as { createdAt?: Date }).createdAt instanceof Date
                        ? (tracker as { createdAt?: Date }).createdAt!
                        : new Date(),
                ),
                type: SALE_INVOICE_TYPE,
                total: goodsSum,
            });
            if (m.erpcode) return { ok: true, erpcode: m.erpcode, number: m.number };
        }
        logErrorLater({
            category: "system",
            source: "holoo.sync-tracker",
            error,
            message: "holoo_tracker_sync_failed",
            metadata: {
                serviceId,
                orderId,
                vendorId,
                status: (error as any)?.status,
                data: (error as any)?.data,
            },
        });
        return {
            ok: false,
            skipped: isConflict(error) ? "conflict_unresolved" : "error",
            detail: (error as any)?.message,
        };
    }
}

/** Tracker order statuses that mean the marketplace order was canceled/returned. */
const TRACKER_CANCELED_STATUSES = new Set(["canceled", "cancelled", "refunded", "returned"]);

/**
 * Post a return-from-sale (Type=2) for a CANCELED/REFUNDED marketplace order.
 *
 * Mirrors syncReturnToHoloo for the site: it only reverses a sale that actually
 * reached Holoo (the `tracker:<service>:<orderId>` sale marker must have an
 * erpcode), so we never create a phantom return with no original sale.
 */
export async function syncTrackerReturnToHoloo(
    trackerId: string,
): Promise<SyncInvoiceResult> {
    if (!isHolooConfigured()) return { ok: false, skipped: "not_configured" };

    await connectMongoose();
    const tracker = await TrackerModel.findById(trackerId);
    if (!tracker) return { ok: false, skipped: "not_found" };

    const serviceId = String(tracker.serviceId || "");
    const channel = SERVICE_TO_CHANNEL[serviceId];
    if (!channel || channel === "site") {
        return { ok: false, skipped: "unsupported_service", detail: serviceId };
    }

    const orderStatus = String((tracker as { orderStatus?: string }).orderStatus || "").toLowerCase();
    if (!TRACKER_CANCELED_STATUSES.has(orderStatus)) {
        return { ok: false, skipped: "not_canceled_or_refunded" };
    }

    const vendorId = String(tracker.vendorId || "").trim();
    const orderId = String(tracker.orderId || tracker._id || "");

    // Only reverse a sale that was actually posted to Holoo.
    const saleMarker = await getServiceInfo<SyncMarker>(
        "holoo", `tracker:${serviceId}:${orderId}`, HOLOO_CONNECTION_ID,
    );
    if (!saleMarker?.erpcode) {
        return { ok: false, skipped: "no_prior_sale" };
    }

    const markerKey = `tracker-return:${serviceId}:${orderId}`;
    const already = await getServiceInfo<SyncMarker>("holoo", markerKey, HOLOO_CONNECTION_ID);
    if (already?.erpcode) return { ok: true, erpcode: already.erpcode };
    if (already?.conflict) return { ok: false, skipped: "conflict_unresolved" };

    let customererpcode = "";
    let goodsSum = 0;
    try {
        customererpcode = await resolveChannelCustomerErpCode(channel, vendorId);
        const items = Array.isArray(tracker.items) ? tracker.items : [];
        const detailinfo: HolooInvoiceDetailInput[] = [];
        const missing: string[] = [];

        for (const item of items) {
            const serviceVariantId = String(item.serviceVariantId || "").trim();
            if (!serviceVariantId) continue;
            const barcode = await barcodeForMarketplaceItem(serviceId, serviceVariantId, vendorId);
            if (!barcode) { missing.push(`${serviceVariantId} (no_barcode_mapping)`); continue; }
            const res = await resolveProductErpCodeByBarcode(barcode, { name: String(item.title || "کالا") });
            if ("skip" in res) { missing.push(`${serviceVariantId}→${barcode} (${res.skip})`); continue; }

            const qty = Number(item.quantity) || 1;
            const unitPrice = Math.round((tracker.amount || 0) / Math.max(items.length, 1) / qty);
            const price = Math.max(unitPrice, 1);
            goodsSum += price * qty;
            detailinfo.push({
                id: barcode,
                ProductErpCode: res.erpcode,
                few: qty, // positive = return quantity
                price,
                Comment: `برگشت از فروش - ${CHANNEL_LABELS[channel]} ${vendorId} - سفارش ${orderId}`,
            });
        }

        if (missing.length) return { ok: false, skipped: "missing_products", detail: missing };
        if (detailinfo.length === 0) return { ok: false, skipped: "no_valid_items" };

        const createdAt =
            (tracker as { createdAt?: Date }).createdAt instanceof Date ? (tracker as { createdAt?: Date }).createdAt! : new Date();

        const success = await createHolooInvoice({
            id: `RET-${serviceId}-${orderId}`.slice(0, 50),
            Type: RETURN_INVOICE_TYPE,
            customererpcode,
            date: holooDate(createdAt),
            time: holooTime(createdAt),
            Nesiyeh: Math.max(0, goodsSum),
            Discount: 0,
            detailinfo,
        });

        await setServiceInfo("holoo", markerKey, HOLOO_CONNECTION_ID, {
            erpcode: success.ErpCode, number: success.ReturnParam1, syncedAt: Date.now(),
        });
        return { ok: true, erpcode: success.ErpCode, number: success.ReturnParam1 };
    } catch (error) {
        if (isConflict(error)) {
            const m = await reconcileConflict(markerKey, {
                customererpcode,
                date: holooDate((tracker as { createdAt?: Date }).createdAt instanceof Date ? (tracker as { createdAt?: Date }).createdAt! : new Date()),
                type: RETURN_INVOICE_TYPE,
                total: goodsSum,
            });
            if (m.erpcode) return { ok: true, erpcode: m.erpcode, number: m.number };
        }
        logErrorLater({
            category: "system",
            source: "holoo.sync-tracker-return",
            error,
            message: "holoo_tracker_return_sync_failed",
            metadata: { serviceId, orderId, vendorId, status: (error as any)?.status, data: (error as any)?.data },
        });
        return { ok: false, skipped: isConflict(error) ? "conflict_unresolved" : "error", detail: (error as any)?.message };
    }
}

// ─────────────────────────────────────────────────────────────
// Schedulers
// ─────────────────────────────────────────────────────────────

/**
 * Fire-and-forget trigger for when an invoice is marked as paid.
 * Returns immediately; sync runs after a short delay.
 */
export function scheduleHolooInvoiceSync(invoiceId: string): void {
    if (!isHolooAutoSyncEnabled()) return;
    setTimeout(() => {
        syncInvoiceToHoloo(invoiceId).catch((error) => {
            logErrorLater({
                category: "system",
                source: "holoo.sync-invoice",
                error,
                message: "holoo_invoice_sync_schedule_failed",
                metadata: { invoiceId },
            });
        });
    }, 8000);
}

/**
 * Fire-and-forget trigger for when an invoice is canceled or refunded.
 * Sends a return-from-sale invoice to Holoo.
 */
export function scheduleHolooReturnSync(invoiceId: string): void {
    if (!isHolooAutoSyncEnabled()) return;
    setTimeout(() => {
        syncReturnToHoloo(invoiceId).catch((error) => {
            logErrorLater({
                category: "system",
                source: "holoo.sync-return",
                error,
                message: "holoo_return_sync_schedule_failed",
                metadata: { invoiceId },
            });
        });
    }, 8000);
}

/**
 * Fire-and-forget trigger for syncing a marketplace tracker to Holoo.
 */
export function scheduleHolooTrackerSync(trackerId: string): void {
    if (!isHolooAutoSyncEnabled()) return;
    setTimeout(() => {
        syncTrackerToHoloo(trackerId).catch((error) => {
            logErrorLater({
                category: "system",
                source: "holoo.sync-tracker",
                error,
                message: "holoo_tracker_sync_schedule_failed",
                metadata: { trackerId },
            });
        });
    }, 8000);
}
