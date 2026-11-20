import type { Metadata } from "next";

import BlogView from "@/views/blog";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import type { BlogViewSearchParams } from "@/views/blog/data";

export async function generateMetadata(): Promise<Metadata> {
    const { metadata } = await generatePageMetadata({
        slug: "/blog",
        defaults: {
            title: "مجله طب احمدی",
            description: "راهنمای انتخاب محصولات طبیعی، گیاهان دارویی و سبک زندگی سالم در مجله طب احمدی.",
        },
    });
    return metadata;
}

export default async function Page({ searchParams }: { searchParams: Promise<BlogViewSearchParams> }) {
    return <BlogView searchParams={await searchParams} />;
}
