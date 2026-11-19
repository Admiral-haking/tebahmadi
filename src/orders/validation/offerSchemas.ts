import { z } from 'zod';
import { optionalArray, zCurrency, zDateOpt, zObjectIdString, zPositiveInt, zStringNonEmpty } from '@/lib/z';

const baseOfferSchema = z.object({
  code: zStringNonEmpty,
  type: z.enum(['percentage', 'absolute', 'transport']),
  amount: z.number().optional(),
  startsAt: zDateOpt,
  endsAt: zDateOpt,
  usageLimitTotal: zPositiveInt.optional(),
  usageLimitPerUser: zPositiveInt.optional(),
  minOrderSubtotal: zCurrency.optional(),
  allowedProductTypeIds: optionalArray(zObjectIdString),
  allowedCategoryIds: optionalArray(zObjectIdString),
  allowedUserIds: optionalArray(zObjectIdString),
  isActive: z.boolean().optional(),
});

type OfferShape = {
  code?: string;
  type?: 'percentage' | 'absolute' | 'transport';
  amount?: number;
  startsAt?: Date;
  endsAt?: Date;
  usageLimitTotal?: number;
  usageLimitPerUser?: number;
  minOrderSubtotal?: number;
};

function applyOfferRefinements<T extends z.ZodType<OfferShape>>(schema: T) {
  return schema.superRefine((data, ctx) => {
    if (data.startsAt && data.endsAt && data.startsAt > data.endsAt) {
      ctx.addIssue({
        path: ['endsAt'],
        code: z.ZodIssueCode.custom,
        message: 'endsAt must be after startsAt',
      });
    }

    if (data.type === 'transport') {
      if (data.amount !== undefined) {
        ctx.addIssue({
          path: ['amount'],
          code: z.ZodIssueCode.custom,
          message: 'Transport offers cannot define amount',
        });
      }
    } else if (data.type === 'percentage') {
      if (data.amount === undefined) {
        ctx.addIssue({
          path: ['amount'],
          code: z.ZodIssueCode.custom,
          message: 'Percentage offers require amount',
        });
      } else if (data.amount < 0 || data.amount > 100) {
        ctx.addIssue({
          path: ['amount'],
          code: z.ZodIssueCode.custom,
          message: 'Percentage amount must be between 0 and 100',
        });
      }
    } else if (data.type === 'absolute') {
      if (data.amount === undefined) {
        ctx.addIssue({
          path: ['amount'],
          code: z.ZodIssueCode.custom,
          message: 'Absolute offers require amount',
        });
      } else if (!Number.isInteger(data.amount) || data.amount < 0) {
        ctx.addIssue({
          path: ['amount'],
          code: z.ZodIssueCode.custom,
          message: 'Absolute amount must be a non-negative integer',
        });
      }
    }

    if (
      data.usageLimitTotal !== undefined &&
      data.usageLimitPerUser !== undefined &&
      data.usageLimitPerUser > data.usageLimitTotal
    ) {
      ctx.addIssue({
        path: ['usageLimitPerUser'],
        code: z.ZodIssueCode.custom,
        message: 'usageLimitPerUser cannot exceed usageLimitTotal',
      });
    }
  });
}

export const offerCreateSchema = applyOfferRefinements(baseOfferSchema);
export const offerUpdateSchema = applyOfferRefinements(baseOfferSchema.partial());

export const offerApplySchema = z.object({
  code: zStringNonEmpty,
  userId: zObjectIdString.optional(),
  subtotal: zCurrency,
  now: zDateOpt,
  lines: z
    .array(
      z.object({
        lineSubtotal: zCurrency,
        productTypeId: zObjectIdString.optional(),
        categoryIds: optionalArray(zObjectIdString),
      })
    )
    .optional(),
});
