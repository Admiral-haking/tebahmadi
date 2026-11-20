import SearchView from "@/views/search";
import { Metadata } from "next";
import { Suspense } from "react";


export async function generateMetadata({ searchParams }: any): Promise<Metadata> {
    const { q } = await searchParams;
    const query = typeof q === 'string' ? q.trim() : Array.isArray(q) ? String(q[0] ?? '').trim() : '';

    return {
        title: `${query ? `جستجو برای «${query}»` : "جستجوی محصولات"} | طب احمدی`,
        description: "جستجو در محصولات طبیعی و گیاهی طب احمدی"
    }
}

export default function Page() {

    return <Suspense>
        <SearchView />
    </Suspense>
}
