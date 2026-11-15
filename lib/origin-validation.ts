export function originAllowed(originHeader: string | null, requestUrl: string, configuredPublicUrl?: string): boolean {
  if (!originHeader) return false;
  try {
    const origin = new URL(originHeader).origin;
    const allowed = new Set([new URL(requestUrl).origin]);
    if (configuredPublicUrl?.trim()) allowed.add(new URL(configuredPublicUrl).origin);
    return allowed.has(origin);
  } catch {
    return false;
  }
}
