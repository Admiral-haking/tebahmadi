import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { HttpError, requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { ErrorLogModel } from "@/observability/models/ErrorLog";

export const runtime = "nodejs";

const LEVELS = new Set(["error", "warning", "info"]);
const CATEGORIES = new Set(["api", "payment", "sync", "marketplace", "ai", "system"]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

function buildQuery(url: URL) {
  const query: Record<string, unknown> = {};
  const level = url.searchParams.get("level");
  const category = url.searchParams.get("category");
  const source = url.searchParams.get("source");
  const q = url.searchParams.get("q")?.trim();
  const resolved = parseBoolean(url.searchParams.get("resolved"));

  if (level && LEVELS.has(level)) query.level = level;
  if (category && CATEGORIES.has(category)) query.category = category;
  if (source) query.source = source;
  if (resolved === true) query.resolvedAt = { $ne: null };
  if (resolved === false) query.$or = [{ resolvedAt: { $exists: false } }, { resolvedAt: null }];
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    const searchOr = [{ message: regex }, { source: regex }, { route: regex }, { fingerprint: regex }];
    if (Array.isArray(query.$or)) {
      query.$and = [{ $or: query.$or }, { $or: searchOr }];
      delete query.$or;
    } else {
      query.$or = searchOr;
    }
  }

  return query;
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "orders:read");
    await connectMongoose();

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.max(10, Math.min(100, Number(url.searchParams.get("limit") ?? 25) || 25));
    const query = buildQuery(url);
    const skip = (page - 1) * limit;

    // Last-7-days window (start of day, 6 days ago) for the trend chart.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [items, total, stats, dailyRaw] = await Promise.all([
      ErrorLogModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ErrorLogModel.countDocuments(query).exec(),
      ErrorLogModel.aggregate<{
        open: number;
        resolved: number;
        error: number;
        warning: number;
        info: number;
      }>([
        {
          $facet: {
            total: [{ $count: "count" }],
            open: [{ $match: { $or: [{ resolvedAt: { $exists: false } }, { resolvedAt: null }] } }, { $count: "count" }],
            resolved: [{ $match: { resolvedAt: { $ne: null } } }, { $count: "count" }],
            error: [{ $match: { level: "error" } }, { $count: "count" }],
            warning: [{ $match: { level: "warning" } }, { $count: "count" }],
            info: [{ $match: { level: "info" } }, { $count: "count" }],
          },
        },
        {
          $project: {
            total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
            open: { $ifNull: [{ $arrayElemAt: ["$open.count", 0] }, 0] },
            resolved: { $ifNull: [{ $arrayElemAt: ["$resolved.count", 0] }, 0] },
            error: { $ifNull: [{ $arrayElemAt: ["$error.count", 0] }, 0] },
            warning: { $ifNull: [{ $arrayElemAt: ["$warning.count", 0] }, 0] },
            info: { $ifNull: [{ $arrayElemAt: ["$info.count", 0] }, 0] },
          },
        },
      ]).exec(),
      ErrorLogModel.aggregate<{ _id: string; total: number; error: number }>([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Tehran" } },
            total: { $sum: 1 },
            error: { $sum: { $cond: [{ $eq: ["$level", "error"] }, 1, 0] } },
          },
        },
      ]).exec(),
    ]);

    // Fill every day in the 7-day window, even days with zero logs.
    const dailyMap = new Map(dailyRaw.map((d) => [d._id, d]));
    const daily: Array<{ date: string; total: number; error: number }> = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(d); // YYYY-MM-DD
      const row = dailyMap.get(key);
      daily.push({ date: key, total: row?.total ?? 0, error: row?.error ?? 0 });
    }

    return NextResponse.json({
      data: items.map((item) => ({
        id: String(item._id),
        level: item.level,
        category: item.category,
        source: item.source,
        message: item.message,
        stack: item.stack,
        statusCode: item.statusCode,
        route: item.route,
        method: item.method,
        fingerprint: item.fingerprint,
        metadata: item.metadata,
        resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null,
        resolvedNote: item.resolvedNote,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: stats[0] ?? { total: 0, open: 0, resolved: 0, error: 0, warning: 0, info: 0 },
      daily,
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    console.error("Failed to list error logs", error);
    return jsonError(500, "Failed to list error logs");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission(req, "orders:write");
    await connectMongoose();

    const payload = await req.json().catch(() => null);
    const ids: string[] = Array.isArray(payload?.ids)
      ? payload.ids.map(String).filter((id: string) => Types.ObjectId.isValid(id))
      : [];
    if (!ids.length) return jsonError(400, "ids is required");

    const resolved = payload?.resolved !== false;
    const note = typeof payload?.note === "string" ? payload.note.trim() : undefined;

    await ErrorLogModel.updateMany(
      { _id: { $in: ids.map((id: string) => new Types.ObjectId(id)) } },
      resolved
        ? {
            $set: {
              resolvedAt: new Date(),
              resolvedBy: user._id,
              ...(note ? { resolvedNote: note } : {}),
            },
          }
        : { $unset: { resolvedAt: 1, resolvedBy: 1, resolvedNote: 1 } },
    ).exec();

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    return jsonError(500, "Failed to update error logs");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requirePermission(req, "orders:write");
    await connectMongoose();

    const url = new URL(req.url);
    const resolvedOnly = parseBoolean(url.searchParams.get("resolvedOnly")) !== false;
    const olderThanDays = Math.max(1, Math.min(365, Number(url.searchParams.get("olderThanDays") ?? 30) || 30));
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const query = resolvedOnly
      ? { resolvedAt: { $ne: null }, createdAt: { $lt: cutoff } }
      : { createdAt: { $lt: cutoff } };
    const result = await ErrorLogModel.deleteMany(query).exec();

    return NextResponse.json({ ok: true, deleted: result.deletedCount ?? 0 });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    return jsonError(500, "Failed to delete error logs");
  }
}
