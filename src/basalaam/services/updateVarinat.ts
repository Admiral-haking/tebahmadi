import { PATCH } from "@/utils/fetch";
import BslVariantModel from "../models/variants";
import { bslBearerHeader } from "./auth";
import { bslApiRoutes } from "../constants/route";
import { logErrorLater } from "@/observability/error-log";

export async function bslVariantUpdate(vendorId: string, barcode: string, stock: number) {
    const items = await BslVariantModel.find({ vendorId, barcode });

    const { headers } = await bslBearerHeader(vendorId);

    for (let index = 0; index < items.length; index++) {
        try {

            const { bslProductId, bslVariantId } = items[index];
            // Basalam's writable stock field is `stock` for both the product and
            // the variation update endpoints. (`inventory` is the read-only name
            // in GET responses; sending it on PATCH causes a 422.)
            const body = { stock };
            await PATCH(bslApiRoutes.patch_product(bslProductId, bslVariantId), body, headers)

            await BslVariantModel.updateMany(
                { _id: items[index]._id },
                { $set: { quantity: stock } }
            );

            await new Promise(res => setTimeout(res, 500))
        } catch (err: any) {
            // A 404 here just means the variant isn't on Basalaam — expected
            // during bulk stock sync; don't surface it. Other failures (e.g. 422)
            // go to the error-log with Basalam's response body so the rejected
            // field is visible in the admin panel.
            if (err?.status !== 404) {
                const { bslProductId, bslVariantId } = items[index];
                logErrorLater({
                    category: "sync",
                    source: "basalaam.stock-update",
                    error: err,
                    metadata: { vendorId, barcode, bslProductId, bslVariantId, stock, status: err?.status, response: err?.data },
                });
            }
        }
    }
}
export async function bslVariantSkuUpdate(vendorId: string, sku: string, product_id: number, variant_id: number) {

    const { headers } = await bslBearerHeader(vendorId);

    await PATCH(bslApiRoutes.patch_product(product_id, variant_id), { sku }, headers)
}
/**
 * Set a discounted selling price on Basalam. On Basalam `primary_price` is the
 * original price and `price` is the (lower) selling price, so a discount is just
 * `price` < `primary_price`. Passing discountPrice = 0 is ignored by the caller.
 */
export async function bslVariantDiscountUpdate(vendorId: string, barcode: string, price: number) {
    const items = await BslVariantModel.find({ vendorId, barcode });
    const { headers } = await bslBearerHeader(vendorId);
    for (let index = 0; index < items.length; index++) {
        try {
            const { bslProductId, bslVariantId } = items[index];
            await PATCH(bslApiRoutes.patch_product(bslProductId, bslVariantId), { price }, headers);
            await new Promise((res) => setTimeout(res, 500));
        } catch (err: any) {
            if (err?.status !== 404) console.error("bsl discount update failed", err?.status, err?.message);
        }
    }
}

export async function bslVariantPriceUpdate(vendorId: string, barcode: string, primary_price: number) {
    const items = await BslVariantModel.find({ vendorId, barcode });

    const { headers } = await bslBearerHeader(vendorId);

    for (let index = 0; index < items.length; index++) {
        try {

            const { bslProductId, bslVariantId } = items[index];
            await PATCH(bslApiRoutes.patch_product(bslProductId, bslVariantId), { primary_price }, headers)

            await BslVariantModel.updateOne(
                { _id: items[index]._id },
                { $set: { price: primary_price } }
            );

            await new Promise(res => setTimeout(res, 500))
        } catch (err: any) {
            if (err?.status !== 404) console.error("bsl price update failed", err?.status, err?.message);
        }
    }
}
