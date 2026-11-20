import { z } from 'zod';
import { OTP_LENGTH } from '../auth/otp';

export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone number must be in E.164 format');

export const mediaScopeSchema = z.enum(['avatar', 'attachment', 'gallery']);

export const requestCodeSchema = z.object({
  phone: phoneSchema,
});

export const verifyCodeSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Code must be a ${OTP_LENGTH} digit string`),
});

const avatarSchema = z.object({
  originalId: z.string(),
  mobileId: z.string(),
  thumbId: z.string(),
  groupId: z.string(),
});

export const userUpdateSchema = z
  .object({
    fname: z.string().trim().min(1).max(100).optional(),
    lname: z.string().trim().min(1).max(100).optional(),
    age: z.number().int().min(0).max(120).optional(),
    state: z.string().trim().min(1).max(100).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    address: z.string().trim().min(1).max(255).optional(),
    avatar: avatarSchema.optional(),
  })
  .strict();
