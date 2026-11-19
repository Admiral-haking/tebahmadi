export function resolveSiteBaseUrl(): URL | undefined {
  const envUrl =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (!envUrl) {
    return undefined;
  }

  try {
    const normalized = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    return new URL(normalized);
  } catch {
    return undefined;
  }
}

export function toAbsoluteUrl(input: string, base?: URL): string {
  if (!base) {
    return input;
  }

  try {
    return new URL(input, base).toString();
  } catch {
    return input;
  }
}

export function buildMediaPath(mediaId: string): string {
  return `/api/media/${mediaId}`;
}

export function buildMediaUrl(mediaId: string, base?: URL): string {
  const path = buildMediaPath(mediaId);
  return toAbsoluteUrl(path, base);
}
