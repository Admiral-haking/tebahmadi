export const SNAPP_CONNECTION_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
} as const;

export function snappConnectionFetchUrl(now: number = Date.now()): string {
  return `/api/snapp?refresh=${encodeURIComponent(String(now))}`;
}
