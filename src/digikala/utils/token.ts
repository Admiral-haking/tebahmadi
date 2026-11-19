import { getServiceInfo } from "@/settings/services/servicesService";
import { dgk_auth_refresh_token } from "../services/auth";
import { assertDgkAuthNotDead, clearDgkAuthDead, markDgkAuthDead } from "./auth-state";

type Token = {
    "access_token": string,
    "refresh_token": string,
    "access_token_expires_at": {
        "date": string,
        "timezone_type": number,
        "timezone": "Asia/Tehran"
    },
    "refresh_token_expires_at": {
        "date": string,
        "timezone_type": 3,
        "timezone": "Asia/Tehran"
    }
}
/**
 * Digikala returns token expiry as "YYYY-MM-DD HH:mm:ss.ffffff" in Asia/Tehran
 * with NO timezone offset. `new Date(...)` parses that as the SERVER's local
 * time, so on a UTC server the access token looked valid ~3.5h longer than it
 * actually was — we kept sending an expired token and Digikala replied
 * "Token expired" instead of us refreshing in time. Parse it explicitly as
 * Tehran time (+03:30, fixed — Iran dropped DST in 2022).
 */
function parseTehranDate(raw?: string): number {
    if (!raw || typeof raw !== "string") return NaN;
    let s = raw.trim().replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += "+03:30";
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : NaN;
}

export async function getDgkToken(vendorId: string) {
    assertDgkAuthNotDead(vendorId);

    const token = await getServiceInfo<Token>("dgk", "auth_token", vendorId);

    if (!token) throw new Error("no token found for digikala!");

    const { access_token, access_token_expires_at, refresh_token, refresh_token_expires_at } = token;

    const accessExpiry = parseTehranDate(access_token_expires_at?.date);
    // Refresh a bit early; if the expiry is unparseable, refresh rather than risk
    // sending a dead token.
    if (Number.isFinite(accessExpiry) && accessExpiry - 6e4 * 5 > Date.now()) {
        clearDgkAuthDead(vendorId);
        return access_token;
    }

    const refresh_time = parseTehranDate(refresh_token_expires_at?.date);

    if (Number.isFinite(refresh_time) && refresh_time < Date.now()) {
        markDgkAuthDead(vendorId);
        throw new Error("you need to validate your digikala again. tokens expired!");
    }

    try {
        const res = await dgk_auth_refresh_token({ access_token, refresh_token }, vendorId);
        clearDgkAuthDead(vendorId);
        return res.access_token;
    } catch (err) {
        markDgkAuthDead(vendorId);
        throw err;
    }
}
export async function forceDgkRefreshToken(vendorId: string) {
    const token = await getServiceInfo<Token>("dgk", "auth_token", vendorId);

    if (!token) throw new Error("no token found for digikala!");

    const { access_token, refresh_token, refresh_token_expires_at } = token;

    const refresh_time = parseTehranDate(refresh_token_expires_at?.date);

    if (Number.isFinite(refresh_time) && refresh_time < Date.now()) {
        markDgkAuthDead(vendorId);
        throw new Error("you need to validate your digikala again. tokens expired!");
    }

    try {
        const res = await dgk_auth_refresh_token({ access_token, refresh_token }, vendorId);
        clearDgkAuthDead(vendorId);
        return res.access_token;
    } catch (err) {
        markDgkAuthDead(vendorId);
        throw err;
    }
}