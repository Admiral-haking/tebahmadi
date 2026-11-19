import Script from "next/script";
import SmartPopup from "@/components/smart-popup/SmartPopup";
import { getSiteConfig } from "@/settings/services/settingsService";

export const dynamic = "force-dynamic";

export default async function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const config = await getSiteConfig();

    return (
        <>
            {children}
            <SmartPopup config={config?.smartPopup ?? null} />
            <Script id="goftino-loader" strategy="lazyOnload">
                {`(function(){var loaded=false;function inject(){if(loaded)return;loaded=true;var s=document.createElement("script");s.src="/goftino.js";s.async=true;document.body.appendChild(s);}if("requestIdleCallback" in window){window.requestIdleCallback(inject,{timeout:5000});}else{setTimeout(inject,3500);}window.addEventListener("pointerdown",inject,{once:true,passive:true});window.addEventListener("keydown",inject,{once:true});})();`}
            </Script>
        </>
    );
}
