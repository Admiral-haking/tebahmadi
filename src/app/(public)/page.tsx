import type { Metadata } from "next";

import HomeView from "@/views/home";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
    const { metadata } = await generatePageMetadata({ slug: "/" });
    return metadata;
}

export default function Page() {
    return <HomeView />;
}
