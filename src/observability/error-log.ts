import { Types } from "mongoose";

import { connectMongoose } from "@/lib/mongoose";
import { ErrorLogModel } from "./models/ErrorLog";

export type ErrorLogLevel = "error" | "warning" | "info";
export type ErrorLogCategory = "api" | "payment" | "sync" | "marketplace" | "ai" | "system";

export type ErrorLogInput = {
  level?: ErrorLogLevel;
  category?: ErrorLogCategory;
  source: string;
  message?: string;
  error?: unknown;
  statusCode?: number;
  route?: string;
  method?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

function stringifyMetadata(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map(stringifyMetadata);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 80)
        .map(([key, item]) => [key, stringifyMetadata(item)]),
    );
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function getErrorMessage(error: unknown, fallback = "unknown_error"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.reason;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

function buildFingerprint(input: ErrorLogInput, message: string): string {
  return [input.category ?? "system", input.source, input.route ?? "", message]
    .join("|")
    .slice(0, 500);
}

export async function logError(input: ErrorLogInput): Promise<void> {
  try {
    await connectMongoose();
    const message = input.message?.trim() || getErrorMessage(input.error);
    const userId = input.userId && Types.ObjectId.isValid(input.userId) ? new Types.ObjectId(input.userId) : undefined;

    await ErrorLogModel.create({
      level: input.level ?? "error",
      category: input.category ?? "system",
      source: input.source,
      message,
      stack: getErrorStack(input.error),
      statusCode: input.statusCode,
      route: input.route,
      method: input.method,
      userId,
      fingerprint: buildFingerprint(input, message),
      metadata: stringifyMetadata(input.metadata),
    });
  } catch (logWriteError) {
    console.error("[error-log] failed to persist error log", logWriteError);
  }
}

export function logErrorLater(input: ErrorLogInput): void {
  void logError(input);
}
