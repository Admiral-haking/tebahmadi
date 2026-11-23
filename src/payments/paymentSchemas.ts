import { z } from 'zod';
import { zCurrency, zObjectIdString, zStringNonEmpty } from '@/lib/z';

const paymentGatewaySchema = z.enum([
  'zarinpal',
  'torob',
  'azkivam',
  'digipay',
  'snapppay',
  'bajetpay',
]);

export const createPaymentSchema = z.object({
  invoiceId: zObjectIdString,
  userId: zObjectIdString,
  amount: zCurrency,
  description: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9+]{5,15}$/u, { message: 'Invalid mobile' })
    .optional(),
  gateway: paymentGatewaySchema.optional(),
  requestKey: z.string().trim().max(128).optional(),
});

export const verifyQuerySchema = z.object({
  Authority: zStringNonEmpty,
  Status: z.enum(['OK', 'NOK']),
  invoiceId: zObjectIdString,
  tx: zObjectIdString,
});
