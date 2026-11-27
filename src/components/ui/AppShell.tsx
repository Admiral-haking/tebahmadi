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
            className="teb-app-shell"
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
              className="teb-app-main"
                sx={{
                    flex: 1,
                    position: "relative",
                    pb: { xs: "calc(84px + env(safe-area-inset-bottom))", md: 4 },
                }}
            >
                {children}
            </Box>

            <Box sx={{ pb: { xs: "calc(24px + env(safe-area-inset-bottom))", md: 0 } }}>
                {footer}
            </Box>

            <MobileBottomNav />
        </Box>
    );
}
