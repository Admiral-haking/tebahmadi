import Image from "next/image";
import Link from "next/link";
import { Box, Container, Stack, Typography } from "@mui/material";
import { Coffee, Droplets, Flame, FlaskConical, Leaf, Sparkles } from "lucide-react";
import { loadRootCategories } from "@/views/store/data";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TEB_COLORS } from "@/theme/tokens";

function resolveCategoryIcon(slug: string, name: string) {
    const key = `${slug} ${name}`.toLowerCase();
    if (key.includes("tea") || key.includes("دمنوش")) return Coffee;
    if (key.includes("oil") || key.includes("روغن")) return Droplets;
    if (key.includes("honey") || key.includes("عسل")) return Sparkles;
    if (key.includes("distill") || key.includes("عرق")) return FlaskConical;
    if (key.includes("spice") || key.includes("زعفران") || key.includes("ادویه")) return Flame;
    return Leaf;
}

export default async function Categories({
    title = "دسته‌بندی محصولات طبیعی",
    subtitle = "انتخاب سریع میان گیاهان دارویی، دمنوش‌ها، روغن‌ها و فرآورده‌های خالص",
}: {
    siteInfo?: unknown;
    title?: string;
    subtitle?: string;
}) {
    const categories = await loadRootCategories();
    if (!categories || categories.length === 0) return null;

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4.5 }, px: { xs: 1.5, sm: 2.5 } }}>
            <SectionHeader title={title} subtitle={subtitle} href="/store" ctaLabel="همه دسته‌ها" />

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "repeat(3, minmax(0, 1fr))",
                        sm: "repeat(3, minmax(0, 1fr))",
                        md: "repeat(6, minmax(0, 1fr))",
                    },
                    gap: { xs: 1.5, sm: 2 },
                }}
            >
                {categories.slice(0, 12).map((category) => {
                    const Icon = resolveCategoryIcon(category.slug, category.name);
                    return (
                        <Stack
                            key={category.id}
                            component={Link}
                            href={`/store/${category.path}`}
                            alignItems="center"
                            spacing={1.25}
                            sx={{
                                p: { xs: 1.5, sm: 2 },
                                borderRadius: "24px",
                                bgcolor: TEB_COLORS.surface,
                                border: `1px solid ${TEB_COLORS.border}`,
                                textDecoration: "none",
                                transition: "border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease",
                                "&:hover": {
                                    borderColor: TEB_COLORS.primary,
                                    bgcolor: TEB_COLORS.softSurface,
                                    transform: "translateY(-2px)",
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    width: { xs: 56, sm: 68 },
                                    height: { xs: 56, sm: 68 },
                                    borderRadius: "50%",
                                    overflow: "hidden",
                                    position: "relative",
                                    display: "grid",
                                    placeItems: "center",
                                    bgcolor: TEB_COLORS.softSurface,
                                    border: `1px solid ${TEB_COLORS.border}`,
                                    color: TEB_COLORS.primary,
                                }}
                            >
                                {category.mediaId ? (
                                    <Image
                                        src={`/api/media/${category.mediaId}`}
                                        alt={category.name}
                                        fill
                                        sizes="68px"
                                        style={{ objectFit: "cover" }}
                                    />
                                ) : (
                                    <Icon size={26} strokeWidth={1.7} />
                                )}
                            </Box>
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: 700,
                                    fontSize: { xs: "12.5px", sm: "13.5px" },
                                    color: TEB_COLORS.textPrimary,
                                    textAlign: "center",
                                    lineHeight: 1.4,
                                }}
                            >
                                {category.name}
                            </Typography>
                        </Stack>
                    );
                })}
            </Box>
        </Container>
    );
}
