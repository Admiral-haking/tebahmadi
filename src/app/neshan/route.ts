import { NextResponse } from "next/server";

const EMALLS_NESHAN_URL = "https://service.emalls.ir/neshan?id=72297";
const ONE_DAY_SECONDS = 60 * 60 * 24;
const ONE_WEEK_SECONDS = ONE_DAY_SECONDS * 7;

export async function GET() {
  try {
    const upstream = await fetch(EMALLS_NESHAN_URL, {
      next: { revalidate: ONE_DAY_SECONDS },
    });

    if (!upstream.ok) {
      return new NextResponse(null, {
        status: upstream.status,
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      });
    }

    const contentType = upstream.headers.get("content-type") || "image/png";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=" + ONE_DAY_SECONDS + ", s-maxage=" + ONE_DAY_SECONDS + ", stale-while-revalidate=" + ONE_WEEK_SECONDS,
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 502,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  }
}
