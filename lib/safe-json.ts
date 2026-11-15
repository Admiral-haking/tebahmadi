export function safeJsonArrayString(value: unknown): string {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? JSON.stringify(parsed) : "[]";
  } catch {
    return "[]";
  }
}

export function safeJsonObjectString(value: unknown): string {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? JSON.stringify(parsed) : "{}";
  } catch {
    return "{}";
  }
}
