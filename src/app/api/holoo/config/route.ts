import { NextRequest, NextResponse } from "next/server";

import { HOLOO_CONNECTION_ID } from "@/holoo/constants/config";
import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/** GET — read Holoo sync config (virtual side-group for auto-created products). */
export async function GET(): Promise<NextResponse> {
    const cfg = await getServiceInfo<{ erpcode?: string }>("holoo", "config:virtual_sidegroup", HOLOO_CONNECTION_ID);
    return NextResponse.json({ virtualSidegroupErpcode: cfg?.erpcode || "" });
}

/** POST { virtualSidegroupErpcode } — set the virtual side-group. */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }
    const erpcode = String(body?.virtualSidegroupErpcode ?? "").trim();
    await setServiceInfo("holoo", "config:virtual_sidegroup", HOLOO_CONNECTION_ID, { erpcode });
    return NextResponse.json({ ok: true, virtualSidegroupErpcode: erpcode });
}
