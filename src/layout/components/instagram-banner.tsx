import { loadSlides } from "@/lib/cache";
import InstagramBannerCarousel from "./instagram-banner.client";

export default async function InstagramBanner() {
    // Fetch slides on the server so the LCP banner image is present in the SSR
    // HTML instead of waiting for a client-side fetch after hydration.
    let initialSlides: any[] = [];
    try {
        initialSlides = await loadSlides();
    } catch {
        initialSlides = [];
    }
    return <InstagramBannerCarousel initialSlides={initialSlides} />;
}
