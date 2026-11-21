import { z } from 'zod';
import { zObjectIdString, zStringNonEmpty } from '@/lib/z';
import { INVOICE_PROGRESS_STATES } from '@/orders/constants/progress';

export const invoiceLineSchema = z
  .object({
    productId: zObjectIdString,
    variantId: zObjectIdString,
    qty: z.number().positive().optional(),
    requestedQty: z.number().positive().optional(),
    requestedUnit: zStringNonEmpty.optional(),
  })
  .superRefine((data, ctx) => {
    const hasQty = data.qty !== undefined;
    const hasRequested = data.requestedQty !== undefined;
    if (hasQty === hasRequested) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either qty or requestedQty, but not both',
        path: ['qty'],
      });
    }

    if (hasRequested && data.requestedQty && data.requestedQty <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'requestedQty must be > 0',
        path: ['requestedQty'],
      });
    }

    if (hasQty && data.qty && data.qty <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'qty must be > 0',
        path: ['qty'],
      });
    }
  });

export const addressSchema = z.object({
  fname: zStringNonEmpty,
  lname: zStringNonEmpty,
  phone: zStringNonEmpty,
  state: zStringNonEmpty,
  city: zStringNonEmpty,
  address: zStringNonEmpty,
  postalCode: z.string().trim().regex(/^\d{10}$/, 'postal_code_invalid'),
});

export const invoicePricingSchema = z.object({
  userId: zObjectIdString,
  lines: z.array(invoiceLineSchema).min(1),
  transportId: zObjectIdString,
  address: addressSchema,
  offerCode: zStringNonEmpty.optional(),
  now: z.coerce.date().optional(),
  shippingPaymentMethod: z.enum(['online', 'on_delivery']).default('online'),
  torobClid: z.string().trim().optional(),
});

export const invoiceStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'paid', 'canceled', 'refunded']),
});

export const invoiceProgressUpdateSchema = z.object({
  progress: z.enum(INVOICE_PROGRESS_STATES),
});

export const invoicePatchUpdateSchema = z
  .object({
    status: invoiceStatusUpdateSchema.shape.status.optional(),
    progress: invoiceProgressUpdateSchema.shape.progress.optional(),
    trackingCode: z.string().trim().min(1, 'tracking_code_required').optional(),
  })
  .refine((data) => data.status || data.progress, {
    message: 'status_or_progress_required',
    path: ['status'],
  })
  .refine(
    (data) => {
      if (data.progress === 'packaged-posted') {
        return typeof data.trackingCode === 'string' && data.trackingCode.trim().length > 0;
      }
      return true;
    },
    {
      message: 'tracking_code_required',
      path: ['trackingCode'],
    },
  );
