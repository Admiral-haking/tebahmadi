import type { Metadata } from "next";

import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import AuthPageClient from "./AuthPageClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
    const { metadata } = await generatePageMetadata({ slug: "/auth" });
    return metadata;
}

export default function AuthPage() {
    return <Suspense>
        <AuthPageClient />;
    </Suspense>
}
