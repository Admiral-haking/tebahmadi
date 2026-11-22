import { connectMongoose } from '@/lib/mongoose';
import { InvoiceModel } from '@/orders/models/Invoice';
import { updateInvoiceProgress } from '@/orders/services/invoiceService';
const notifyAdminInventoryAlertLater = (..._args: unknown[]) => undefined;
import { logErrorLater } from '@/observability/error-log';
import { getTapinOrderStatuses } from './orders';

const SYNC_INTERVAL_MS = 5 * 60_000;
const SYNC_BATCH_SIZE = 50;
const MAX_SYNC_BACKOFF_MS = 6 * 60 * 60_000;
const TERMINAL_STATUSES = new Set([7, 80, 102]);
const state = globalThis as typeof globalThis & {
  __tapinSyncLastRun?: number;
  __tapinSyncRunning?: boolean;
  __tapinSyncLastResult?: {
    checked: number;
    updated: number;
    failed: number;
    at: string;
    error?: string;
  };
};

export function getTapinSyncHealth() {
  return {
    enabled: isTapinSyncEnabled(),
    running: Boolean(state.__tapinSyncRunning),
    lastRunAt: state.__tapinSyncLastRun ? new Date(state.__tapinSyncLastRun).toISOString() : null,
    lastResult: state.__tapinSyncLastResult ?? null,
  };
}

export function isTapinSyncEnabled(): boolean {
  return Boolean(
    (process.env.TAPIN_WEBSERVICE_TOKEN?.trim() || process.env.TAPIN_TOKEN?.trim()) &&
    process.env.TAPIN_SHOP_ID?.trim() &&
    process.env.TAPIN_AUTO_SYNC !== '0',
  );
}

export function tapinSyncBackoffMs(failureCount = 0) {
  if (failureCount <= 0) return 0;
  return Math.min(SYNC_INTERVAL_MS * 2 ** Math.min(failureCount - 1, 8), MAX_SYNC_BACKOFF_MS);
}

