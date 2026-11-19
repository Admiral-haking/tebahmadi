import { z } from 'zod';

export const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid 24 character hex ObjectId');

export const nonEmptyString = z.string().trim().min(1, 'Required');

export const optionalNonEmptyString = nonEmptyString.optional();

export const positiveInt = z.number().int().nonnegative();

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters/numbers separated by dashes');

export const paginationSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(20),
  skip: z
    .number()
    .int()
    .nonnegative()
    .default(0),
});
