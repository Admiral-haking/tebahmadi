/**
 * Connection settings for the Holoo (هلو) accounting web service.
 *
 * The web service is an on-prem IIS app reachable at
 *   http://{ip}:8080/TncHolo0/api
 * so unlike the marketplace integrations there is a single connection, driven
 * entirely by env vars:
 *   HOLOO_BASE_URL  – full base address incl. /TncHolo0/api (no trailing slash)
 *   HOLOO_USERNAME  – Holoo login username
 *   HOLOO_PASSWORD  – Holoo login password (plain text; base64-encoded on send)
 *   HOLOO_DBNAME    – Holoo database name (e.g. Holoo1)
 */

export type HolooConfig = {
    baseUrl: string;
    username: string;
    password: string;
    dbname: string;
};

/** A single, fixed key — there is only one Holoo connection per deployment. */
export const HOLOO_CONNECTION_ID = "default";

export function isHolooConfigured(): boolean {
    return Boolean(
        process.env.HOLOO_BASE_URL &&
        process.env.HOLOO_USERNAME &&
        process.env.HOLOO_PASSWORD &&
        process.env.HOLOO_DBNAME,
    );
}

/**
 * Read the Holoo connection settings, throwing a user-facing Persian error when
 * something is missing so the status endpoint can surface it cleanly.
 */
export function getHolooConfig(): HolooConfig {
    const baseUrl = (process.env.HOLOO_BASE_URL || "").trim().replace(/\/+$/, "");
    const username = (process.env.HOLOO_USERNAME || "").trim();
    const password = process.env.HOLOO_PASSWORD || "";
    const dbname = (process.env.HOLOO_DBNAME || "").trim();

    const missing: string[] = [];
    if (!baseUrl) missing.push("HOLOO_BASE_URL");
    if (!username) missing.push("HOLOO_USERNAME");
    if (!password) missing.push("HOLOO_PASSWORD");
    if (!dbname) missing.push("HOLOO_DBNAME");

    if (missing.length) {
        const error = new Error(
            `تنظیمات اتصال به هلو کامل نیست. متغیرهای محیطی زیر را تنظیم کنید: ${missing.join(", ")}`,
        );
        (error as any).status = 503;
        (error as any).code = "HOLOO_NOT_CONFIGURED";
        throw error;
    }

    return { baseUrl, username, password, dbname };
}

/** Holoo expects the password base64-encoded ("Base14Encode" in their docs). */
export function encodeHolooPassword(password: string): string {
    return Buffer.from(password, "utf8").toString("base64");
}
