import { TrackerModel } from "@/tracking"
import { normalizeTrackerItems } from "@/tracking/service/tracker-items";
import BslVariantModel, { BslVariant } from "../models/variants"
import { BslOrder } from "./orders";

type Props = BslOrder
export async function bslOrderToTrack({
    created_at,
    id,
    items: rows,
    post_receipt,
    shipping_method: { current: { id: shippingServiceId, title: shippingServiceName } },
    total_items_price: amount,
    status,
    order
}: Props, vendorId?: string) {
    const exists = await TrackerModel.findOne({ serviceId: 'basalaam', orderId: `bsl-${id}` });


    if (exists && (status.id === 3067 || status.id === 3233 || status.id === 6440)) {
        return await TrackerModel.deleteOne({ _id: exists._id })
    }

    if ((status.id === 3067 || status.id === 3233 || status.id === 6440)) return;
    const variants = await BslVariantModel.find({
        ...(vendorId ? { vendorId } : {}),
        $or: [
            { bslVariantId: { $in: rows.map(x => x.variation?.id) } },
            {
                bslVariantId: null,
                bslProductId: { $in: rows.map(x => x.product.id) }
            }
        ]
    })

    const trackingCode = post_receipt?.tracking_code ?? undefined
    const items = normalizeTrackerItems(rows.map(({ quantity, title, variation, product: { id: productId, photos } }) => ({
        quantity,
        serviceVariantId: `${variation ? variation.id : productId}`,
        title,
        src: photos[0]?.original,
        variantId: variants.find((x: BslVariant) => x.bslProductId === productId && (variation ? x.bslVariantId === variation.id : true))?.variantId,
        trackingCode
    })));

    if (!exists) return await TrackerModel.create({
        serviceId: 'basalaam',
        orderId: `bsl-${id}`,
        vendorId,
        amount,
        discount: 0,
        shippingServiceName,
        shippingServiceId,
        customerName: order?.customer?.recipient?.name,
        customerPhone: order?.customer?.recipient?.mobile,
        customerPostalCode: order?.customer?.recipient?.postal_code,
        customerAddress: order?.customer?.recipient?.postal_address,
        customerCity: order?.customer?.city?.title,
        customerHouseNumber: order?.customer?.recipient?.house_number,
        customerHouseUnit: order?.customer?.recipient?.house_unit,
        items,
        createdAt: new Date(created_at)
    });


    await TrackerModel.updateOne({ _id: exists._id }, {
        $set: {
            vendorId,
            amount,
            items,
            shippingServiceName,
            shippingServiceId,
            customerName: order?.customer?.recipient?.name,
            customerPhone: order?.customer?.recipient?.mobile,
            customerPostalCode: order?.customer?.recipient?.postal_code,
            customerAddress: order?.customer?.recipient?.postal_address,
            customerCity: order?.customer?.city?.title,
            customerHouseNumber: order?.customer?.recipient?.house_number,
            customerHouseUnit: order?.customer?.recipient?.house_unit,
        }
    })
}
