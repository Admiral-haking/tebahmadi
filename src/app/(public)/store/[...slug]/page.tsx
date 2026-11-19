import { notFound } from "next/navigation";
import type { Metadata } from "next";

import StoreView, { type StoreViewSearchParams } from "@/views/store";
import { loadStoreCategoryContext } from "@/views/store/data";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";

type RouteParams = Promise<{ slug?: string[] | undefined }>;
type SearchParams = Promise<StoreViewSearchParams>;

function normalizeSegments(slug?: string[] | undefined): string[] {
  if (!slug) return [];
  return slug.map((segment) => segment.trim()).filter((segment) => segment.length > 0);
}

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const segments = normalizeSegments(resolvedParams.slug);
  const path = segments.join("/");
  try {
    const context = await loadStoreCategoryContext(segments);
    const { metadata } = await generatePageMetadata({
      slug: `/store/${path}`,
      entitySeo: {
        title: context.root.seoTitle,
        description: context.root.seoDescription,
      },
      defaults: {
        title: context.root.name,
        description: context.root.seoDescription,
      },
    });
    return metadata;
  } catch {
    const { metadata } = await generatePageMetadata({ slug: "/store" });
    return metadata;
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const segments = normalizeSegments(resolvedParams.slug);
  if (segments.length === 0) {
    notFound();
  }

  try {
    const context = await loadStoreCategoryContext(segments);
    return <StoreView searchParams={await resolvedSearchParams} context={context} />;
  } catch (error) {
    notFound();
  }
}
