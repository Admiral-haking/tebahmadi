export async function axiosRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: init?.cache ?? "no-store",
  });
}

export async function safeJson<T = Record<string, unknown>>(
  response: Response,
): Promise<T & { error?: string }> {
  return (await response.json().catch(() => ({}))) as T & { error?: string };
}
