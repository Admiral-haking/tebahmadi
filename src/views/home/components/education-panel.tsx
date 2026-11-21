import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { BookOpen, CheckCircle, ArrowLeft } from "lucide-react";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export type EducationPanelProps = {
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    href?: string;
};

const EDUCATION_TIPS = [
    {
        title: "روش اصولی دم‌آوری دمنوش‌ها",
        desc: "به جای جوشاندن طولانی، از آب جوشیده با دمای ۸۰-۸۵ درجه و درب بسته استفاده کنید تا اسانس و عطر فرار گیاه حفظ شود.",
    },
    {
        title: "نگهداری روغن‌ها و عصاره‌های گیاهی",
        desc: "روغن‌های بکر و عرقیات طبیعی را همیشه در جای خنک، خشک و در شیشه‌های مات دور از تابش مستقیم آفتاب نگهداری کنید.",
    },
    {
        title: "تشخیص اصالت عسل طبیعی",
        desc: "عسل خالص و طبیعی به مرور زمان رس می‌بندد؛ این فرآیند طبیعی نشانه‌ای از عدم حرارت‌دیدگی و حفظ آنزیم‌های فعال است.",
    },
];

export default function EducationPanel({
    title = "راهنمای اصولی مصرف و نگهداری گیاهان دارویی",
    subtitle = "چگونه عطر، خواص و تازگی دمنوش‌ها، روغن‌ها و عرقیات را حفظ کنیم؟",
    ctaLabel = "مطالعه راهنما در مجله",
    href = "/blog",
}: EducationPanelProps) {
    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 1.5, sm: 2.5 } }}>
            <Box
                sx={{
                    borderRadius: `${TEB_RADII.panel}px`,
                    bgcolor: TEB_COLORS.softSurface,
                    border: `1px solid ${TEB_COLORS.border}`,
                    p: { xs: 2.5, sm: 4, md: 5 },
                }}
            >
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={{ xs: 3.5, md: 5 }}
                    alignItems="center"
                >
                    <Box
                        sx={{
                            flex: { xs: "none", md: "0 0 42%" },
                            width: "100%",
                            aspectRatio: { xs: "16 / 10", sm: "4 / 3", md: "1 / 1" },
                            position: "relative",
                            borderRadius: `${TEB_RADII.lg}px`,
                            overflow: "hidden",
                            border: `1px solid ${TEB_COLORS.border}`,
                        }}
                    >
                        <Image
                            src="/images/tebahmadi/education-panel.jpg"
                            alt="راهنمای مصرف و نگهداری گیاهان دارویی"
                            fill
                            sizes="(max-width: 900px) 100vw, 420px"
                            style={{ objectFit: "cover" }}
                        />
                    </Box>

                    <Stack spacing={2.5} sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.75,
                                px: 1.75,
                                py: 0.5,
                                borderRadius: "9999px",
                                bgcolor: "rgba(42, 90, 68, 0.08)",
                                color: TEB_COLORS.primary,
                                width: "fit-content",
                            }}
                        >
                            <BookOpen size={15} />
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                آموزش و سلامت
                            </Typography>
                        </Box>

                        <Typography
                            component="h2"
                            sx={{
                                fontSize: { xs: "20px", sm: "24px", md: "28px" },
                                fontWeight: 800,
                                color: TEB_COLORS.primaryDark,
                            }}
                        >
                            {title}
                        </Typography>

                        {subtitle && (
                            <Typography variant="body2" sx={{ color: TEB_COLORS.textSecondary, lineHeight: 1.8 }}>
                                {subtitle}
                            </Typography>
                        )}

                        <Stack spacing={2} sx={{ pt: 1 }}>
                            {EDUCATION_TIPS.map((tip, idx) => (
                                <Stack key={idx} direction="row" spacing={1.5} alignItems="flex-start">
                                    <CheckCircle
                                        size={18}
                                        color={TEB_COLORS.primary}
                                        style={{ flexShrink: 0, marginTop: 3 }}
                                    />
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: TEB_COLORS.textPrimary }}>
                                            {tip.title}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: TEB_COLORS.textSecondary, lineHeight: 1.7 }}>
                                            {tip.desc}
                                        </Typography>
                                    </Box>
                                </Stack>
                            ))}
                        </Stack>

                        <Box sx={{ pt: 1.5 }}>
                            <Button
                                component={Link}
                                href={href}
                                variant="outlined"
                                endIcon={<ArrowLeft size={16} />}
                                sx={{
                                    borderColor: TEB_COLORS.primary,
                                    color: TEB_COLORS.primary,
                                    minHeight: 44,
                                    px: 3,
                                    "&:hover": {
                                        bgcolor: TEB_COLORS.primary,
                                        color: "#FFFFFF",
                                    },
                                }}
                            >
                                {ctaLabel}
                            </Button>
                        </Box>
                    </Stack>
                </Stack>
            </Box>
        </Container>
    );
}
