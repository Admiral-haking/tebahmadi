import { Types } from "mongoose";
import BslOrder from "../models/orders";
import { type BslOrder as IBslOrder, bslOrders } from "./orders";
import BslVariantModel from "../models/variants";
import ProductModel from "@/catalog/models/Product";
import { bslOrderToTrack } from "./create-tracker-record";
import { syncVariantStockById } from "@/sync/service-stock";

export async function bslSyncOrders(vendorId: string) {
    let next_cursor = 'start';

    let stopped = false;

    while (next_cursor && !stopped) {

        try {
            const res = await bslOrders(vendorId, next_cursor === 'start' ? '' : next_cursor);

            console.log(`bsl order sync cursor=${next_cursor}`);


            next_cursor = res.next_cursor;

            for (let index = 0; index < res.data.length; index++) {
                if (stopped) break;

                const decided = await bslOrderCreateDecide(res.data[index], vendorId);

                await bslOrderToTrack(res.data[index], vendorId)

                if (decided.action === 'break') {
                    stopped = true;
                    break;
                }

                if (decided.action === 'continue') {
                    continue;
                }

                const { products } = decided;

                for (const { quantity, variantIds } of products) {
                    const validVariantIds = variantIds.filter(Boolean);
                    if (!validVariantIds.length) continue;

                    await ProductModel.findOneAndUpdate(
                        { 'variants._id': { $in: validVariantIds } },
                        [
                            {
                                $set: {
                                    variants: {
                                        $map: {
                                            input: '$variants',
                                            as: 'variant',
                                            in: {
                                                $cond: {
                                                    if: { $in: ['$$variant._id', validVariantIds] },
                                                    then: {
                                                        $mergeObjects: [
                                                            '$$variant',
                                                            {
                                                                inventory: {
                                                                    $mergeObjects: [
                                                                        '$$variant.inventory',
                                                                        {
                                                                            quantity: {
                                                                                $max: [
                                                                                    { $add: ['$$variant.inventory.quantity', quantity] },
                                                                                    0
                                                                                ]
                                                                            }
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        ]
                                                    },
                                                    else: '$$variant'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        ],
                        { runValidators: true }
                    );

                    await Promise.all(validVariantIds.map((variantId) => syncVariantStockById(variantId)));
                }

            }
        }
        catch (err: any) {
            console.error("bsl order sync failed", err?.status, err?.message);
            break;
        }


        await new Promise(res => setTimeout(res, 1e3))
    }
}

type Pro = {
    variantIds: Types.ObjectId[],
    quantity: number
}
type ReturnType = {
    action: "break"
} | {
    action: "continue"
} | {
    action: "transaction",
    products: Pro[]
}
async function bslOrderCreateDecide(order: IBslOrder, vendorId: string): Promise<ReturnType> {

    const { status, items, id, updated_at } = order;


    const products: Pro[] = []

    for (const item of items) {

        const exists = await BslOrder.findOne({ bslOrderId: id, bslOrderItemId: item.id });

        if (new Date(updated_at).getTime() < (Date.now() - (1e3 * 60 * 60 * 24 * 7)) && exists?.bslOrderStatus === status.id) return { action: 'continue' }

        if (exists?.bslOrderStatus === status.id) return { action: 'continue' }

        const inventory = await BslVariantModel.findOne({ vendorId, bslProductId: item.product.id, bslVariantId: item.variation?.id || null })


        if (!inventory) continue;

        const bslOrder = {
            amount: item.price,
            title: item.title,
            bslProductId: inventory.bslProductId,
            bslVariantId: inventory.bslVariantId,
            bslOrderId: id,
            bslOrderItemId: item.id,
            bslOrderStatus: status.id,
            bslImageUrl: item.product.photos[0].original,
            quantity: item.quantity,
            barcode: inventory.barcode,
            paymentType: "cache"
        }

        if (!exists) await BslOrder.create(bslOrder)
        else {
            await BslOrder.updateOne({ _id: exists._id }, { $set: bslOrder })
        }

        if (!inventory.productId) continue;


        const inventories = await BslVariantModel.find({ vendorId, bslProductId: item.product.id, bslVariantId: item.variation?.id || null }, { variantId: 1 })


        if (!exists && status.id === 3739) {
            products.push({
                variantIds: inventories.map(x => x.variantId).filter(x => !!x),
                quantity: -(item.quantity)
            })
        }

        if (!exists || exists.bslOrderStatus === status.id) continue;

        if (status.id === 3067 || status.id === 3233 || status.id === 6440) {
            products.push({
                variantIds: inventories.map(x => x.variantId).filter(x => !!x),
                quantity: item.quantity
            })
        }

    }


    return {
        action: 'transaction',
        products
    }
}
