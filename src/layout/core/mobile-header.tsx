import Link from "next/link";
import { Box, Stack, Typography } from "@mui/material";
import MegaMenuMobile from "../components/mega-menu-mobile";
import HeaderSearch from "../components/header-search";
import { loadCategoryTree } from "@/lib/cache";
import { BRAND } from "@/config/brand";
import { TEB_COLORS } from "@/theme/tokens";

export default async function HeaderMobile({ title }: { title?: string }) {
    const categories = await loadCategoryTree();

    return (
        <Box
            component="header"
            sx={{
                display: { xs: "block", md: "none" },
                position: "sticky",
                top: 0,
                zIndex: 1050,
                bgcolor: "rgba(249, 248, 246, 0.94)",
                backdropFilter: "blur(10px)",
                borderBottom: `1px solid ${TEB_COLORS.border}`,
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                gap={1}
                sx={{
                    px: 1.5,
                    height: 58,
                }}
            >
                <MegaMenuMobile categories={JSON.parse(JSON.stringify(categories as any))} />

                <Box
                    component={Link}
                    href="/"
                    aria-label={title || BRAND.name}
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.75,
                        textDecoration: "none",
                        flexShrink: 0,
                    }}
                >
                    <Typography
                        variant="subtitle1"
                        sx={{
                            fontWeight: 800,
                            fontSize: "15px",
                            color: TEB_COLORS.primary,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {title || BRAND.name}
                    </Typography>
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <HeaderSearch size="sm" />
                </Box>
            </Stack>
        </Box>
    );
}