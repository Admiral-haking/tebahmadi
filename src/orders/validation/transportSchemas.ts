import { z } from 'zod';
import { zCurrency, zObjectIdString, zStringNonEmpty } from '@/lib/z';

const pricingRowSchema = z.object({
  destRegion: zStringNonEmpty.optional(),
  basePrice: zCurrency,
  baseWeightLimit: z.number().positive({ message: 'baseWeightLimit must be > 0' }),
  baseWeightUnit: z.enum(['g', 'kg']),
  overageStepWeight: z.number().positive({ message: 'overageStepWeight must be > 0' }),
  overageStepUnit: z.enum(['g', 'kg']),
  overageStepPrice: zCurrency,
  maxWeight: z.number().positive().optional(),
  label: zStringNonEmpty.optional(),
});

export const transportCreateSchema = z
  .object({
    name: zStringNonEmpty,
    isActive: z.boolean().optional(),
    pricingRows: z.array(pricingRowSchema).min(1, 'At least one pricing row required'),
  })
  .passthrough();

export const transportUpdateSchema = transportCreateSchema.partial();

export const transportQuoteSchema = z.object({
  carrierId: zObjectIdString,
  totalWeightGrams: z.number().int().min(0),
  state: zStringNonEmpty.optional(),
  city: zStringNonEmpty.optional(),
  destRegion: zStringNonEmpty.optional(),
});
