import { dgkOpenApiRequest } from "@/digikala/services/open-api";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Cross-panel "become seller": list a product that exists on one Digikala seller
 * account onto another seller account (the target vendor).
 *
 * Two-step:
 *  - step=preview  → GET product-creation/be-seller/{product_id} on the target
 *    vendor (read-only): eligibility, min price, commission, variant form.
 *  - step=submit   → POST product-creation/save on the target vendor (WRITE).
 *
 * The submit step writes to the seller's live Digikala account, so it is only
 * performed when the caller explicitly sets step=submit, and Digikala's full
 * response (including validation errors) is returned so the caller can correct
 * inputs.
 */

function extractDgkMessage(data: unknown, status: number): string {
    if (typeof data === "string" && data.trim()) return data.trim();
    if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;
        const direct = (record.message as string | undefined) ?? (record.detail as string | undefined);
        if (typeof direct === "string" && direct.trim()) return direct.trim();
        const errs = record.errors;
        if (Array.isArray(errs) && errs.length) {
            return errs.map((e) => (typeof e === "string" ? e : (e as any)?.message)).filter(Boolean).join(" — ");
        }
        if (errs && typeof errs === "object") {
            return Object.values(errs as Record<string, unknown>).flat().filter(Boolean).join(" — ");
        }
    }
    if (status === 401) return "احراز هویت دیجی‌کالا منقضی شده — دوباره متصل شوید";
    // Per Digikala's own schema doc (dg8): a 500 is an internal server error on
    // their side. Our request passes their validation (theme_id/theme_value_id,
    // theme count and values are all accepted) yet creation crashes — nothing we
    // send changes it. Point the operator at Digikala support.
    if (status >= 500) {
        return "خطای داخلی سرور دیجی‌کالا (۵۰۰) — درخواست از اعتبارسنجی عبور می‌کند ولی سمت دیجی‌کالا کرش می‌کند. طبق مستندات باید با Marketplace-API@digikala.com تماس بگیرید.";
    }
    return `درخواست دیجی‌کالا ناموفق بود (خطای ${status})`;
}

type BecomeSellerVariant = {
    product_variant_id?: number | string;
    price?: number;
    stock?: number;
    seller_code?: string;
    color?: string;
    size?: string;
    order_limit?: number;
    /** Source active state — preserved on the target (default true if omitted). */
    active?: boolean;
};

