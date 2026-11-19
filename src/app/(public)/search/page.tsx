import SearchView from "@/views/search";
import { Metadata } from "next";
import { Suspense } from "react";


export async function generateMetadata({ searchParams }: any): Promise<Metadata> {
    const { q } = await searchParams;

    return {
        title: `جستجو: ${q}`,
        description: "جستجو در فروشگاه ما"
    }
}

export default function Page() {

    return <Suspense>
        <SearchView />
    </Suspense>
}