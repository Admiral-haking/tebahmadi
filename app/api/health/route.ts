const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  return Response.json({ status: "ok", service: "tab-ahmadi", timestamp: new Date().toISOString() }, { headers });
}

export async function HEAD() {
  return new Response(null, { status: 200, headers });
}

export async function POST() {
  return Response.json({ error: "روش درخواست پشتیبانی نمی‌شود" }, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
}
