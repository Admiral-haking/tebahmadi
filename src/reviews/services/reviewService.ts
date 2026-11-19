import { customAlphabet, nanoid } from 'nanoid';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { sendReviewRequestSms } from '@/lib/sms';
import { resolveSiteBaseUrl, toAbsoluteUrl } from '@/seo/utils/url';
import type { InvoiceDocument } from '@/orders/models/Invoice';
import { InvoiceModel } from '@/orders/models/Invoice';
import { ProductReviewModel, type ProductReviewDocument } from '@/reviews/models/ProductReview';
import { ReviewRequestModel, type ReviewRequestDocument } from '@/reviews/models/ReviewRequest';

const REVIEW_CODE_GENERATOR = customAlphabet('0123456789', 6);
const REVIEW_CODE_TTL_MS = 10 * 24 * 60 * 60 * 1000;

export type ReviewableLine = {
  lineKey: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantId?: string;
  variantSummary?: string;
  sku?: string;
  quantity?: number;
};

export type ReviewVerificationPayload = {
  invoiceNumber: string;
  customerName?: string;
  expiresAt?: string;
  lines: Array<ReviewableLine & { alreadyReviewed: boolean }>;
};

export type ReviewSubmitInput = {
  lineKey: string;
  rating: number;
  comment?: string;
};

function toStringId(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  return String(value);
}

export function buildLineKey(line: InvoiceDocument['lines'][number]): string {
  const productId = toStringId(line.productId);
  const variantId = toStringId(line.variantId);
  const sku = typeof line.sku === 'string' ? line.sku.trim() : '';
  return [productId, variantId, sku].filter((part) => part.length > 0).join('#');
}

function buildReviewLink(token: string): string {
  const base = resolveSiteBaseUrl();
  const path = `/review/${token}`;
  return toAbsoluteUrl(path, base);
}

function buildCustomerName(invoice: InvoiceDocument): string | undefined {
  const parts = [invoice.addressSnapshot?.fname, invoice.addressSnapshot?.lname]
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item!.trim());
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function mapInvoiceLines(invoice: InvoiceDocument): ReviewableLine[] {
  const seen = new Set<string>();
  const lines: ReviewableLine[] = [];
  (invoice.lines ?? []).forEach((line) => {
    if (!line) return;
    const lineKey = buildLineKey(line);
    if (!lineKey || seen.has(lineKey)) {
      return;
    }
    seen.add(lineKey);
    lines.push({
      lineKey,
      productId: toStringId(line.productId),
      productSlug: line.productSlug,
      productTitle: line.title,
      variantId: toStringId(line.variantId) || undefined,
      variantSummary: line.variantSummary ?? undefined,
      sku: line.sku ?? undefined,
      quantity: line.qty ?? line.requestedQty ?? undefined,
    });
  });
  return lines;
}

async function loadExistingReviews(invoiceId: Types.ObjectId): Promise<Map<string, ProductReviewDocument>> {
  const reviews = await ProductReviewModel.find({ invoiceId }).lean();
  const map = new Map<string, ProductReviewDocument>();
  reviews.forEach((review) => {
    if (review?.lineKey) {
      map.set(review.lineKey, review);
    }
  });
  return map;
}

type ReviewFailureReason =
  | 'not_found'
  | 'expired'
  | 'already_submitted'
  | 'invoice_missing';

type ReviewContext =
  | { ok: true; request: ReviewRequestDocument; invoice: InvoiceDocument; lines: ReviewableLine[]; existing: Map<string, ProductReviewDocument> }
  | { ok: false; reason: ReviewFailureReason };

async function resolveReviewContext(token: string): Promise<ReviewContext> {
  await connectMongoose();
  const request = await ReviewRequestModel.findOne({ token }).exec();
  if (!request) {
    return { ok: false, reason: 'not_found' };
  }

  const now = new Date();
  if (request.expiresAt && now.getTime() > new Date(request.expiresAt).getTime()) {
    if (request.status !== 'expired') {
      request.status = 'expired';
      await request.save();
    }
    return { ok: false, reason: 'expired' };
  }

  if (request.status === 'completed') {
    return { ok: false, reason: 'already_submitted' };
  }

  const invoice = await InvoiceModel.findById(request.invoiceId).exec();
  if (!invoice) {
    return { ok: false, reason: 'invoice_missing' };
  }

  const lines = mapInvoiceLines(invoice);
  const existing = await loadExistingReviews(request.invoiceId as Types.ObjectId);

  request.attempts = 0;
  request.lastVerifiedAt = now;
  await request.save();

  return { ok: true, request, invoice, lines, existing };
}

