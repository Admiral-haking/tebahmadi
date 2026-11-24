import { Box, Container, Paper, Typography } from "@mui/material";
import AdminHeaderDesktop from "./core/admin-header";
import AdminDrawer from "./core/admin-drawer";
import AdminHeaderMobile from "./core/admin-header-mobile";
import AdminMenu from "./components/admin-menu";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export function LayoutAdmin({ children }: ChildrenProps) {
    return (
        <Box
            position="relative"
            sx={{
                minHeight: "100dvh",
                bgcolor: TEB_COLORS.background,
                pt: { xs: "76px", md: 0 },
                pb: { xs: "calc(76px + env(safe-area-inset-bottom))", md: 4 },
                overflowX: "clip",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 3,
                    maxWidth: 1480,
                    mx: "auto",
                    px: { xs: 0, lg: 2.5 },
                    pt: { xs: 0, lg: 2 },
                }}
            >
                <Paper
                    elevation={0}
                    component="aside"
                    aria-label="ناوبری مدیریت"
                    sx={{
                        display: { xs: "none", lg: "block" },
                        width: 264,
                        flexShrink: 0,
                        position: "sticky",
                        top: 16,
                        maxHeight: "calc(100dvh - 32px)",
                        overflowY: "auto",
                        borderRadius: `${TEB_RADII.lg}px`,
                        border: `1px solid ${TEB_COLORS.border}`,
                        bgcolor: "#FFFFFF",
                        p: 1.5,
                    }}
                >
                    <Box
                        sx={{
                            px: 1.5,
                            py: 1.25,
                            mb: 1,
                            borderRadius: `${TEB_RADII.md}px`,
                            bgcolor: TEB_COLORS.surfaceSoft,
                            border: `1px solid ${TEB_COLORS.border}`,
                        }}
                    >
                        <Typography variant="subtitle2" fontWeight={800} color={TEB_COLORS.primaryDark}>
                            مدیریت طب احمدی
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            پیشخوان فروشگاه و سفارش‌ها
                        </Typography>
                    </Box>
                    <AdminMenu />
                </Paper>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Container maxWidth="lg" sx={{ display: { xs: "none", md: "block" }, px: { lg: 0 } }}>
                        <AdminHeaderDesktop />
                    </Container>
                    <Box component="main" sx={{ minWidth: 0 }}>
                        {children}
                    </Box>
                </Box>
            </Box>
            <AdminHeaderMobile />
            <AdminDrawer />
        </Box>
    );
}
