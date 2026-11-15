const safeKey = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function normalizeIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return safeKey.test(key) ? key : null;
}
