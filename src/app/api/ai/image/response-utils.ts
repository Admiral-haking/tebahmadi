type ImageEditResult = {
  data?: Array<{ b64_json?: string | null }> | null;
} | null | undefined;

export function getImageBase64(result: ImageEditResult): string | undefined {
  const base64 = result?.data?.[0]?.b64_json?.trim();
  return base64 || undefined;
}
