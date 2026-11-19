import { connectMongoose } from "@/lib/mongoose";
import { TrackerModel } from "@/tracking";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

const getTrackingStatistics = unstable_cache(
    async () => {
        await connectMongoose();

        return TrackerModel.aggregate([
            {
                $group: {
                    _id: "$serviceId",
                    amount: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);
    },
    ["admin-tracking-statistics"],
    { revalidate: 60 },
);

export async function GET() {

    const overall = await getTrackingStatistics();

    const response = NextResponse.json({ overall });
    response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    return response;
}
