import { TrackerModel } from "@/tracking"
import { normalizeTrackerItems } from "@/tracking/service/tracker-items"
import DgkVariantModel from "../models/variants"

type Props = {
    vendorId?: string
    order_id: number
    variant_id: number
    title: string
    image: string
    quantity: number;
    amount: number;
    discount?: number
    url?: string
    trackingCode?: string
    shipmentName?: string
    shipmentType?: string
    date?: Date
}
export async function dgkOrderToTrack({ vendorId, image, order_id, quantity, title, variant_id, amount, discount, url, trackingCode, shipmentName, shipmentType, date }: Props) {
    const exists = await TrackerModel.findOne({ serviceId: 'dgk', orderId: `dgk-${order_id}` });
    const variant = await DgkVariantModel.findOne({ ...(vendorId ? { vendorId } : {}), dgkVariantId: variant_id });
    const incomingItem = {
        quantity,
        serviceVariantId: `${variant_id}`,
        title,
        src: image,
        variantId: variant?.variantId,
        url,
        trackingCode
    };

    if (!exists) return await TrackerModel.create({
        serviceId: 'dgk',
        orderId: `dgk-${order_id}`,
        vendorId,
        amount,
        discount: discount || 0,
        shippingServiceName: shipmentName,
        shippingServiceId: shipmentType,
        items: normalizeTrackerItems([incomingItem]),
        createdAt: date
    });

    const items = normalizeTrackerItems(exists.items as never);

    const i = items.findIndex(x => x.serviceVariantId === `${variant_id}`);

    if (i < 0) {
        items.push(...normalizeTrackerItems([incomingItem]))
    } else {
        items[i] = {
            ...items[i],
            quantity: normalizeTrackerItems([incomingItem])[0]?.quantity ?? 0,
            serviceVariantId: `${variant_id}`,
            title,
            src: image,
            trackingCode
        }
    }

    await TrackerModel.updateOne({ _id: exists._id }, { $set: { vendorId, amount, discount: discount || exists.discount, items, shippingServiceName: exists.shippingServiceName || shipmentName, shippingServiceId: exists.shippingServiceId || shipmentType } })
}