export function isTapinSyncCandidateDue(
  shipment: { syncFailureCount?: number; syncLastErrorAt?: Date | string | null },
  now = Date.now(),
) {
  if (!shipment.syncLastErrorAt) return true;
  const failedAt = new Date(shipment.syncLastErrorAt).getTime();
  return (
    !Number.isFinite(failedAt) || now - failedAt >= tapinSyncBackoffMs(shipment.syncFailureCount)
  );
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export async function advanceTapinInvoiceProgress(
  invoiceId: string,
  tapinStatus: number,
  barcode?: string,
) {
  if (tapinStatus < 5 || tapinStatus === 80) return;
  const invoice = await InvoiceModel.findById(invoiceId).select('status progress').lean();
  if (!invoice || invoice.status !== 'paid') return;
  const current = invoice.progress?.current;
  if (!current) await updateInvoiceProgress(invoiceId, 'in-progress');
  if (
    tapinStatus >= 5 &&
    current !== 'packaged-posted' &&
    current !== 'order-finished' &&
    barcode
  ) {
    await updateInvoiceProgress(invoiceId, 'packaged-posted', { trackingCode: barcode });
  }
  if (tapinStatus === 7) {
    const fresh = await InvoiceModel.findById(invoiceId).select('progress.current').lean();
    if (fresh?.progress?.current === 'packaged-posted') {
      await updateInvoiceProgress(invoiceId, 'order-finished');
    }
  }
}

export async function runTapinStatusSync(options: { forceRetryFailures?: boolean } = {}): Promise<{
  checked: number;
  updated: number;
  failed: number;
}> {
  if (!isTapinSyncEnabled() || state.__tapinSyncRunning)
    return { checked: 0, updated: 0, failed: 0 };
  state.__tapinSyncRunning = true;
  let selectedIds: string[] = [];
  try {
    await connectMongoose();
    const invoices = await InvoiceModel.find({
      'tapinShipment.orderId': { $type: 'number' },
      'tapinShipment.status': { $nin: [...TERMINAL_STATUSES] },
    })
      .select('_id tapinShipment')
      .sort({ 'tapinShipment.syncedAt': 1 })
      .limit(500)
      .lean();
    const dueInvoices = invoices
      .filter(
        (invoice) =>
          options.forceRetryFailures || isTapinSyncCandidateDue(invoice.tapinShipment ?? {}),
      )
      .slice(0, 200);
    selectedIds = dueInvoices.map((invoice) => String(invoice._id));
    if (!dueInvoices.length) return { checked: 0, updated: 0, failed: 0 };

    let updated = 0;
    let failed = 0;
    for (const batch of chunks(dueInvoices, SYNC_BATCH_SIZE)) {
      let byOrderId = new Map<
        number,
        Awaited<ReturnType<typeof getTapinOrderStatuses>>['list'][number]
      >();
      try {
        const response = await getTapinOrderStatuses(
          batch.map((invoice) => invoice.tapinShipment!.orderId),
        );
        byOrderId = new Map((response.list ?? []).map((item) => [item.order_id, item]));
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 300) : 'خطای ناشناخته';
        failed += batch.length;
        await InvoiceModel.updateMany(
          { _id: { $in: batch.map((invoice) => invoice._id) } },
          {
            $inc: { 'tapinShipment.syncFailureCount': 1 },
            $set: {
              'tapinShipment.syncLastError': message,
              'tapinShipment.syncLastErrorAt': new Date(),
            },
          },
        );
        continue;
      }
      for (const invoice of batch) {
        const remote = byOrderId.get(invoice.tapinShipment!.orderId);
        if (!remote) {
          failed += 1;
          await InvoiceModel.updateOne(
            { _id: invoice._id },
            {
              $inc: { 'tapinShipment.syncFailureCount': 1 },
              $set: {
                'tapinShipment.syncLastError': 'وضعیت این مرسوله در پاسخ تاپین موجود نبود.',
                'tapinShipment.syncLastErrorAt': new Date(),
                'tapinShipment.syncedAt': new Date(),
              },
            },
          );
          continue;
        }
        const changed =
          remote.status !== invoice.tapinShipment!.status ||
          (remote.barcode && remote.barcode !== invoice.tapinShipment!.barcode);
        const changedAt = remote.last_change_status
          ? new Date(remote.last_change_status)
          : new Date();
        const update: Record<string, unknown> = {
          $set: {
            'tapinShipment.status': remote.status,
            'tapinShipment.barcode': remote.barcode || invoice.tapinShipment!.barcode,
            'tapinShipment.syncedAt': new Date(),
            'tapinShipment.syncFailureCount': 0,
          },
          $unset: { 'tapinShipment.syncLastError': 1, 'tapinShipment.syncLastErrorAt': 1 },
        };
        if (changed) {
          update.$push = {
            'tapinShipment.statusHistory': {
              status: remote.status,
              barcode: remote.barcode || invoice.tapinShipment!.barcode,
              changedAt: Number.isNaN(changedAt.getTime()) ? new Date() : changedAt,
              source: 'sync',
            },
          };
        }
        await InvoiceModel.updateOne({ _id: invoice._id }, update);
        if (changed) {
          updated += 1;
          await advanceTapinInvoiceProgress(String(invoice._id), remote.status, remote.barcode);
          if (remote.status === 102) {
            const key = invoice.tapinShipment?.orderId ?? invoice._id;
            notifyAdminInventoryAlertLater({
              title: 'مرسوله تاپین عودت داده شد — دریافت کالا لازم است',
              dedupeKey: `tapin-return-receive:${String(key)}`,
              payloadSummary: `tapin order ${String(key)} returned`,
              lines: [
                `شناسه سفارش تاپین: ${String(key)}`,
                `بارکد مرسوله: ${remote.barcode || invoice.tapinShipment?.barcode || 'ثبت نشده'}`,
                'وضعیت مرسوله عودت داده شده است؛ موجودی به‌صورت خودکار آزاد نشد.',
                'پس از دریافت فیزیکی کالا، آن را در انبار دریافت و تطبیق کنید.',
              ],
            });
          }
        }
      }
    }
    const result = { checked: dueInvoices.length, updated, failed };
    state.__tapinSyncLastResult = { ...result, at: new Date().toISOString() };
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : 'خطای ناشناخته';
    if (selectedIds.length) {
      await InvoiceModel.updateMany(
        { _id: { $in: selectedIds } },
        {
          $inc: { 'tapinShipment.syncFailureCount': 1 },
          $set: {
            'tapinShipment.syncLastError': message,
            'tapinShipment.syncLastErrorAt': new Date(),
          },
        },
      ).catch((persistError) => {
        const persistenceMessage =
          persistError instanceof Error ? persistError.message.slice(0, 300) : 'خطای ناشناخته';
        console.error('[tapin-sync] failed to persist sync failure state', {
          invoiceIds: selectedIds.slice(0, 50),
          error: persistenceMessage,
        });
        logErrorLater({
          level: 'error',
          category: 'sync',
          source: 'tapin.status-sync.persistence',
          message: 'tapin_sync_failure_state_persist_failed',
          error: persistError,
          metadata: { invoiceIds: selectedIds.slice(0, 50) },
        });
      });
    }
    state.__tapinSyncLastResult = {
      checked: 0,
      updated: 0,
      failed: 1,
      at: new Date().toISOString(),
      error: message,
    };
    throw error;
  } finally {
    state.__tapinSyncRunning = false;
  }
}

export async function runTapinStatusSyncIfDue() {
  if (!isTapinSyncEnabled()) return { checked: 0, updated: 0, failed: 0 };
  const now = Date.now();
  if (now - (state.__tapinSyncLastRun ?? 0) < SYNC_INTERVAL_MS) {
    return { checked: 0, updated: 0, failed: 0 };
  }
  state.__tapinSyncLastRun = now;
  return runTapinStatusSync();
}
