import { searchVariantsWithDisplayName } from "@/catalog/services/variantsService";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        await connectMongoose();
        const params = req.nextUrl.searchParams;
        const q = params.get('q') ?? "";
        const limitParam = params.get('limit');
        const pageParam = params.get('page');
        const limit = limitParam ? Number(limitParam) : 50;
        const page = pageParam ? Number(pageParam) : undefined;

        const res = await searchVariantsWithDisplayName(q, page, limit)

        return NextResponse.json(res);
    } catch (error) {
        logErrorLater({
            category: "api",
            source: "admin.catalog.variants.search",
            error,
            statusCode: 500,
            route: req.nextUrl.pathname,
            method: req.method,
            metadata: {
                q: req.nextUrl.searchParams.get("q") ?? "",
                page: req.nextUrl.searchParams.get("page") ?? "",
            },
        });
        return NextResponse.json({ error: "Variants could not be loaded" }, { status: 500 });
    }
}
