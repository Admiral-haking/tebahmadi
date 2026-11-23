"use client";

import { usePathname } from "next/navigation";
import { Box } from "@mui/material";
import { AnnouncementBar } from "./AnnouncementBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { TEB_COLORS } from "@/theme/tokens";

export type AppShellProps = {
    desktopHeader: React.ReactNode;
    mobileHeader: React.ReactNode;
    footer: React.ReactNode;
    children: React.ReactNode;
};

export function AppShell({
    desktopHeader,
    mobileHeader,
    footer,
    children,
}: AppShellProps) {
    const pathname = usePathname() || "/";
    const isAdmin = pathname.startsWith("/admin");

    if (isAdmin) {
        return <>{children}</>;
    }

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                bgcolor: TEB_COLORS.background,
                color: TEB_COLORS.textPrimary,
                overflowX: "clip",
            }}
        >
            <AnnouncementBar />
            {desktopHeader}
            {mobileHeader}

            <Box
                component="main"
                sx={{
                    flex: 1,
                    position: "relative",
                    pb: { xs: 10, md: 4 },
                }}
            >
                {children}
            </Box>

            <Box sx={{ pb: { xs: 8, md: 0 } }}>
                {footer}
            </Box>

            <MobileBottomNav />
        </Box>
    );
}
