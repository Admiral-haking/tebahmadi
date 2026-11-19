import { Box, Container } from "@mui/material";
import AdminHeaderDesktop from "./core/admin-header";
import AdminDrawer from "./core/admin-drawer";
import AdminHeaderMobile from "./core/admin-header-mobile";

export function LayoutAdmin({ children }: ChildrenProps) {
    return <Box position="relative">
        <Box>
            <Container maxWidth="lg" sx={{ display: { xs: 'none', md: 'block' } }}>
                <AdminHeaderDesktop />
            </Container>
            {children}
        </Box>
        <AdminHeaderMobile />
        <AdminDrawer />
    </Box>
}
