export type TrackerItemInput = {
    serviceVariantId?: unknown
    variantId?: unknown
    title?: unknown
    quantity?: unknown
    src?: unknown
    url?: unknown
    trackingCode?: unknown
    city?: unknown
    state?: unknown
}

export type TrackerItem = {
    serviceVariantId: string
    variantId?: unknown
    title?: string
    quantity: number
    src?: string
    url?: string
    trackingCode?: string
    city?: string
    state?: string
}

function asString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    const text = `${value}`.trim();
    return text.length ? text : undefined;
}

function normalizeQuantity(value: unknown): number {
    const quantity = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(quantity)) return 0;
    return Math.max(quantity, 0);
}

function itemKey(item: TrackerItemInput) {
    return asString(item.variantId) || asString(item.serviceVariantId) || asString(item.url) || asString(item.title);
}

function chooseText(existing: string | undefined, incoming: string | undefined) {
    if (!incoming) return existing;
    if (!existing) return incoming;
    return incoming.length > existing.length ? incoming : existing;
}

function mergeTrackerItem(existing: TrackerItem | undefined, incoming: TrackerItem): TrackerItem {
    if (!existing) return incoming;

    return {
        ...existing,
        serviceVariantId: existing.serviceVariantId || incoming.serviceVariantId,
        variantId: existing.variantId || incoming.variantId,
        title: chooseText(existing.title, incoming.title),
        quantity: incoming.quantity,
        src: existing.src || incoming.src,
        url: existing.url || incoming.url,
        trackingCode: existing.trackingCode || incoming.trackingCode,
        city: existing.city || incoming.city,
        state: existing.state || incoming.state,
    };
}

export function normalizeTrackerItem(item: TrackerItemInput): TrackerItem | undefined {
    const serviceVariantId = asString(item.serviceVariantId) || asString(item.variantId) || asString(item.url) || asString(item.title);
    if (!serviceVariantId) return undefined;

    return {
        serviceVariantId,
        variantId: item.variantId,
        title: asString(item.title),
        quantity: normalizeQuantity(item.quantity),
        src: asString(item.src),
        url: asString(item.url),
        trackingCode: asString(item.trackingCode),
        city: asString(item.city),
        state: asString(item.state),
    };
}

export function normalizeTrackerItems(items: TrackerItemInput[]): TrackerItem[] {
    const keyed = new Map<string, TrackerItem>();

    for (const raw of items) {
        const normalized = normalizeTrackerItem(raw);
        if (!normalized) continue;

        const key = itemKey(normalized);
        if (!key) continue;

        keyed.set(key, mergeTrackerItem(keyed.get(key), normalized));
    }

    return Array.from(keyed.values());
}