function pickData(res: unknown): any {
    const r = res as any;
    return r?.data?.data ?? r?.data ?? r;
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "Invalid JSON body");
    }

    const targetVendorId = typeof body?.targetVendorId === "string" ? body.targetVendorId.trim() : "";
    const productId = String(body?.product_id ?? "").trim();
    const step = body?.step === "submit" ? "submit" : "preview";
    const variants: BecomeSellerVariant[] = Array.isArray(body?.variants) ? body.variants : [];

    if (!targetVendorId || !productId) {
        return jsonError(400, "targetVendorId و product_id لازم است");
    }
    if (!/^\d+$/.test(productId)) {
        return jsonError(400, "product_id نامعتبر است");
    }

    try {
        // Step 1 — read-only eligibility / form.
        const beSeller = await dgkOpenApiRequest({
            vendorId: targetVendorId,
            method: "GET",
            path: ["product-creation", "be-seller", productId],
        });

        // Eligibility gate: the be-seller response carries commission.canSell —
        // false means this seller account is NOT allowed to list this product
        // (e.g. category/brand restrictions). Surface it clearly instead of
        // blindly assigning and hitting an opaque error later.
        const beSellerData = pickData(beSeller);
        const canSell = beSellerData?.commission?.canSell;

        if (step === "preview") {
            return NextResponse.json({ step: "preview", beSeller: beSeller.data, canSell });
        }

        if (canSell === false) {
            return jsonError(
                403,
                "این فروشنده مجاز به فروش این کالا نیست (canSell=false) — معمولاً به‌خاطر محدودیت دسته‌بندی یا برند. فروشنده‌ی مقصد دیگری انتخاب کنید.",
            );
        }

        // Step 2 — become a seller of the existing product, then price/stock it.
        if (!variants.length) {
            return jsonError(400, "حداقل یک واریانت برای ثبت لازم است");
        }

        // Transfer EVERY source variant exactly as-is (active/inactive, in/out of
        // stock) — no dropping. The previous filter silently skipped zero-price,
        // zero-stock variants of no-theme products.
        const mappedVariants = variants.map((v) => ({
            price: Math.max(0, Math.floor(Number(v.price) || 0)),
            stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
            supplier_code: String(v.seller_code ?? "").trim(),
            color: String(v.color ?? "").trim(),
            size: String(v.size ?? "").trim(),
            order_limit: Math.max(1, Math.floor(Number(v.order_limit) || 5)),
            // Preserve the source active flag; default to active when unknown.
            active: v.active !== false,
        }));

        if (!mappedVariants.length) {
            return jsonError(400, "هیچ واریانتی برای ثبت یافت نشد");
        }

        // 2a — register the seller on the product FIRST (POST assign { productId }).
        // Variants can only be created after this seller-registration is in place.
        const assign = await dgkOpenApiRequest({
            vendorId: targetVendorId,
            method: "POST",
            path: ["product-creation", "assign"],
            body: { productId: Number(productId) },
        });

        // Give Digikala a moment to propagate the assignment before adding
        // variants — creating a variant against a not-yet-propagated assignment
        // is one suspected cause of the opaque 500s.
        await sleep(2500);

        // 2b — read the variant-creation config: default warranty + theme ids.
        let warrantyId: unknown;
        let variantTheme = "no_color_no_size";
        let sizeThemeId: number | undefined;
        let colorThemeId: number | undefined;
        let themesCount = 0;
        let leadTime = 1;
        try {
            const cfg = pickData(await dgkOpenApiRequest({
                vendorId: targetVendorId,
                method: "GET",
                path: ["variants", "creation", productId],
            }));
            // Prefer the universal "اصالت و سلامت فیزیکی کالا" warranty (valid for
            // virtually every product, and what source listings use) over a random
            // brand-specific warranty that warranty_options[0] may point to.
            const warrantyOptions = (cfg?.warranty_options ?? []) as Array<{ id: unknown; title?: string }>;
            const genericWarranty = warrantyOptions.find((w) => String(w?.title ?? "").includes("اصالت"));
            warrantyId = genericWarranty?.id ?? warrantyOptions[0]?.id;
            variantTheme = String(cfg?.variant_theme ?? "no_color_no_size");
            // lead_time is documented as optional, but Digikala's create handler
            // actually 500-crashes without it. Use the category's allowed max
            // (a known-valid value, matching how source listings are created).
            const leadTimeMax = Number(cfg?.lead_time_max);
            if (Number.isFinite(leadTimeMax) && leadTimeMax > 0) leadTime = leadTimeMax;
            const themes = (cfg?.themes ?? []) as Array<{ id: number; themeType: string }>;
            themesCount = themes.length;
            for (const t of themes) {
                if (t.themeType === "sized") sizeThemeId = t.id;
                if (t.themeType === "colored") colorThemeId = t.id;
            }
        } catch (e: any) {
            return NextResponse.json(
                { error: extractDgkMessage(e?.data, e?.status ?? 500), stage: "creation-config", status: e?.status, data: e?.data, assign: assign.data },
                { status: e?.status ?? 500 },
            );
        }

        // 2c — build name→id maps for the size/color themes from theme-values.
        async function themeValueMap(themeId: number): Promise<Map<string, number>> {
            const res = pickData(await dgkOpenApiRequest({
                vendorId: targetVendorId,
                method: "GET",
                path: ["variants", "creation", "themes", String(themeId), "theme-values"],
                searchParams: new URLSearchParams({ product_id: productId, size: "300" }),
            }));
            const items: any[] = res?.items ?? (Array.isArray(res) ? res : []);
            const map = new Map<string, number>();
            for (const it of items) {
                const id = Number(it?.id);
                if (!Number.isFinite(id)) continue;
                for (const name of [it?.titleFa, it?.titleEn, it?.value?.value, it?.value?.title]) {
                    if (name != null && String(name).trim()) map.set(String(name).trim(), id);
                }
            }
            return map;
        }
        const sizeMap = sizeThemeId ? await themeValueMap(sizeThemeId) : null;
        const colorMap = colorThemeId ? await themeValueMap(colorThemeId) : null;

        // 2d — create the seller's variant for each row (sets price/stock/size/color).
        //
        // NOTE on themes (per Digikala's validation messages + docs):
        //   - Single-theme category  → pass size_id (sized) or color_id (colored).
        //   - Multi-theme category   → must NOT pass size_id/color_id; pass the
        //     theme_values array instead: [{ theme_id, theme_value_id }, ...].
        // We detect multi-theme by the number of themes on the creation config.
        const isMultiTheme = themesCount > 1;
        const variantResults: Array<Record<string, unknown>> = [];

        // Digikala throttles variant creation hard (rate_limit.max ≈ 6 per window).
        // Firing 30 back-to-back yields a wall of 429s, so we pace requests and,
        // on 429, back off and retry instead of giving up on the row.
        let createdCount = 0;
        for (const v of mappedVariants) {
            const sizeId = sizeThemeId && v.size ? sizeMap?.get(v.size) : undefined;
            const colorId = colorThemeId && v.color ? colorMap?.get(v.color) : undefined;
            const createBody: Record<string, unknown> = {
                // Preserve the source variant's active/inactive state as-is.
                is_active: v.active,
                order_limit: v.order_limit,
                marketplace_seller_stock: v.stock,
                price: v.price * 10, // UI Toman -> Rial
                warranty_id: warrantyId,
                site: "digikala",
                shipping_type: "digikala",
                lead_time: leadTime, // required in practice — omitting it 500-crashes DGK
                ...(v.supplier_code ? { supplier_code: v.supplier_code } : {}),
            };

            if (isMultiTheme) {
                // Multi-theme → theme_values array; size_id/color_id are rejected.
                const themeValues: Array<{ theme_id: number; theme_value_id: number }> = [];
                if (sizeThemeId && sizeId) themeValues.push({ theme_id: sizeThemeId, theme_value_id: sizeId });
                if (colorThemeId && colorId) themeValues.push({ theme_id: colorThemeId, theme_value_id: colorId });
                if (themeValues.length) createBody.theme_values = themeValues;
            } else {
                // Single-theme → size_id / color_id directly.
                if (colorId) createBody.color_id = colorId;
                if (sizeId) createBody.size_id = sizeId;
            }
            const result: Record<string, unknown> = { size: v.size, color: v.color };
            if (sizeThemeId && v.size && sizeId == null) result.warning = `سایز «${v.size}» در مقصد پیدا نشد`;
            if (colorThemeId && v.color && colorId == null) result.warning = `${result.warning ? result.warning + " — " : ""}رنگ «${v.color}» پیدا نشد`;

            // Retry on 429 (rate limit). With lead_time now sent, the previous
            // blanket 500s are gone; a stray 500 is retried once as well.
            let lastErr: any;
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                try {
                    await dgkOpenApiRequest({
                        vendorId: targetVendorId,
                        method: "POST",
                        path: ["variants", "creation", productId],
                        body: createBody,
                    });
                    result.created = "ok";
                    createdCount += 1;
                    lastErr = undefined;
                    break;
                } catch (e: any) {
                    lastErr = e;
                    const status = e?.status ?? 500;
                    if (status === 429 && attempt < 3) {
                        await sleep(10_000); // wait out the rate window, then retry
                        continue;
                    }
                    if (status >= 500 && attempt < 2) {
                        await sleep(2_000);
                        continue;
                    }
                    break;
                }
            }
            if (lastErr) {
                const status = lastErr?.status ?? 500;
                result.created = extractDgkMessage(lastErr?.data, status);
                result.errors = (lastErr?.data as any)?.errors;
                result.status = status;
                result.raw = lastErr?.data; // surface DGK's raw body (e.g. opaque 500s)
                result.sent = createBody;
            }
            variantResults.push(result);
            // Pace well under the per-window cap to avoid tripping 429 at all.
            await sleep(1500);
        }

        logErrorLater({
            level: "info",
            category: "marketplace",
            source: "digikala.become-seller",
            message: "become_seller_assigned",
            metadata: { targetVendorId, productId, variantTheme, variantCount: mappedVariants.length },
        });

        return NextResponse.json({
            step: "submitted",
            assign: assign.data,
            variantTheme,
            created: createdCount,
            total: mappedVariants.length,
            variantResults,
        });
    } catch (error: any) {
        const status = error?.status ?? 500;
        logErrorLater({
            category: "marketplace",
            source: "digikala.become-seller",
            error,
            route: req.nextUrl.pathname,
            method: req.method,
            metadata: { targetVendorId, productId, step, status, data: error?.data },
        });
        return NextResponse.json(
            { error: extractDgkMessage(error?.data, status), status, data: error?.data },
            { status },
        );
    }
}
