export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export const ALLOWED_IMAGE_MIME_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);
