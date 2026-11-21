import Link from "next/link";
import type { Metadata } from "next";

import { Box, Button, Card, CardActionArea, CardContent, Container, Grid, Stack, Typography } from "@mui/material";

import { loadRootCategories } from "@/views/store/data";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import Image from "next/image";
import MediaModel from "@/models/Media";

export const experimental_ppr = true;

export async function generateMetadata(): Promise<Metadata> {
    const { metadata } = await generatePageMetadata({ slug: "/store" });
    return metadata;
}

export default async function Page() {
    const categories = await loadRootCategories();

    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            <Box sx={{ textAlign: "center", mb: 4 }}>
                <Typography variant="h4" gutterBottom>
                    دسته‌بندی‌های فروشگاه
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    برای شروع، یکی از دسته‌بندی‌های اصلی را انتخاب کنید تا محصولات مرتبط نمایش داده شوند.
                </Typography>
            </Box>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "repeat(3, minmax(0, 1fr))",
                        sm: "repeat(4, minmax(0, 1fr))",
                        md: "repeat(6, minmax(0, 1fr))",
                    },
                    gap: { xs: 1.5, sm: 2, md: 2.5 },
                    my: 4,
                }}
            >
                {categories.map((category) => (
                    <Button
                        key={category.id}
                        component={Link}
                        href={`/store/${category.path}`}
                        size="small"
                        sx={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            textTransform: "none",
                            color: "text.primary",
                            p: 0,
                            minWidth: 0,
                            "&:hover .store-category-icon": {
                                transform: "translateY(-3px)",
                                borderColor: "primary.main",
                            },
                        }}
                    >
                        <Box
                            className="store-category-icon"
                            sx={{
                                position: "relative",
                                width: "100%",
                                aspectRatio: "1 / 1",
                                maxWidth: { xs: 80, sm: 96, md: 104 },
                                borderRadius: "50%",
                                overflow: "hidden",
                                mb: 1,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: "background.paper",
                                transition: "transform 180ms ease, border-color 180ms ease",
                            }}
                        >
                            <Image
                                src={category.mediaId ? `/api/media/${category.mediaId}` : "/category.png"}
                                alt={category.name}
                                fill
                                loading="lazy"
                                style={{ objectFit: "contain", padding: "16%" }}
                                unoptimized={true}
                            />
                        </Box>

                        <Typography
                            variant="body2"
                            component="p"
                            sx={{
                                textAlign: "center",
                                width: "100%",
                                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                                fontWeight: 500,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {category.name}
                        </Typography>
                    </Button>
                ))}
            </Box>
            <Grid container gap={2}>
                {categories.length === 0 && (
                    <Grid size={{ xs: 12 }}>
                        <Box
                            sx={{
                                py: 6,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 2,
                            }}
                        >
                            <Typography variant="h6">
                                هنوز دسته‌بندی‌ای در فروشگاه فعال نشده است.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                برای مشاهده محصولات ابتدا از بخش مدیریت دسته‌بندی ایجاد کنید.
                            </Typography>
                        </Box>
                    </Grid>
                )}
            </Grid>
        </Container>
    );
}
