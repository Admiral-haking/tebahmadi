"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Container, IconButton, Stack, Typography } from "@mui/material";
import { Truck, X } from "lucide-react";
import { TEB_COLORS } from "@/theme/tokens";

export type AnnouncementBarProps = {
    message?: string;
    href?: string;
    ctaLabel?: string;
};

export function AnnouncementBar({
    message = "ارسال سریع با پست پیشتاز به سراسر کشور — بسته‌بندی ایمن و تازه گیاهان دارویی طب احمدی",
    href = "/store",
    ctaLabel = "مشاهده محصولات",
}: AnnouncementBarProps) {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    return (
        <Box
            role="region"
            aria-label="اعلان فروشگاه"
            sx={{
                bgcolor: TEB_COLORS.primaryDark,
                color: "#FFFFFF",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
        >
            <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2.5 } }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    sx={{ minHeight: 36, py: 0.5 }}
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="center"
                        gap={1}
                        sx={{ flex: 1, minWidth: 0 }}
                    >
                        <Truck size={15} strokeWidth={2} style={{ flexShrink: 0, color: TEB_COLORS.gold }} />
                        <Typography
                            variant="caption"
                            noWrap
                            sx={{
                                fontSize: { xs: "11.5px", sm: "12.5px" },
                                fontWeight: 500,
                                color: "#F4F3E5",
                            }}
                        >
                            {message}
                        </Typography>
                        {href && (
                            <Box
                                component={Link}
                                href={href}
                                sx={{
                                    display: { xs: "none", md: "inline-flex" },
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: TEB_COLORS.gold,
                                    textDecoration: "underline",
                                    textUnderlineOffset: "3px",
                                    flexShrink: 0,
                                }}
                            >
                                {ctaLabel}
                            </Box>
                        )}
                    </Stack>

                    <IconButton
                        size="small"
                        onClick={() => setDismissed(true)}
                        aria-label="بستن اعلان"
                        sx={{
                            color: "rgba(255,255,255,0.78)",
                            width: 28,
                            height: 28,
                            flexShrink: 0,
                            "&:hover": { color: "#FFFFFF", bgcolor: "rgba(255,255,255,0.1)" },
                        }}
                    >
                        <X size={15} />
                    </IconButton>
                </Stack>
            </Container>
        </Box>
    );
}
