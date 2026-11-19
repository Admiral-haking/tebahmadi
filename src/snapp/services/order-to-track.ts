import { TrackerModel } from "@/tracking"
import { normalizeTrackerItems } from "@/tracking/service/tracker-items";
import { SnappOrder } from "../api/type";
import SnapVariantModel from "../models/variants";
import ProductModel from "@/catalog/models/Product";
import { snappOrderAmount } from "../utils/price";

type Props = SnappOrder
export async function snpOrderToTrack({
    created_at,
    order_number: id,
    order_status: status,
    items: rows,
    customer
}: Props, vendorId?: string) {
    const exists = await TrackerModel.findOne({ serviceId: 'snapp', orderId: `snp-${id}` });


    if (exists && status === 'CANCELED') {
        return await TrackerModel.deleteOne({ _id: exists._id })
    }

    const variants = await SnapVariantModel.find({
        $or: [
            { snpProductId: { $in: rows.map(x => x.vendor_product_info_id) } },
            { barcode: { $in: rows.map(x => x.sku) } },
        ]
    })

    const amount = snappOrderAmount(rows)
    const discount = rows.reduce((t, c) => t + (c.discount_amount || 0), 0)

    // Resolve each line's product image from the local catalog (variant barcode =
    // snapp sku) so tracking shows item photos instead of blank thumbnails.
    const skus = rows.map((r) => r.sku).filter((s): s is string => Boolean(s));
    const mediaByBarcode = new Map<string, string>();
    if (skus.length) {
        const products = await ProductModel.find(
            { "variants.barcode": { $in: skus } },
            { "variants.barcode": 1, "variants.mediaIds": 1 },
        ).lean();
        for (const product of products) {
            for (const variant of product.variants ?? []) {
                if (variant.barcode && variant.mediaIds?.[0]) {
                    mediaByBarcode.set(variant.barcode, String(variant.mediaIds[0]));
                }
            }
        }
    }

    const items = normalizeTrackerItems(rows.map(({ quantity, canceled_quantity, vendor_product_info_id, sku }) => {
        // Match by either the Snapp product id OR the sku (the sku equals the site
        // accounting barcode). Previously only snpProductId was matched, so most
        // lines resolved to no variant.
        const variant = variants.find((x) => x.snpProductId === vendor_product_info_id || (sku && x.barcode === sku));
        // Store the SITE barcode (= snapp sku) as serviceVariantId so the Holoo
        // transfer can resolve the product directly. Storing vendor_product_info_id
        // (the previous behaviour) matched neither snpProductId nor barcode in the
        // Holoo lookup, so every Snapp invoice silently failed to transfer.
        const barcode = variant?.barcode || sku || vendor_product_info_id;
        const imageId = (sku && mediaByBarcode.get(sku)) || (barcode && mediaByBarcode.get(barcode)) || "";
        return ({
            quantity: Math.max(quantity - (canceled_quantity || 0), 0),
            serviceVariantId: `${barcode}`,
            title: variant?.displayName || sku || vendor_product_info_id,
            src: imageId ? `/api/media/${imageId}` : "",
            variantId: variant?.variantId,
        })
    }));

    return await TrackerModel.updateOne(
        {
            serviceId: 'snapp',
            orderId: `snp-${id}`,
        },
        {
            vendorId,
            amount,
            discount,
            items,
            customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || undefined,
            customerPhone: customer?.phone || customer?.address?.phone,
            customerPostalCode: customer?.address?.postal_code || undefined,
            customerAddress: customer?.address?.address,
            customerCity: customer?.address?.city,
            customerState: customer?.address?.province,
            customerHouseNumber: customer?.address?.house_number || undefined,
            customerHouseUnit: customer?.address?.house_unit || undefined,
            createdAt: new Date(created_at)
        }, {
        upsert: true
    });
}
