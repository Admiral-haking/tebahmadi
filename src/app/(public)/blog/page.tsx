import type { Metadata } from "next";

import BlogView from "@/views/blog";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import type { BlogViewSearchParams } from "@/views/blog/data";

export async function generateMetadata(): Promise<Metadata> {
    const { metadata } = await generatePageMetadata({
        slug: "/blog",
        defaults: {
            title: "وبلاگ ",
            description: "خبرها، نکات آموزشی و داستان‌های الهام‌بخش ورزشکاران ایران را در مجله دنبال کنید.",
        },
    });
    return metadata;
}

export default async function Page({ searchParams }: { searchParams: Promise<BlogViewSearchParams> }) {
    return <BlogView searchParams={await searchParams} />;
}
