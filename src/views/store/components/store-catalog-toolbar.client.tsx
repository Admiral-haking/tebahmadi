"use client";

import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { SearchField } from "@/components/ui/SearchField";
import StoreFilters from "./filters";
import type { StoreCategorySummary, StoreFilterAttribute } from "../data";
import type { StoreViewSearchParams } from "..";

export type StoreCatalogToolbarProps = {
    categories: StoreCategorySummary[];
    activeCategoryPath: string;
    filterAttributes: StoreFilterAttribute[];
    searchParams: StoreViewSearchParams;
};

export function StoreCatalogToolbar({
    categories,
    activeCategoryPath,
    filterAttributes,
    searchParams,
}: StoreCatalogToolbarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const rawSearchParams = useSearchParams();

    const currentSearchQuery = typeof searchParams.q === "string" ? searchParams.q : "";

    const handleSearchSubmit = (value: string) => {
        const params = new URLSearchParams(rawSearchParams?.toString() || "");
        const trimmed = value.trim();
        if (trimmed) {
            params.set("q", trimmed);
        } else {
            params.delete("q");
        }
        params.delete("page");
        const qs = params.toString();
        router.push(`${pathname}${qs ? "?" + qs : ""}`);
    };

    return (
        <Stack spacing={2} sx={{ width: "100%" }}>
            {categories.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        overflowX: "auto",
                        py: 0.5,
                        px: 0.25,
                        scrollbarWidth: "none",
                        "&::-webkit-scrollbar": { display: "none" },
                    }}
                >
                    <CategoryChip
                        label="همه محصولات"
                        href="/store"
                        active={!activeCategoryPath}
                    />
                    {categories.map((cat) => (
                        <CategoryChip
                            key={cat.id}
                            label={cat.name}
                            href={`/store/${cat.path}`}
                            active={activeCategoryPath === cat.path}
                        />
                    ))}
                </Box>
            )}

            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
            >
                <Box sx={{ flex: 1, maxWidth: { sm: 420 } }}>
                    <SearchField
                        defaultValue={currentSearchQuery}
                        placeholder="جست‌وجو در محصولات..."
                        onSubmit={handleSearchSubmit}
                    />
                </Box>
                <StoreFilters
                    attributes={filterAttributes}
                    searchParams={searchParams}
                />
            </Stack>
        </Stack>
    );
}

export default StoreCatalogToolbar;
