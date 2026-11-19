/**
 * Holoo renders Persian/Arabic-Indic digit glyphs (۰-۹ / ٠-٩) as "؟" — its
 * fields only display Western digits. We build several strings with Persian
 * digits (e.g. Jalali dates from Intl `fa-IR`, locale-formatted amounts), so any
 * string sent to Holoo must have its digits down-converted to ASCII first.
 *
 * Only the digit characters are converted — Persian letters are left untouched,
 * so the text stays Persian; just the numerals become renderable.
 */

const PERSIAN_ZERO = 0x06f0; // ۰..۹
const ARABIC_ZERO = 0x0660; // ٠..٩

/** Convert every Persian/Arabic-Indic digit in a string to its ASCII form. */
export function toLatinDigits(input: string): string {
    let out = "";
    for (const ch of input) {
        const code = ch.codePointAt(0)!;
        if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) {
            out += String(code - PERSIAN_ZERO);
        } else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) {
            out += String(code - ARABIC_ZERO);
        } else {
            out += ch;
        }
    }
    return out;
}

/**
 * Recursively walk a JSON-serialisable value and convert Persian/Arabic digits
 * to ASCII in every string. Used on the request body just before it is sent to
 * Holoo so numbers never arrive as "؟".
 */
export function latinizeHolooPayload<T>(value: T): T {
    if (typeof value === "string") return toLatinDigits(value) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => latinizeHolooPayload(v)) as unknown as T;
    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = latinizeHolooPayload(v);
        }
        return out as unknown as T;
    }
    return value;
}
