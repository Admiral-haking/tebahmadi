export const INVOICE_PROGRESS_STATES = ['in-progress', 'packaged-posted', 'order-finished'] as const;

export type InvoiceProgressState = (typeof INVOICE_PROGRESS_STATES)[number];

export type InvoiceProgressHistoryEntry = {
  state: InvoiceProgressState;
  changedAt: Date;
  trackingNumber?: string;
};

export type InvoiceProgressSnapshot = {
  current?: InvoiceProgressState;
  inProgressAt?: Date;
  packagedPostedAt?: Date;
  orderFinishedAt?: Date;
  history?: InvoiceProgressHistoryEntry[];
  packagedPostedTrackingNumber?: string;
};

export const ORDER_PROGRESS_FREEZE_MS = 30 * 24 * 60 * 60 * 1000;
