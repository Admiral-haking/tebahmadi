import { Get } from "@/utils/fetch";
import { dgkApiRoutes } from "../constants/routes";
import { forceDgkRefreshToken, getDgkToken } from "../utils/token";
import DgkOrder from "../models/orders";
import DgkVariantModel from "../models/variants";
import ProductModel from "@/catalog/models/Product";
import { dgkOrderToTrack } from "./create-tracker-record";
import { syncVariantStockById } from "@/sync/service-stock";

export async function dgkSyncHistoryOrders(vendorId: string) {


    let page = 1
    let pages = 1

    let stopped = false;

    try {
        while (page <= pages && !stopped) {

            const { data: { items, pager: { total_pages }, rate_limit: { current = 1, max = 2, resetTime } = {} } } = await Get<IDigikalaOrdersResponse>(dgkApiRoutes.history_orders.concat(`?page=${page}&size=50&sort=id&order=desc`), {
                'Authorization': `Bearer ${await getDgkToken(vendorId)}`
            })


            for (let index = 0; index < items.length; index++) {
                const { product_variant_id, order_id, shipping_type: { key, title }, shipment_id, quantity, total_price, payment_type, order_status, product_supplier_code, order_created_at, image_src, product_url, product_variant_title } = items[index];

                const orderFilter = { dgkOrderId: order_id, dgkVariantId: product_variant_id };
                const exists = await DgkOrder.findOne(orderFilter);

                if (order_status.key === 'partial_returned') {
                    order_status.key = 'returned';
                }

                if (!exists) {

                    await DgkOrder.create({
                        barcode: product_supplier_code,
                        dgkVariantId: product_variant_id,
                        quantity,
                        amount: total_price,
                        title: product_variant_title,
                        dgkImageUrl: image_src,
                        dgkOrderId: order_id,
                        status: order_status.key,
                        paymentType: 'cache',
                        dgkOrderItemId: shipment_id
                    });
                    if (order_status.key === "processed")
                        await dgkOrderToTrack({
                            vendorId,
                            amount: total_price,
                            image: image_src,
                            order_id,
                            quantity,
                            title: product_variant_title,
                            variant_id: product_variant_id,
                            url: product_url,
                            trackingCode: `dgExpress-${shipment_id}`,
                            shipmentName: title,
                            shipmentType: key,
                            date: new Date(order_created_at)
                        })
                    continue;
                }

                if (new Date(order_created_at).getTime() < (Date.now() - (1e3 * 60 * 60 * 24 * 7))) {
                    stopped = true;
                    break;
                }

                if (exists.status === order_status.key) {
                    if (exists?.status === 'processed' || exists?.status === 'canceled' || exists?.status === 'returned') {
                        continue;
                    }
                }

                await DgkOrder.updateOne(orderFilter, {
                    $set: {
                        paymentType: payment_type.key,
                        status: order_status.key,
                        amount: total_price
                    }
                })
                await dgkOrderToTrack({
                    vendorId,
                    amount: total_price,
                    image: image_src,
                    order_id,
                    quantity,
                    title: product_variant_title,
                    variant_id: product_variant_id,
                    url: product_url,
                    trackingCode: `dgExpress-${shipment_id}`,
                    shipmentName: title,
                    shipmentType: key
                })


                if (order_status.key === 'processed' || !exists) continue;

                const inventory = await DgkVariantModel.find({ vendorId, $or: [{ barcode: product_supplier_code }, { dgkVariantId: product_variant_id }] });

                if (!inventory.length) continue;

                const variantIds = inventory.map(x => x.variantId).filter(Boolean);
                if (!variantIds.length) continue;

                await ProductModel.findOneAndUpdate(
                    { 'variants._id': { $in: variantIds } },
                    [
                        {
                            $set: {
                                variants: {
                                    $map: {
                                        input: '$variants',
                                        as: 'variant',
                                        in: {
                                            $cond: {
                                                if: { $in: ['$$variant._id', variantIds] },
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

                await Promise.all(variantIds.map((variantId) => syncVariantStockById(variantId)));

            }

            pages = total_pages;

            const rTime = new Date(resetTime?.date || Date.now() + 1e4).getTime();

            const diffMs = rTime - Date.now();

            await new Promise(res => setTimeout(res, max - current > 2 ? Math.min(1500, Math.max(300, Math.ceil(diffMs / Math.max(total_pages, 1)))) : Math.min(15000, Math.max(0, diffMs) + 1000)))

            page += 1;

        }
    }
    catch (err: any) {
        console.error("sync vendor failed", err?.message ?? err, err?.data);

        if (err?.status === 401) forceDgkRefreshToken(vendorId).catch(console.error)
    }
}

interface IDigikalaOrdersResponse {
    status: 'ok' | 'error';
    data: {
        sort_data: {
            sort_column: string;
            sort_order: 'asc' | 'desc';
            sort_columns: string[];
        };
        pager: {
            page: number;
            item_per_page: number;
            total_pages: number;
            total_rows: number;
        };
        form_data: any[];
        items: Array<{
            product_variant_title: string;
            product_id: number;
            product_variant_id: number;
            order_id: number;
            shipment_id: number;
            order_created_at: string;
            order_status: {
                key: 'processed' | 'returned' | 'canceled' | 'partial_returned';
                title: string;
            };
            category: string;
            product_supplier_code: string;
            product_url: string;
            image_src: string;
            payment_type: {
                key: string;
                title: string;
            };
            sell_type: {
                key: string;
                title: string;
            };
            shipping_type: {
                key: string;
                title: string;
            };
            unit_discount: number;
            unit_price: number;
            lead_time: number;
            serials: Array<{
                serial: string;
                order_shipped_at: string | null;
                return_to_warehouse_at: string | null;
                warehouse_title: string;
                serial_status: {
                    key: string;
                    title: string;
                };
                return_reason: string | null;
                agent_note: string | null;
            }>;
            quantity: number;
            discount_type: string;
            seller_voucher_title: string | null;
            seller_voucher_amount: number;
            total_price: number;
            cancellation_info: {
                canceled_by: string;
                reason: string;
            } | null;
        }>;
        meta_data: {
            all_categories: Record<string, string>;
            b2b_active: boolean;
        };
        rate_limit: {
            max: number;
            current: number;
            resetTime: {
                date: string;
                timezone_type: number;
                timezone: string;
            };
        };
    };
}
