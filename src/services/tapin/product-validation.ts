import { z } from 'zod';

export const tapinProductInputSchema = z.object({
  title: z.string().trim().min(1).max(100),
  category_id: z.string().uuid(),
  weight: z.coerce.number().int().min(1).max(30_000),
  price: z.coerce.number().int().nonnegative().max(100_000_000_000),
  description: z.string().trim().max(2000).nullish(),
});
