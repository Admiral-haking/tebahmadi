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
            <Stack direction="row" justifyContent={{ xs: 'center', md: 'start' }} flexWrap="wrap" gap={2} sx={{ my: 4 }}>

                {categories.map(async (category) => (
                    <Button
                        key={category.id}
                        component={Link}
                        href={`/store/${category.path}`}

                        size="small"
                        sx={{ position: 'relative', display: 'block' }}
                    >

                        <Box sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            direction: 'rtl',
                            p: 2,
                            mx: 'auto',
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            bgcolor: 'background.paper'
                        }}>
                            <Image
                                src={category.mediaId ? `/api/media/${category.mediaId}` : '/category.png'}
                                alt={category.name}
                                fill
                                loading="lazy"
                                objectFit="contain"
                                style={{ padding: '1rem' }}
                                unoptimized={true}
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
                                {category.name}
                            </Typography>
                        </Box>
                    </Button>
                ))}
            </Stack>
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
