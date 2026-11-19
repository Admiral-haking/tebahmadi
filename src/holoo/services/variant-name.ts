/**
 * Build a UNIQUE Holoo product name for a site variant.
 *
 * Every variant of a product becomes its own Holoo product (keyed by the
 * variant barcode). They all share the product title, but Holoo rejects
 * duplicate product names — so without a distinguishing suffix only the first
 * variant of a multi-variant product imports and the rest are dropped.
 *
 * We append the variant's distinguishing attributes (size / color). When those
 * are absent we fall back to the barcode so the name is still unique. Result is
 * capped to Holoo's 150-char limit.
 */
type VariantAttr = { key?: string; value?: unknown };

function attrText(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "object") {
        const o = value as { name?: unknown; key?: unknown };
        return String(o.name ?? o.key ?? "").trim();
    }
    return String(value).trim();
}

export function holooVariantName(
    title: string,
    variant: { attributeValues?: VariantAttr[]; barcode?: string },
): string {
    const base = String(title || "").trim();
    const attrs = Array.isArray(variant?.attributeValues) ? variant.attributeValues : [];

    const parts: string[] = [];
    for (const key of ["color", "size"]) {
        const a = attrs.find((x) => x?.key === key);
        const t = a ? attrText(a.value) : "";
        if (t) parts.push(t);
    }

    let suffix = parts.join(" ");
    if (!suffix) {
        // No size/color → use the barcode tail so the name stays unique.
        const bc = String(variant?.barcode || "").trim();
        suffix = bc || "";
    }

    const name = suffix ? `${base} - ${suffix}` : base;
    return name.slice(0, 150);
}
