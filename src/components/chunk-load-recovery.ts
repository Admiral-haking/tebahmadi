type ErrorLike = {
  name?: unknown;
  message?: unknown;
  reason?: unknown;
};

function readErrorText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return `${value.name} ${value.message}`;
  }

  if (value && typeof value === "object") {
    const error = value as ErrorLike;
    return [error.name, error.message, error.reason]
      .filter((part): part is string => typeof part === "string")
      .join(" ");
  }

  return "";
}

export function isChunkLoadError(value: unknown): boolean {
  const text = readErrorText(value);

  return /chunkloaderror|loading (?:css )?chunk(?:\s+\w+)? failed|failed to fetch dynamically imported module|importing a module script failed/i.test(text);
}
