import ProductModel from "@/catalog/models/Product";
import { snpGetOrders, snpGetVendors } from "../api";
import SnpOrder from "../models/orders";
import SnapVariantModel from "../models/variants";
import { snpOrderToTrack } from "./order-to-track";
import { syncVariantStockById } from "@/sync/service-stock";
import { snappLineFinal } from "../utils/price";

export async function snpSyncOrders(vendorId: string) {
    const { data } = await snpGetVendors(vendorId);

    return Promise.all(
        data.map(async ({ id }) => {
            let cursor = 'start';

            try {

                while (cursor) {
                    const { data, meta: { pagination: { next_cursor, has_more } } } = await snpGetOrders(vendorId, id, cursor === 'start' ? '' : cursor);

                    cursor = next_cursor;


                    for (let index = 0; index < data.length; index++) {
                      // Isolate each order: a single bad order must not abort the
                      // whole vendor sync and silently drop every later order.
                      try {
                        const { order_number, items } = data[index];

                        await snpOrderToTrack(data[index], vendorId)
                        for (const item of items) {
                            const effectiveQuantity = item.item_status === 'CONFIRMED'
                                ? Math.max(item.quantity - (item.canceled_quantity || 0), 0)
                                : 0;
                            const snpVariantId = item.vendor_product_info_id;
                            const barcode = item.sku || undefined;
                            const orderFilter = {
                                snpOrderId: order_number,
                                $or: [
                                    { snpVariantId },
                                    ...(barcode ? [{ barcode }] : [])
                                ]
                            };

                            const product = await SnapVariantModel.findOne({
                                vendorId,
                                $or: [
                                    { snpProductId: snpVariantId },
                                    ...(barcode ? [{ barcode }] : []),
                                ]
                            })
                            const old = await SnpOrder.findOne(
                                orderFilter
                            )
                            const result = await SnpOrder.findOneAndUpdate(
                                orderFilter,
                                {
                                    $set: {
                                        amount: snappLineFinal(item),
                                        title: product?.displayName || item.sku || snpVariantId,
                                        snpVariantId,
                                        quantity: effectiveQuantity,
                                        barcode,
                                        snpOrderId: order_number,
                                        status: item.item_status
                                    }
                                },
                                {
                                    upsert: true,
                                    returnDocument: 'after',
                                    includeResultMetadata: true
                                }
                            );

                            if (!product?.productId || !product?.variantId) continue;

                            let obj: any;

                            if (!result.lastErrorObject?.updatedExisting) {
                                if (effectiveQuantity > 0) {
                                    obj = ({
                                        variantId: product.variantId,
                                        quantity: -effectiveQuantity
                                    })
                                }
                            } else if (old && old.quantity !== result.value?.quantity) {
                                obj = ({
                                    variantId: product.variantId,
                                    quantity: old.quantity - (result.value?.quantity || 0)
                                })
                            }

                            if (obj) {

                                await ProductModel.findOneAndUpdate(
                                    { 'variants._id': obj.variantId },
                                    [
                                        {
                                            $set: {
                                                variants: {
                                                    $map: {
                                                        input: '$variants',
                                                        as: 'variant',
                                                        in: {
                                                            $cond: {
                                                                if: { $eq: ['$$variant._id', obj.variantId] },
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
                                                                                                { $add: ['$$variant.inventory.quantity', obj.quantity] },
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

                                await syncVariantStockById(obj.variantId);
                            }
                        }
                      } catch (orderError) {
                        console.error("snapp order sync failed", { order: data[index]?.order_number, error: orderError instanceof Error ? orderError.message : orderError });
                      }
                    }

                    if (!has_more) break;
                }
            } catch { }
        })
    )
}
