import SearchView from "@/views/search";
import { Metadata } from "next";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";


export async function generateMetadata({ searchParams }: any): Promise<Metadata> {
    const { q } = await searchParams;
    const query = typeof q === 'string' ? q.trim() : Array.isArray(q) ? String(q[0] ?? '').trim() : '';

    return {
        title: `${query ? `جستجو برای «${query}»` : "جستجوی محصولات"} | طب احمدی`,
        description: "جستجو در محصولات طبیعی و گیاهی طب احمدی",
        alternates: { canonical: `${BRAND.url}/search` },
        robots: { index: false, follow: true },
    }
}

export default function Page() {

    return <Suspense>
        <SearchView />
    </Suspense>
}
