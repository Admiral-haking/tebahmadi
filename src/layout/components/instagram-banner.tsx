import { listSlides } from "@/content/services/slideService";
import InstagramBannerCarousel from "./instagram-banner.client";

export default async function InstagramBanner() {
    // Fetch slides on the server so the LCP banner image is present in the SSR
    // HTML instead of waiting for a client-side fetch after hydration.
    let initialSlides: Awaited<ReturnType<typeof listSlides>> = [];
    try {
        initialSlides = await listSlides();
    } catch {
        initialSlides = [];
    }
    return <InstagramBannerCarousel initialSlides={initialSlides} />;
}
