import Script from "next/script";
import SmartPopup from "@/components/smart-popup/SmartPopup";
import CartRecoveryPrompt from "@/components/cart/CartRecoveryPrompt";
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
            <CartRecoveryPrompt />
            <SmartPopup config={config?.smartPopup ?? null} />
            <Script id="dartamas-chat-widget" strategy="afterInteractive">
                {`(function () { function loadChatWidget() { if (document.getElementById('7Hqdkw')) { return; } var script = document.createElement('script'); script.id = '7Hqdkw'; script.src = 'https://my.dartamas.com/chatButtonModule.js?t=' + Date.now(); script.setAttribute('data-url', 'sipOnline'); script.setAttribute('data-no-minify', '1'); script.setAttribute('data-nowprocket', '1'); script.setAttribute('data-no-defer', '1'); script.setAttribute('data-cfasync', 'false'); script.setAttribute('data-noptimize', '1'); script.setAttribute('data-pagespeed-no-defer', ''); document.body.appendChild(script); } if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', loadChatWidget, { once: true }); } else { loadChatWidget(); } })();`}
            </Script>
        </>
    );
}
