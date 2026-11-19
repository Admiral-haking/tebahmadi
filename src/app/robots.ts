import { resolveSiteBaseUrl } from "@/seo/utils/url";

export default async function robots() {
  const baseUrl = ((await resolveSiteBaseUrl())?.toString() || "https://tebahmadi.ir").replace(/\/+$/, '');

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/_next/"],
      },
      {
        userAgent: "GPTBot",
        disallow: ["/admin/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
