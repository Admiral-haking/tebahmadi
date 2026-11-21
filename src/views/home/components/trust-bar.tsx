import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import { PackageCheck, PhoneCall, ShieldCheck, Truck } from "lucide-react";
import { BRAND } from "@/config/brand";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

const TRUST_ITEMS = [
    {
        icon: Truck,
        title: "ارسال سراسری با پست پیشتاز",
        description: "تحویل منظم به تمام شهرهای ایران همراه با کد رهگیری پستی",
    },
    {
        icon: ShieldCheck,
        title: "تضمین اصالت و خلوص",
        description: "تأمین مستقیم گیاهان دارویی، روغن‌های پرس سرد و عسل خام بدون افزودنی",
    },
    {
        icon: PackageCheck,
        title: "بسته‌بندی بهداشتی و ایمن",
        description: "بسته‌بندی مقاوم در برابر ضربه، نور و رطوبت برای حفظ عطر و تازگی",
    },
    {
        icon: PhoneCall,
        title: "پشتیبانی تلفنی پاسخ‌گو",
        description: `مشاوره انتخاب محصول و پیگیری سفارش با شماره ${BRAND.phone}`,
    },
];

export default function TrustBar() {
    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, px: { xs: 1.5, sm: 2.5 } }}>
            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                {TRUST_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                            <Stack
                                direction="row"
                                alignItems="flex-start"
                                gap={1.5}
                                sx={{
                                    height: "100%",
                                    p: 2.25,
                                    borderRadius: `${TEB_RADII.lg}px`,
                                    bgcolor: TEB_COLORS.surface,
                                    border: `1px solid ${TEB_COLORS.border}`,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: "14px",
                                        bgcolor: TEB_COLORS.softSurface,
                                        color: TEB_COLORS.primary,
                                        display: "grid",
                                        placeItems: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <Icon size={20} strokeWidth={1.9} />
                                </Box>
                                <Stack spacing={0.4}>
                                    <Typography variant="subtitle2" fontWeight={700} color={TEB_COLORS.textPrimary}>
                                        {item.title}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: TEB_COLORS.textSecondary, lineHeight: 1.65 }}>
                                        {item.description}
                                    </Typography>
                                </Stack>
                            </Stack>
                        </Grid>
                    );
                })}
            </Grid>
        </Container>
    );
}
