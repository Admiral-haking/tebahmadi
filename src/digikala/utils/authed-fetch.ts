import { Get } from "@/utils/fetch";
import { getDgkToken, forceDgkRefreshToken } from "./token";

/**
 * Authenticated Digikala GET that self-heals a 401. The read paths (products /
 * inventory / variants) previously sent the stored token and, if Digikala
 * rejected it (token invalidated server-side despite our local expiry saying it
 * was valid), just 401'd forever — flooding the logs page after page. Now a 401
 * forces one token refresh and retries; a truly-dead refresh still surfaces the
 * "re-authenticate" error, but only once.
 */
export async function dgkAuthedGet<T = unknown>(vendorId: string, url: string): Promise<T> {
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
    try {
        return await Get<T>(url, auth(await getDgkToken(vendorId)));
    } catch (err) {
        if ((err as { status?: number })?.status !== 401) throw err;
        const fresh = await forceDgkRefreshToken(vendorId);
        return await Get<T>(url, auth(fresh));
    }
}
