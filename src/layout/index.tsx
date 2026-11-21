"use server";

import { Box, Divider } from "@mui/material";
import HeaderDesktop from "./core/desktop-header";
import HeaderMobile from "./core/mobile-header";
import Footer from "./core/footer";
import { loadSiteInfo } from "@/lib/cache";
import { AnnouncementBar, MobileBottomNav } from "./components/storefront-chrome";

export default async function Layout({ children }: ChildrenProps) {
    const site_info = await loadSiteInfo();

    return <Box sx={{ width: '100%', pb: { xs: 10, md: 0 } }}>
        <AnnouncementBar />
        <HeaderDesktop />
        <HeaderMobile title={site_info?.appName || ""} />
        <Box
            sx={{
                position: 'relative'
            }}
            component="main">
            {children}

            <Footer />
        </Box>
        <MobileBottomNav />
    </Box>
}
