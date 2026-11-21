import { Box, Stack, Typography } from "@mui/material";
import AdminHeaderDesktop from "./core/admin-header";
import AdminDrawer from "./core/admin-drawer";
import AdminHeaderMobile from "./core/admin-header-mobile";
import AdminMenu from "./components/admin-menu";

export function LayoutAdmin({ children }: ChildrenProps) {
    return <Box position="relative" sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', maxWidth: 1600, mx: 'auto' }}>
            <Box
                component="aside"
                sx={{
                    display: { xs: 'none', md: 'block' },
                    width: 270,
                    flexShrink: 0,
                    position: 'sticky',
                    top: 100,
                    maxHeight: 'calc(100vh - 120px)',
                    overflowY: 'auto',
                    m: 2,
                    p: 1.5,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 4,
                    boxShadow: '0 14px 40px rgba(42, 90, 68, .07)',
                }}
            >
                <Stack sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
                    <Typography fontWeight={800}>مدیریت طب احمدی</Typography>
                    <Typography variant="caption" color="text.secondary">عملیات فروشگاه</Typography>
                </Stack>
                <AdminMenu />
            </Box>
            <Box sx={{ flex: '1 1 auto', minWidth: 0, pb: { xs: 10, md: 4 } }}>
                <AdminHeaderDesktop />
                {children}
            </Box>
        </Box>
        <AdminHeaderMobile />
        <AdminDrawer />
    </Box>
}
