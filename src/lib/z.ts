import { Types } from 'mongoose';
import { z } from 'zod';

const objectIdMessage = 'Invalid ObjectId';

export const zObjectIdString = z
  .string()
  .min(1, { message: objectIdMessage })
  .refine((value) => Types.ObjectId.isValid(value), { message: objectIdMessage });

export const zOptionalObjectIdString = zObjectIdString.optional();

export const zDate = z
  .preprocess((value) => {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return value;
  }, z.date());

export const zDateOpt = zDate.optional();

export const zPositiveInt = z.number().int({ message: 'Expected integer' }).positive({ message: 'Must be greater than 0' });

export const zNonNegativeInt = z.number().int({ message: 'Expected integer' }).min(0, { message: 'Must be >= 0' });

export const zNonNegativeNumber = z.number().min(0, { message: 'Must be >= 0' });

export const zCurrency = zNonNegativeInt;

export const zStringNonEmpty = z.string().trim().min(1, { message: 'Required' });

const slugRegex = /^[a-z0-9]+(?:[a-z0-9\-/]*[a-z0-9])?$/;
const routeSlugRegex = /^(\/)$/;

export const zSlug = z
  .string()
  .min(1)
  .refine((value) => slugRegex.test(value), {
    message: 'Slug must contain lowercase letters, numbers, dashes, or forward slashes without leading/trailing slash',
  });

export const zRouteSlug = z
  .string()
  .min(1)
  .refine((value) => routeSlugRegex.test(value) || (/^\//.test(value) && !/\/$/.test(value)), {
    message: 'Route slug must start with "/" and have no trailing slash',
  });

export const zStatus = z.enum(['draft', 'published', 'archived']);

export const zSeo = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonical: z.string().url().optional(),
  noindex: z.boolean().optional(),
  ogImageId: zObjectIdString.optional(),
  jsonLd: z.any().optional(),
});

export function optionalArray<T extends z.ZodTypeAny>(schema: T) {
  return z.array(schema).optional();
}

export function nullableArray<T extends z.ZodTypeAny>(schema: T) {
  return z.array(schema).nullable().optional();
}
