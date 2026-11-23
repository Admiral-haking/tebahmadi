import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { HttpError, requirePermission } from "@/lib/auth";
import {
  createDeveloperAccessToken,
  hasDeveloperAccess,
  isDeveloperPasswordValid,
  setDeveloperAccessCookie,
  clearDeveloperAccessCookie,
} from "@/lib/developer-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const passwordSchema = z.object({
  password: z.string().min(1).max(128),
});

function authError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "users:read");
    return NextResponse.json(
      { authorized: hasDeveloperAccess(request) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "users:read");

    const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !isDeveloperPasswordValid(parsed.data.password)) {
      return NextResponse.json({ error: "developer_access_denied" }, { status: 401 });
    }

    if (!createDeveloperAccessToken()) {
      return NextResponse.json({ error: "developer_access_denied" }, { status: 401 });
    }

    const response = NextResponse.json(
      { authorized: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    setDeveloperAccessCookie(response);
    return response;
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(request, "users:read");
    const response = NextResponse.json(
      { authorized: false },
      { headers: { "Cache-Control": "no-store" } },
    );
    clearDeveloperAccessCookie(response);
    return response;
  } catch (error) {
    return authError(error);
  }
}
