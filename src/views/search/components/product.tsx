import { Box, Chip, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { ProductSearchItem } from "../loaders";
import Link from "next/link";
import Image from "next/image";

function formatPrice(price: number): string {
    return new Intl.NumberFormat('fa-IR').format(price);
}

export default function ProductSearchLink({
    title, slug, minPrice, maxPrice, images,
    inventoryTotal, activeInStockVariantCount,
}: ProductSearchItem) {
    const firstImage = images.find((image) => {
        const value = image.trim();
        return Boolean(value) && !/(^|[\\/])(?:undefined|null)(?:[/?#]|$)/i.test(value);
    });
    const inStock = (activeInStockVariantCount ?? 0) > 0 || inventoryTotal > 0;

    const priceDisplay = (() => {
        if (minPrice === undefined || maxPrice === undefined) return null;
        if (minPrice === maxPrice) return `${formatPrice(maxPrice)} تومان`;
        return `${formatPrice(minPrice)} ~ ${formatPrice(maxPrice)} تومان`;
    })();

    return (
        <Box
            component={Link}
            href={`/product/${slug}`}
            sx={{ display: 'block', textDecoration: 'none' }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    transition: 'border-color .15s, background-color .15s',
                    '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                    },
                }}
            >
                <Stack direction="row" alignItems="center" gap={2}>
                    {firstImage ? (
                        <Box
                            sx={{
                                width: 72,
                                height: 72,
                                borderRadius: 1.5,
                                overflow: 'hidden',
                                flexShrink: 0,
                                bgcolor: 'grey.100',
                            }}
                        >
                            <Image
                                src={firstImage}
                                width={72}
                                height={72}
                                alt={title}
                                loading="lazy"
                                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                            />
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                width: 72,
                                height: 72,
                                borderRadius: 1.5,
                                bgcolor: 'grey.100',
                                flexShrink: 0,
                            }}
                        />
                    )}
                    <Box flex={1} minWidth={0}>
                        <Typography
                            variant="body1"
                            fontWeight={500}
                            color="text.primary"
                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                            {title}
                        </Typography>
                        {priceDisplay && (
                            <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ mt: 0.5 }}>
                                {priceDisplay}
                            </Typography>
                        )}
                        <Box sx={{ mt: 0.75 }}>
                            <Chip
                                label={inStock ? 'موجود' : 'ناموجود'}
                                color={inStock ? 'success' : 'default'}
                                size="small"
                            />
                        </Box>
                    </Box>
                </Stack>
            </Paper>
        </Box>
    );
}

export function ProductSearchLinkPlaceholder() {
    return (
        <Paper
            elevation={0}
            sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
        >
            <Stack direction="row" alignItems="center" gap={2}>
                <Skeleton variant="rounded" width={72} height={72} sx={{ flexShrink: 0 }} />
                <Box flex={1}>
                    <Skeleton variant="text" width="60%" height={24} />
                    <Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} />
                    <Skeleton variant="rounded" width={60} height={22} sx={{ mt: 0.75 }} />
                </Box>
            </Stack>
        </Paper>
    );
}
