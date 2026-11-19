import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadPageBySlug } from "@/lib/cache";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import PageView from "@/views/page";

type PageRouteParams = {
  slug: string;
};

type PageRouteProps = {
  params: Promise<PageRouteParams>;
};

function stripHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function createExcerpt(html: string | null | undefined, limit = 160): string | undefined {
  const text = stripHtml(html);
  if (!text) return undefined;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

export async function generateMetadata({ params }: Pick<PageRouteProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) {
    notFound();
  }

  const page = await loadPageBySlug(slug);
  if (!page) {
    notFound();
  }

  const fallbackDescription = page.seo?.description ?? createExcerpt(page.content ?? "");

  const { metadata } = await generatePageMetadata({
    slug: `/page/${slug}`,
    entitySeo: (page.seo ?? undefined) as any,
    defaults: {
      title: page.title,
      description: fallbackDescription,
    },
  });

  return metadata;
}

export default async function Page({ params }: PageRouteProps) {
  const { slug } = await params;
  if (!slug) {
    notFound();
  }

  const page = await loadPageBySlug(slug);
  if (!page) {
    notFound();
  }

  return <PageView page={page} jsonLd={page.seo?.jsonLd} />;
}
