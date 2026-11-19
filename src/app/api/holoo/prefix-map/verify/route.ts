import { NextRequest, NextResponse } from "next/server";

import {
    getPrefixSidegroupMap,
    listHolooSideGroups,
} from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";
import { connectMongoose } from "@/lib/mongoose";

export const runtime = "nodejs";

/**
 * GET /api/holoo/prefix-map/verify — check whether each saved prefix→SideGroup
 * mapping still points at a SideGroup that exists in Holoo *right now*.
 *
 * Why: products fail to sync with no obvious cause when the mapped SideGroup
 * ErpCodes are stale (the groups were rebuilt in Holoo, so the saved codes no
 * longer resolve). This compares the saved map against the live side-group list
 * and tells the admin exactly which prefixes need re-linking — without touching
 * the auth token directly (it goes through the normal Holoo client).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        await connectMongoose();
        const [map, sideGroups] = await Promise.all([
            getPrefixSidegroupMap(),
            listHolooSideGroups(),
        ]);

        const byErpCode = new Map(sideGroups.map((g) => [g.ErpCode, g.Name]));

        const entries = Object.entries(map);
        const results = entries.map(([prefix, erpcode]) => {
            const name = byErpCode.get(erpcode);
            return {
                prefix,
                erpcode,
                valid: Boolean(name),
                sideGroupName: name ?? null,
            };
        });

        const invalid = results.filter((r) => !r.valid);

        return NextResponse.json({
            ok: true,
            totalMapped: entries.length,
            validCount: results.length - invalid.length,
            invalidCount: invalid.length,
            liveSideGroupCount: sideGroups.length,
            results,
            // Actionable summary for the UI.
            note:
                entries.length === 0
                    ? "هیچ پیشوندی نگاشت نشده است."
                    : invalid.length === 0
                      ? "همه‌ی نگاشت‌های پیشوند معتبرند و گروه فرعی متناظرشان در هلو موجود است."
                      : `${invalid.length} نگاشت نامعتبر است: گروه فرعی متناظر در هلو پیدا نشد (احتمالاً گروه‌ها در هلو بازساخته شده‌اند). این پیشوندها را دوباره از لیست به‌روزِ گروه‌ها انتخاب کنید: ${invalid
                            .map((r) => r.prefix)
                            .join("، ")}`,
        });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
