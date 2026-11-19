import { Get } from "@/utils/fetch";
import { dgkApiRoutes } from "../constants/routes";
import { forceDgkRefreshToken, getDgkToken } from "../utils/token";
import DgkOrder from "../models/orders";
import DgkVariantModel from "../models/variants";
import ProductModel from "@/catalog/models/Product";
import { dgkOrderToTrack } from "./create-tracker-record";
import { syncVariantStockById } from "@/sync/service-stock";

export async function dgkSyncActiveOrders(vendorId: string) {


    let page = 1
    let pages = 1;

    let stopped = false;

    try {
        while (page <= pages && !stopped) {

            const { data: { items, pager: { total_pages }, rate_limit: { current = 1, max = 2, resetTime } = {} } } = await Get<IDgkOrderResponse>(dgkApiRoutes.active_orders.concat(`?page=${page}&size=50&sort=order_created_at&order=desc`), {
                'Authorization': `Bearer ${await getDgkToken(vendorId)}`
            })


            for (let index = 0; index < items.length; index++) {
                const { supplier_code, product_variant_id, order_id, quantity, total_price, product_variant_title, product_image_url, discount_manager, order_item_id, order_created_at } = items[index];

                const exists = await DgkOrder.findOne({ dgkOrderId: order_id, dgkOrderItemId: order_item_id });

                if (exists) {
                    stopped = true;
                    break;
                }

                await dgkOrderToTrack({
                    vendorId,
                    discount: discount_manager,
                    amount: total_price,
                    image: product_image_url,
                    order_id,
                    quantity,
                    title: product_variant_title,
                    variant_id: product_variant_id,
                    date: new Date(order_created_at)
                })

                await DgkOrder.create({
                    barcode: supplier_code,
                    dgkVariantId: product_variant_id,
                    quantity,
                    amount: total_price,
                    title: product_variant_title,
                    dgkImageUrl: product_image_url,
                    dgkOrderId: order_id,
                    status: 'pending',
                    paymentType: 'cache',
                    dgkOrderItemId: order_item_id
                });

                const inventory = await DgkVariantModel.find({ vendorId, $or: [{ barcode: supplier_code }, { dgkVariantId: product_variant_id }] });

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
                                                                                    { $subtract: ['$$variant.inventory.quantity', quantity] },
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

// Sort data interface
interface ISortData {
    sort_column: string;
    sort_order: 'asc' | 'desc';
    sort_columns: string[];
}

// Pager interface
interface IPager {
    page: number;
    item_per_page: number;
    total_pages: number;
    total_rows: number;
}

// Form data interface
interface IFormData {
    created_today: string; // "true" | "false"
}

// Order item interface
interface IOrderItem {
    product_variant_id: number;
    product_image_url: string;
    product_variant_title: string;
    supplier_code: string;
    order_id: number;
    order_item_id: number;
    order_created_at: string; // ISO date string with timezone
    warehouse_status_at: string; // ISO date string with timezone
    commitment_date: string; // ISO date string with timezone
    quantity: number;
    selling_price: number; // Price in IRR (Tomans? Seems like Rials based on values)
    amazing_discount: number;
    discount_manager: number;
    total_price: number;
    cancelable: boolean;
}

// Cancellation reason interface
interface ICancellationReason {
    key: string;
    title: string;
}

// Meta data interface
interface IMetaData {
    cancellation_reasons: Record<string, ICancellationReason>;
}

// Reset time interface
interface IResetTime {
    date: string;
    timezone_type: number;
    timezone: string;
}

// Rate limit interface
interface IRateLimit {
    max: number;
    current: number;
    resetTime: IResetTime;
}

// Main data interface
interface IDgkApiData {
    sort_data: ISortData;
    pager: IPager;
    form_data: IFormData;
    items: IOrderItem[];
    meta_data: IMetaData;
    rate_limit: IRateLimit;
}

// Root response interface
export interface IDgkOrderResponse {
    status: 'ok' | 'error'; // Assuming 'ok' is success, can add other statuses
    data: IDgkApiData;
}
