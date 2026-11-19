"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import SelectDropDown from "@/components/select";
import type { StoreViewSearchParams } from "..";

type SortOption = "newest" | "expensive" | "cheapest";

function extractSort(searchParams: StoreViewSearchParams): SortOption {
    const raw = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
    if (raw === "expensive" || raw === "cheapest") {
        return raw;
    }
    return "newest";
}

export default function StoreSort({ searchParams }: { searchParams: StoreViewSearchParams }) {
    const router = useRouter();
    const params = useSearchParams();
    const pathname = usePathname();

    const initialSort = useMemo(() => extractSort(searchParams), [searchParams]);

    const currentSort = useMemo(() => {
        const fromSearch = params?.get("sort");
        if (fromSearch === "expensive" || fromSearch === "cheapest") {
            return fromSearch;
        }
        if (fromSearch === "newest") {
            return "newest";
        }
        return initialSort;
    }, [params, initialSort]);

    const handleChange = (value: string) => {
        const nextSort: SortOption = value === "expensive" || value === "cheapest" ? value : "newest";
        const current = new URLSearchParams(params?.toString());
        current.delete("sort");
        current.delete("page");
        if (nextSort !== "newest") {
            current.set("sort", nextSort);
        }
        const queryString = current.toString();
        router.push(queryString ? `${pathname}?${queryString}` : pathname || "/");
    };

    return <SelectDropDown
        label="ترتیب"
        value={currentSort}
        options={[
            { label: "جدید ترین", value: "newest" },
            { label: "گران ترین", value: "expensive" },
            { label: "ارزان ترین", value: "cheapest" },
        ]}
        onChange={handleChange}
    />;
}
