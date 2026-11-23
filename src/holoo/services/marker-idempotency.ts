import { HOLOO_CONNECTION_ID } from "@/holoo/constants/config";
import ServiceInfoModel from "@/settings/models/serviceInfo";

const MARKER_PREFIXES = ["invoice:", "return:", "tracker:", "tracker-return:"] as const;

export type MarkerIssueKind =
    | "duplicate_erpcode"
    | "synced_without_erpcode"
    | "unresolved_conflict"
    | "skipped_without_reason";

export type MarkerIssue = {
    kind: MarkerIssueKind;
    markerKeys: string[];
    erpcode?: string;
    detail: string;
};

export type MarkerIdempotencyReport = {
    scanned: number;
    byKind: { invoices: number; returns: number; trackers: number };
    synced: number;
    skipped: number;
    issues: MarkerIssue[];
    stats: Record<MarkerIssueKind, number>;
    generatedAt: string;
};

type MarkerData = {
    erpcode?: string;
    syncedAt?: number;
    skipped?: boolean;
    reason?: string;
    conflict?: boolean;
    reconciled?: boolean;
};

export function holooMarkerKind(id: string): keyof MarkerIdempotencyReport["byKind"] | undefined {
    if (id.startsWith("invoice:")) return "invoices";
    if (id.startsWith("return:") || id.startsWith("tracker-return:")) return "returns";
    if (id.startsWith("tracker:")) return "trackers";
    return undefined;
}

export async function getMarkerIdempotencyReport(limit = 50): Promise<MarkerIdempotencyReport> {
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500);
    const rows = await ServiceInfoModel.find(
        {
            service: "holoo",
            vendorId: HOLOO_CONNECTION_ID,
            id: { $regex: `^(${MARKER_PREFIXES.map((prefix) => prefix.replace(":", "")).join("|")}):` },
        },
        { id: 1, data: 1 },
    ).lean().exec();

    const report: MarkerIdempotencyReport = {
        scanned: 0,
        byKind: { invoices: 0, returns: 0, trackers: 0 },
        synced: 0,
        skipped: 0,
        issues: [],
        stats: {
            duplicate_erpcode: 0,
            synced_without_erpcode: 0,
            unresolved_conflict: 0,
            skipped_without_reason: 0,
        },
        generatedAt: new Date().toISOString(),
    };

    const byErpcode = new Map<string, string[]>();

    for (const row of rows) {
        const id = String((row as { id?: string }).id ?? "");
        const kind = holooMarkerKind(id);
        if (!kind) continue;
        const data = ((row as { data?: unknown }).data ?? {}) as MarkerData;

        report.scanned += 1;
        report.byKind[kind] += 1;

        const erpcode = String(data.erpcode ?? "").trim();
        if (erpcode) {
            report.synced += 1;
            byErpcode.set(erpcode, [...(byErpcode.get(erpcode) ?? []), id]);
        }
        if (data.skipped === true) {
            report.skipped += 1;
            if (!String(data.reason ?? "").trim()) {
                report.issues.push({
                    kind: "skipped_without_reason",
                    markerKeys: [id],
                    detail: "این سند رد شده ولی دلیلی برای آن ثبت نشده است.",
                });
            }
            continue;
        }

        if (data.conflict === true && data.reconciled !== true && !erpcode) {
            report.issues.push({
                kind: "unresolved_conflict",
                markerKeys: [id],
                detail: "هلو این سند را تکراری اعلام کرده و تطبیق خودکار به نتیجه نرسیده است.",
            });
            continue;
        }

        if (!erpcode && Number(data.syncedAt ?? 0) > 0) {
            report.issues.push({
                kind: "synced_without_erpcode",
                markerKeys: [id],
                detail: "نشان ثبت دارد ولی کد سند هلو ندارد؛ این سند باید بررسی شود.",
            });
        }
    }

    for (const [erpcode, keys] of byErpcode) {
        if (keys.length < 2) continue;
        report.issues.push({
            kind: "duplicate_erpcode",
            markerKeys: keys,
            erpcode,
            detail: `${keys.length} نشان فروشگاه به یک سند هلو (${erpcode}) اشاره می‌کنند.`,
        });
    }

    for (const issue of report.issues) report.stats[issue.kind] += 1;
    const order: MarkerIssueKind[] = [
        "duplicate_erpcode",
        "synced_without_erpcode",
        "unresolved_conflict",
        "skipped_without_reason",
    ];
    report.issues.sort((left, right) => order.indexOf(left.kind) - order.indexOf(right.kind));
    report.issues = report.issues.slice(0, safeLimit);
    return report;
}
