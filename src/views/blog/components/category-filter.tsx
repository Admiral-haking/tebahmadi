"use client";

import Link from "next/link";
import { Chip, Stack, Typography } from "@mui/material";

import type { BlogCategoryItem, BlogViewSearchParams } from "../data";

type BlogCategoryFilterProps = {
    categories: BlogCategoryItem[];
    selectedCategory: BlogCategoryItem | null;
    searchParams: BlogViewSearchParams;
    allCount: number;
};

function buildHref(rawParams: BlogViewSearchParams, categoryPath: string | null): string {
    const params = new URLSearchParams();
    Object.entries(rawParams).forEach(([key, value]) => {
        if (key === "page" || key === "category") {
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item) => {
                if (typeof item === "string" && item.length > 0) {
                    params.append(key, item);
                }
            });
            return;
        }
        if (typeof value === "string" && value.length > 0) {
            params.set(key, value);
        }
    });

    if (categoryPath) {
        params.set("category", categoryPath);
    }

    const query = params.toString();
    return query.length > 0 ? `/blog?${query}` : "/blog";
}

function renderLabel(name: string, count: number) {
    return (
        <Stack direction="row" alignItems="center" spacing={1} component="span">
            <Typography component="span" variant="body2" fontWeight={600}>
                {name}
            </Typography>
            <Typography component="span" variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
                {count}
            </Typography>
        </Stack>
    );
}

export default function BlogCategoryFilter({
    categories,
    selectedCategory,
    searchParams,
    allCount,
}: BlogCategoryFilterProps) {
    return (
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5}>
            <Chip
                component={Link}
                href={buildHref(searchParams, null)}
                clickable
                label={renderLabel("همه مقالات", allCount)}
                variant={selectedCategory ? "outlined" : "filled"}
                sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 3,
                    bgcolor: selectedCategory ? "rgba(var(--mui-palette-primary-mainChannel) / 0.08)" : "var(--mui-palette-primary-main)",
                    borderColor: selectedCategory
                        ? "rgba(var(--mui-palette-primary-mainChannel) / 0.3)"
                        : "transparent",
                    color: selectedCategory ? "var(--mui-palette-primary-main)" : "var(--mui-palette-primary-contrastText)",
                    "&:hover": {
                        bgcolor: selectedCategory
                            ? "rgba(var(--mui-palette-primary-mainChannel) / 0.16)"
                            : "var(--mui-palette-primary-dark)",
                    },
                }}
            />
            {categories.map((category) => {
                const isSelected = selectedCategory?.id === category.id;
                const baseOpacity = 0.1 + Math.min(category.depth * 0.05, 0.3);
                const hoverOpacity = 0.2 + Math.min(category.depth * 0.04, 0.2);
                return (
                    <Chip
                        key={category.id}
                        component={Link}
                        href={buildHref(searchParams, category.path)}
                        clickable
                        label={renderLabel(category.name, category.count)}
                        variant={isSelected ? "filled" : "outlined"}
                        sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 3,
                            bgcolor: isSelected ? "var(--mui-palette-primary-main)" : `rgba(var(--mui-palette-primary-mainChannel) / ${baseOpacity})`,
                            borderColor: isSelected ? "transparent" : "rgba(var(--mui-palette-primary-mainChannel) / 0.15)",
                            color: isSelected
                                ? "var(--mui-palette-primary-contrastText)"
                                : "var(--mui-palette-primary-main)",
                            boxShadow: isSelected ? "var(--mui-shadows-3)" : "none",
                            "&:hover": {
                                bgcolor: isSelected
                                    ? "var(--mui-palette-primary-dark)"
                                    : `rgba(var(--mui-palette-primary-mainChannel) / ${hoverOpacity})`,
                            },
                        }}
                    />
                );
            })}
        </Stack>
    );
}