export async function verifyReviewRequest(
  token: string,
): Promise<{ ok: true; data: ReviewVerificationPayload } | { ok: false; reason: ReviewFailureReason }> {
  const context = await resolveReviewContext(token);
  if (!context.ok) {
    return { ok: false, reason: context.reason };
  }

  const { invoice, lines, request, existing } = context;
  const payload: ReviewVerificationPayload = {
    invoiceNumber: invoice.number,
    customerName: buildCustomerName(invoice),
    expiresAt: request.expiresAt ? new Date(request.expiresAt).toISOString() : undefined,
    lines: lines.map((line) => ({ ...line, alreadyReviewed: existing.has(line.lineKey) })),
  };

  return { ok: true, data: payload };
}

async function ensureInvitationAllowed(invoice: InvoiceDocument): Promise<boolean> {
  if (invoice.status !== 'paid') {
    return false;
  }
  if (invoice.progress?.current !== 'order-finished') {
    return false;
  }
  const hasReviews = await ProductReviewModel.exists({ invoiceId: invoice._id });
  if (hasReviews) {
    return false;
  }
  return true;
}

export async function createReviewInvitationForInvoice(invoice: InvoiceDocument): Promise<void> {
  const phone = invoice.addressSnapshot?.phone?.trim();
  if (!phone) {
    return;
  }
  await connectMongoose();

  if (!(await ensureInvitationAllowed(invoice))) {
    return;
  }

  const code = REVIEW_CODE_GENERATOR();
  const expiresAt = new Date(Date.now() + REVIEW_CODE_TTL_MS);

  let request = await ReviewRequestModel.findOne({ invoiceId: invoice._id }).exec();
  if (!request) {
    request = new ReviewRequestModel({
      invoiceId: invoice._id,
      userId: invoice.userId,
      phone,
      token: nanoid(24),
      orderNumber: invoice.number,
    });
  }

  request.phone = phone;
  request.codeHash = code;
  request.expiresAt = expiresAt;
  request.status = 'pending';
  request.attempts = 0;
  request.submittedAt = undefined;
  request.lastVerifiedAt = undefined;
  request.orderNumber = invoice.number;

  await request.save();

  const link = buildReviewLink(request.token);
  await sendReviewRequestSms(phone, {
    code,
    order: invoice.number,
    invoice: invoice.number,
    link,
    name: buildCustomerName(invoice),
  });
}

export async function submitProductReviews(
  token: string,
  inputs: ReviewSubmitInput[],
): Promise<{ ok: true; created: number; skipped: string[] } | { ok: false; reason: ReviewFailureReason }> {
  const context = await resolveReviewContext(token);
  if (!context.ok) {
    return { ok: false, reason: context.reason };
  }

  const { invoice, lines, request, existing } = context;
  const lineMap = new Map(lines.map((line) => [line.lineKey, line]));

  const now = new Date();
  const docs: any[] = [];
  const skipped: string[] = [];

  inputs.forEach((input) => {
    const key = input.lineKey.trim();
    const target = lineMap.get(key);
    if (!target) {
      skipped.push(key);
      return;
    }
    if (existing.has(key)) {
      skipped.push(key);
      return;
    }
    const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
    const comment = input.comment?.trim();
    docs.push({
      requestId: request._id,
      invoiceId: invoice._id,
      orderNumber: invoice.number,
      productId: new Types.ObjectId(target.productId),
      productSlug: target.productSlug,
      productTitle: target.productTitle,
      variantId: target.variantId ? new Types.ObjectId(target.variantId) : undefined,
      variantSummary: target.variantSummary,
      sku: target.sku,
      rating,
      comment,
      authorName: buildCustomerName(invoice),
      phone: invoice.addressSnapshot?.phone,
      status: 'pending',
      lineKey: key,
      createdAt: now,
      updatedAt: now,
    });
  });

  if (docs.length > 0) {
    await ProductReviewModel.insertMany(docs, { ordered: false });
    await ReviewRequestModel.updateOne({ _id: request._id }, { $set: { status: 'completed', submittedAt: now } })
  }

  return { ok: true, created: docs.length, skipped };
}
