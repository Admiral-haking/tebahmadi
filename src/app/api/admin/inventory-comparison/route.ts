import { NextRequest, NextResponse } from "next/server";
import { Types, type PipelineStage } from "mongoose";

import ProductModel from "@/catalog/models/Product";
import { HttpError, requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { syncLinkedVariantToServices } from "@/sync/service-stock";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 25;
const MAX_SYNC_ITEMS = 100;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function serviceMismatchExpression(serviceField: string) {
  return {
    $anyElementTrue: {
      $map: {
        input: `$${serviceField}`,
        as: "service",
        in: { $ne: ["$$service.quantity", "$siteStock"] },
      },
    },
  };
}

function buildStatusFilter(status: string): PipelineStage | null {
  if (status === "mismatch") return { $match: { hasMismatch: true } };
  if (status === "synced") return { $match: { hasMismatch: false, serviceCount: { $gt: 0 } } };
  if (status === "unlinked") return { $match: { serviceCount: 0 } };
  return null;
}

function buildBasePipeline(searchTerm: string) {
  const safeSearch = searchTerm.trim() ? escapeRegex(searchTerm.trim()) : "";
  const pipeline: PipelineStage[] = [
    { $match: { "variants.0": { $exists: true } } },
    { $unwind: "$variants" },
    {
      $addFields: {
        variantObjectId: "$variants._id",
        variantIdText: { $toString: "$variants._id" },
        siteStock: { $ifNull: ["$variants.inventory.quantity", 0] },
        barcodeText: { $ifNull: ["$variants.barcode", ""] },
      },
    },
  ];

  if (safeSearch) {
    pipeline.push({
      $match: {
        $or: [
          { title: { $regex: safeSearch, $options: "i" } },
          { slug: { $regex: safeSearch, $options: "i" } },
          { "variants.barcode": { $regex: safeSearch, $options: "i" } },
          { "variants.sku": { $regex: safeSearch, $options: "i" } },
        ],
      },
    });
  }

  // Match marketplace records by variantId OR barcode. A bare variantId join
  // drops every record whose variantId went stale after a catalog re-import, so
  // those linked variants showed up as "unlinked" / never compared. barcode is
  // the stable business key the sync uses.
  const linkLookup = (from: string, as: string): PipelineStage.Lookup => ({
    $lookup: {
      from,
      let: { vid: "$variantObjectId", bc: "$barcodeText" },
      pipeline: [
        {
          $match: {
            $expr: {
              $or: [
                { $eq: ["$variantId", "$$vid"] },
                {
                  $and: [
                    { $ne: ["$$bc", ""] },
                    { $eq: ["$barcode", "$$bc"] },
                  ],
                },
              ],
            },
          },
        },
      ],
      as,
    },
  });

  pipeline.push(
    linkLookup("dgkvariants", "digikala"),
    linkLookup("snpvariants", "snapp"),
    linkLookup("bslvariants", "basalaam"),
    {
      $addFields: {
        hasMismatch: {
          $or: [
            serviceMismatchExpression("digikala"),
            serviceMismatchExpression("snapp"),
            serviceMismatchExpression("basalaam"),
          ],
        },
        serviceCount: {
          $add: [{ $size: "$digikala" }, { $size: "$snapp" }, { $size: "$basalaam" }],
        },
      },
    },
  );

  return pipeline;
}

function projectItemStage() {
  return {
    $project: {
      _id: 0,
      variantId: "$variantIdText",
      productId: { $toString: "$_id" },
      title: "$title",
      slug: "$slug",
      sku: "$variants.sku",
      barcode: "$variants.barcode",
      imageId: {
        $cond: [
          { $gt: [{ $size: { $ifNull: ["$variants.mediaIds", []] } }, 0] },
          { $toString: { $arrayElemAt: ["$variants.mediaIds", 0] } },
          null,
        ],
      },
      siteStock: "$siteStock",
      hasMismatch: 1,
      services: {
        digikala: {
          $map: {
            input: "$digikala",
            as: "item",
            in: {
              id: { $toString: "$$item._id" },
              vendorId: "$$item.vendorId",
              quantity: "$$item.quantity",
              displayName: "$$item.displayName",
              updatedAt: "$$item.updatedAt",
            },
          },
        },
        snapp: {
          $map: {
            input: "$snapp",
            as: "item",
            in: {
              id: { $toString: "$$item._id" },
              vendorId: "$$item.vendorId",
              quantity: "$$item.quantity",
              displayName: "$$item.displayName",
              updatedAt: "$$item.updatedAt",
            },
          },
        },
        basalaam: {
          $map: {
            input: "$basalaam",
            as: "item",
            in: {
              id: { $toString: "$$item._id" },
              vendorId: "$$item.vendorId",
              quantity: "$$item.quantity",
              displayName: "$$item.displayName",
              updatedAt: "$$item.updatedAt",
            },
          },
        },
      },
    },
  } satisfies PipelineStage.Project;
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "products:read");
    await connectMongoose();

    const params = req.nextUrl.searchParams;
    const page = toPositiveInt(params.get("page"), 1);
    const limit = Math.min(toPositiveInt(params.get("limit"), DEFAULT_LIMIT), 100);
    const q = params.get("q") ?? "";
    const status = params.get("status") ?? "mismatch";

    const basePipeline = buildBasePipeline(q);
    const statusFilter = buildStatusFilter(status);
    const filterStages: PipelineStage[] = statusFilter ? [statusFilter] : [];

    const facetStage = {
      $facet: {
        data: [
          ...filterStages,
          { $sort: { hasMismatch: -1, updatedAt: -1, variantObjectId: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          projectItemStage(),
        ],
        total: [
          ...filterStages,
          { $count: "count" },
        ],
        stats: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              mismatch: { $sum: { $cond: { if: "$hasMismatch", then: 1, else: 0 } } },
              linked: { $sum: { $cond: { if: { $gt: ["$serviceCount", 0] }, then: 1, else: 0 } } },
              unlinked: { $sum: { $cond: { if: { $eq: ["$serviceCount", 0] }, then: 1, else: 0 } } },
            },
          },
        ],
      },
    } as unknown as PipelineStage;

    const pipeline: PipelineStage[] = [...basePipeline, facetStage];

    const [result] = await ProductModel.aggregate(pipeline);

    const total = Number(result?.total?.[0]?.count ?? 0);
    const stats = result?.stats?.[0] ?? { total: 0, mismatch: 0, linked: 0, unlinked: 0 };

    return NextResponse.json({
      data: result?.data ?? [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        total: Number(stats.total ?? 0),
        mismatch: Number(stats.mismatch ?? 0),
        linked: Number(stats.linked ?? 0),
        unlinked: Number(stats.unlinked ?? 0),
      },
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    logErrorLater({
      category: "api",
      source: "admin.inventory-comparison.get",
      error,
      route: req.nextUrl.pathname,
      method: req.method,
    });
    return jsonError(500, "Failed to load inventory comparison");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, "products:write");
    await connectMongoose();

    const body = await req.json().catch(() => ({}));
    const rawIds = Array.isArray(body?.variantIds) ? body.variantIds : [];
    const variantIds = rawIds
      .map((id: unknown) => String(id))
      .filter((id: string) => Types.ObjectId.isValid(id))
      .slice(0, MAX_SYNC_ITEMS)
      .map((id: string) => new Types.ObjectId(id));

    if (!variantIds.length) return jsonError(400, "variantIds is needed");

    const rows = await ProductModel.aggregate([
      { $match: { "variants._id": { $in: variantIds } } },
      { $unwind: "$variants" },
      { $match: { "variants._id": { $in: variantIds } } },
      {
        $project: {
          _id: 0,
          variantId: { $toString: "$variants._id" },
          barcode: "$variants.barcode",
          stock: { $ifNull: ["$variants.inventory.quantity", 0] },
        },
      },
    ]);

    if (!rows.length) {
      return NextResponse.json({ ok: false, synced: 0, skipped: 0, message: "No variant found" }, { status: 400 });
    }

    // Push per variant resolving linked records by variantId OR barcode (each by
    // its OWN barcode), so records whose barcode drifted from the site after a
    // re-import still get set — a flat site-barcode fan-out missed them.
    const summaries = await Promise.all(
      rows.map((row) =>
        syncLinkedVariantToServices(
          row.variantId,
          typeof row.barcode === "string" ? row.barcode : "",
          { stock: Number(row.stock ?? 0) },
        ),
      ),
    );

    const summary = summaries.reduce(
      (acc, s) => ({
        attempted: acc.attempted + s.attempted,
        succeeded: acc.succeeded + s.succeeded,
        failed: acc.failed + s.failed,
        errors: Array.from(new Set([...acc.errors, ...s.errors])).slice(0, 8),
      }),
      { attempted: 0, succeeded: 0, failed: 0, errors: [] as string[] },
    );

    return NextResponse.json({
      ok: summary.failed === 0 || summary.succeeded > 0,
      requested: rawIds.length,
      synced: rows.length,
      serviceRequests: summary.attempted,
      serviceSucceeded: summary.succeeded,
      serviceFailed: summary.failed,
      errors: summary.errors,
      skipped: 0,
    }, { status: summary.succeeded > 0 || summary.attempted === 0 ? 200 : 502 });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    logErrorLater({
      category: "sync",
      source: "admin.inventory-comparison.sync",
      error,
      route: req.nextUrl.pathname,
      method: req.method,
    });
    return jsonError(500, "Failed to sync inventory");
  }
}
