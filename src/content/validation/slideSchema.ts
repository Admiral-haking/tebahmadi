import { z } from 'zod';
import { zObjectIdString } from '@/lib/z';

function isValidHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  return /^https?:\/\//i.test(trimmed);
}

export const slideCreateSchema = z.object({
  mediaDesktopId: zObjectIdString,
  mediaMobileId: z.preprocess(
    (value) => {
      if (value === null || typeof value === 'undefined') return undefined;
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : undefined;
    },
    zObjectIdString.optional(),
  ),
  href: z
    .string()
    .trim()
    .min(1, 'لینک الزامی است')
    .refine(isValidHref, { message: 'لینک باید با / شروع شود یا آدرس کامل باشد' }),
});

export type SlideCreateInput = z.infer<typeof slideCreateSchema>;
