/**
 * Digikala Image Utilities
 * 
 * This module provides functions for fetching, downloading, and uploading
 * product images from Digikala. All image downloads happen server-side
 * via the /api/media/upload-by-url endpoint to avoid CORS issues.
 */

export interface MediaUploadResult {
    id: string;
    kind: string;
    scope: string;
    filename: string;
    contentType: string;
    groupId: string;
    originalId: string;
}

/**
 * Upload an image from a URL to the media system via server-side proxy
 * This avoids CORS issues since the download happens on the server
 */
async function uploadImageFromUrl(imageUrl: string, scope: string = "attachment"): Promise<MediaUploadResult> {
    const formData = new FormData();
    formData.append("url", imageUrl);
    formData.append("scope", scope);

    const query = new URLSearchParams({ scope }).toString();

    const response = await fetch(`/api/media/upload-by-url?${query}`, {
        method: "POST",
        body: formData,
        credentials: "include",
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as any)?.error || `Upload from URL failed: HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!(json as any)?.media?.id) throw new Error("Malformed upload response");
    return (json as any).media;
}

/**
 * Fetch all product gallery images from Digikala's public API
 * Returns image URLs grouped by type
 */
export async function fetchProductImages(productId: number | string): Promise<{
    gallery: string[];
    count: number;
    title: string;
    brand: string;
}> {
    const response = await fetch(`/api/digikala/products/${productId}/images`);
    if (!response.ok) throw new Error("Failed to fetch product images");
    const data = await response.json();
    return {
        gallery: (data as any).gallery?.all || [],
        count: (data as any).count || 0,
        title: (data as any).title || '',
        brand: (data as any).brand || '',
    };
}

/**
 * Download an image from URL and upload it to the media system (server-side)
 * Returns the media ID
 */
export async function downloadAndUploadImage(imageUrl: string): Promise<string> {
    const cleanUrl = imageUrl.split('?')[0].split('#')[0];
    if (!cleanUrl) throw new Error("Empty image URL");
    
    try {
        const media = await uploadImageFromUrl(cleanUrl);
        return media.id;
    } catch (error) {
        console.error(`Failed to process image: ${cleanUrl}`, error);
        throw error;
    }
}

/**
 * Download and upload multiple images sequentially
 * Returns array of successfully uploaded media IDs
 */
export async function downloadAndUploadImages(imageUrls: string[]): Promise<string[]> {
    const mediaIds: string[] = [];
    
    for (const url of imageUrls) {
        if (!url) continue;
        try {
            const id = await downloadAndUploadImage(url);
            mediaIds.push(id);
        } catch (error) {
            console.error(`Failed to upload image: ${url}`, error);
        }
    }
    
    return mediaIds;
}

/**
 * Download and upload multiple images in parallel (up to 3 at a time)
 * Returns array of successfully uploaded media IDs
 */
export async function downloadAndUploadImagesParallel(imageUrls: string[], concurrency: number = 3): Promise<string[]> {
    const mediaIds: string[] = [];
    const chunks: string[][] = [];
    
    // Split into chunks of `concurrency` size
    for (let i = 0; i < imageUrls.length; i += concurrency) {
        chunks.push(imageUrls.slice(i, i + concurrency));
    }
    
    for (const chunk of chunks) {
        const results = await Promise.allSettled(
            chunk.map(url => downloadAndUploadImage(url))
        );
        for (const result of results) {
            if (result.status === 'fulfilled') {
                mediaIds.push(result.value);
            }
        }
    }
    
    return mediaIds;
}

/**
 * Process a single variant image - download and upload
 * Returns media ID or null if failed
 */
export async function processVariantImage(imageSrc: string): Promise<string | null> {
    try {
        if (!imageSrc) return null;
        return await downloadAndUploadImage(imageSrc);
    } catch {
        return null;
    }
}

/**
 * Analyze product images using AI vision (OpenAI)
 * Returns analysis results for better product understanding
 */
export async function analyzeImageWithAI(imageUrl: string): Promise<string> {
    try {
        const response = await fetch("/api/ai/analyze-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                imageUrl,
                prompt: "Describe this product in detail for an e-commerce catalog. Include: product type, material, color, shape, style, any visible features, patterns, textures, and how you would describe this in Persian for an online store."
            })
        });
        
        // Image analysis is optional in the import flow. If it's disabled or
        // unavailable, just skip it quietly (no noisy error) — the rest of the
        // conversion proceeds without it.
        if (!response.ok) return "";
        const data = await response.json();
        return (data as any).analysis || "";
    } catch {
        return "";
    }
}
