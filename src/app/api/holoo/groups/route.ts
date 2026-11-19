import { NextRequest, NextResponse } from "next/server";

import { listHolooMainGroups, listHolooSideGroups, listHolooUnits } from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";

export const runtime = "nodejs";

/**
 * GET /api/holoo/groups — base lists used to build products.
 * `?type=main|side|unit` returns a single list; with no type, all three.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const type = req.nextUrl.searchParams.get("type");
    try {
        if (type === "main") {
            return NextResponse.json({ mainGroups: await listHolooMainGroups() });
        }
        if (type === "side") {
            return NextResponse.json({ sideGroups: await listHolooSideGroups() });
        }
        if (type === "unit") {
            return NextResponse.json({ units: await listHolooUnits() });
        }
        const [mainGroups, sideGroups, units] = await Promise.all([
            listHolooMainGroups(),
            listHolooSideGroups(),
            listHolooUnits(),
        ]);
        return NextResponse.json({ mainGroups, sideGroups, units });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
