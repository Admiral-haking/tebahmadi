"use server";

import { Box, Divider } from "@mui/material";
import HeaderDesktop from "./core/desktop-header";
import HeaderMobile from "./core/mobile-header";
import Footer from "./core/footer";
import { loadSiteInfo } from "@/lib/cache";

export default async function Layout({ children }: ChildrenProps) {
    const site_info = await loadSiteInfo();

    return <Box sx={{ width: '100%' }}>
        <HeaderDesktop />
        <HeaderMobile title={site_info?.appName || ""} />
        <Box
            sx={{
                position: 'relative'
            }}
            component="main">
            {children}

            <Divider sx={{ my: 4 }} />
            <Footer />
        </Box>
    </Box>
}