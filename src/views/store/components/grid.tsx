"use server";

import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";

import StoreProductGridClient from "./grid-client";
import { loadStoreProducts } from "./product-loader";
import type { RawSearchParams } from "./search-params";
import type { StoreCategoryContext } from "../data";
import OptimizedImage from "@/components/image";

function serializeSearchParams(
    searchParams: RawSearchParams,
    extras: Record<string, string | string[] | undefined> = {},
): string {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
        if (key === "page" || key === "add") {
            return;
        }
        if (value === undefined) {
            return;
        }
        const values = Array.isArray(value) ? value : [value];
        values
            .map((entry) => `${entry}`.trim())
            .filter((entry) => entry.length > 0)
            .forEach((entry) => params.append(key, entry));
    });
    Object.entries(extras).forEach(([key, value]) => {
        if (value === undefined) {
            return;
        }
        params.delete(key);
        if (Array.isArray(value)) {
            value
                .map((entry) => `${entry}`.trim())
                .filter((entry) => entry.length > 0)
                .forEach((entry) => params.append(key, entry));
            return;
        }
        params.set(key, value);
    });
    return params.toString();
}

function SubcategoryNav({ category }: { category: StoreCategoryContext }) {
    const parent =
        category.breadcrumbs.length > 1
            ? category.breadcrumbs[category.breadcrumbs.length - 2]
            : null;
    const hasChildren = category.children.length > 0;

    if (!hasChildren && !parent) {
        return null;
    }

    return (
        <Stack
            direction="row"
            gap={{ xs: 1.25, sm: 2 }}
            flexWrap="wrap"
            justifyContent={{ xs: 'center', sm: 'flex-start' }}
            alignItems="flex-start"
            sx={{ mb: 3 }}
        >
            {parent && (
                <Button
                    component={Link}
                    href={`/store/${parent.path}`}
                    size="small"
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      color: 'text.primary',
                      p: 0,
                      minWidth: 0,
                      maxWidth: { xs: 96, sm: 112 },
                    }}
                >
                    <Box sx={{
                        position: 'relative',
                        mx: 'auto',
                        width: { xs: 68, sm: 84 },
                        height: { xs: 68, sm: 84 },
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        transition: 'transform 180ms ease',
                        '.MuiButton-root:hover &': {
                          transform: 'scale(1.05)',
                        },
                    }}>
                        <OptimizedImage
                            src="/tebahmadi-mark.svg"
                            alt={parent.name}
                            fill
                            loading="lazy"
                            style={{ objectFit: 'cover' }}
                        />
                    </Box>


                    <Box sx={{
                        textAlign: 'center',
                        '& *': {
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%'
                        }
                    }}>
                        <Typography variant="body2" component="p">
                            بازگشت به {parent.name}
                        </Typography>
                    </Box>
                </Button>
            )}

            {category.children.map((child) => (
                <Button
                    key={child.id}
                    component={Link}
                    href={`/store/${child.path}`}
                    size="small"
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      color: 'text.primary',
                      p: 0,
                      minWidth: 0,
                      maxWidth: { xs: 96, sm: 112 },
                    }}
                >

                    <Box sx={{
                        position: 'relative',
                        mx: 'auto',
                        width: { xs: 68, sm: 84 },
                        height: { xs: 68, sm: 84 },
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        transition: 'transform 180ms ease',
                        '.MuiButton-root:hover &': {
                          transform: 'scale(1.05)',
                        },
                    }}>
                        <OptimizedImage
                            src="/tebahmadi-mark.svg"
                            alt={child.name}
                            fill
                            loading="lazy"
                            style={{ objectFit: 'cover' }}
                        />
                    </Box>


                    <Box sx={{
                        textAlign: 'center',
                        '& *': {
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%'
                        }
                    }}>
                        <Typography variant="body2" component="p">
                            {child.name}
                        </Typography>
                    </Box>
                </Button>
            ))}
        </Stack>
    );
}

export default async function StoreProductGrid({
    searchParams,
    category,
}: {
    searchParams: RawSearchParams;
    category: StoreCategoryContext;
}) {
    const productTypeIds = category.productTypeIds;

    const context = {
        activeCategoryId: category.active.id,
        productTypeIds,
    };

    const { products, pages, currentPage } = await loadStoreProducts(searchParams, context);

    if (products.length === 0) {
        return (
            <Stack spacing={3} alignItems="center" sx={{ py: 8 }}>
                <SubcategoryNav category={category} />
                <Typography variant="h6" color="text.secondary">
                    محصولی یافت نشد
                </Typography>
            </Stack>
        );
    }

    const initialQueryString = serializeSearchParams(searchParams, {
        categoryId: category.active.id,
        productTypeId: productTypeIds,
    });

    return (
        <Stack spacing={3}>
            <SubcategoryNav category={category} />
            <StoreProductGridClient
                initialProducts={products}
                initialPage={currentPage}
                totalPages={pages}
                initialQueryString={initialQueryString}
            />
        </Stack>
    );
}
