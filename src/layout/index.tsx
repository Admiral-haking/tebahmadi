"use server";

import HeaderDesktop from "./core/desktop-header";
import HeaderMobile from "./core/mobile-header";
import Footer from "./core/footer";
import { AppShell } from "@/components/ui/AppShell";
import { loadSiteInfo } from "@/lib/cache";
import { BRAND } from "@/config/brand";

export default async function Layout({ children }: ChildrenProps) {
    const siteInfo = await loadSiteInfo();

    return (
        <AppShell
            desktopHeader={<HeaderDesktop />}
            mobileHeader={<HeaderMobile title={siteInfo?.appName || BRAND.name} />}
            footer={<Footer />}
        >
            {children}
        </AppShell>
    );
}