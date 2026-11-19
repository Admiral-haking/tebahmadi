import type { Metadata } from "next";
import { notFound } from "next/navigation";

import BlogPostView from "@/views/blog/post";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import { loadBlogPost } from "@/views/blog/data";

type BlogPostPageProps = {
    params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Pick<BlogPostPageProps, "params">): Promise<Metadata> {
    const { slug } = await params;
    if (!slug) {
        notFound();
    }

    const data = await loadBlogPost(slug);
    if (!data) {
        notFound();
    }

    const { metadata } = await generatePageMetadata({
        slug: `/blog/${slug}`,
        entitySeo: data.post.seo as any ?? undefined,
        defaults: {
            title: data.post.title,
            description: data.post.excerpt,
            image: data.post.coverImageUrl ? { url: data.post.coverImageUrl, alt: data.post.title } : undefined,
        },
    });

    return metadata;
}

export default async function Page({ params }: BlogPostPageProps) {
    const { slug } = await params;
    if (!slug) {
        notFound();
    }
    return <BlogPostView slug={slug} />;
}
