type SnappPricedLine = {
    quantity?: number;
    canceled_quantity?: number;
    original_price?: number;
    discount_amount?: number;
    final_price?: number;
};

function num(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Resolve a Snapp order line's final price (in ریال) defensively. Snapp sometimes
 * returns final_price as 0 / missing while original_price + discount_amount are
 * present, which made orders show «۰ تومان». Fall back to
 * original_price − discount_amount in that case.
 */
export function snappLineFinal(line: SnappPricedLine): number {
    const final = num(line.final_price);
    if (final > 0) return final;
    const derived = num(line.original_price) - num(line.discount_amount);
    return derived > 0 ? derived : final;
}

/** Sum of every line's final price for an order (ریال). */
export function snappOrderAmount(lines: SnappPricedLine[]): number {
    return lines.reduce((total, line) => total + snappLineFinal(line), 0);
}
