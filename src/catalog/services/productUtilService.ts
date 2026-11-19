import { FilterQuery, PipelineStage } from "mongoose";
import ProductModel from "../models/Product";

type Props = {
    q?: string
    page?: number
    perPage?: number
}

function buildPipeline(): PipelineStage[] {
    const pipeline: PipelineStage[] = [
        {
            $addFields: {
                activeVariants: {
                    $filter: {
                        input: "$variants",
                        as: "variant",
                        cond: { $eq: ["$$variant.active", true] },
                    },
                },
            },
        },
        {
            $addFields: {
                minPrice: {
                    $min: {
                        $map: {
                            input: "$activeVariants",
                            as: "variant",
                            in: "$$variant.price.amount",
                        },
                    },
                },
                maxPrice: {
                    $max: {
                        $map: {
                            input: "$activeVariants",
                            as: "variant",
                            in: "$$variant.price.amount",
                        },
                    },
                },
                inventoryTotal: {
                    $sum: {
                        $map: {
                            input: "$activeVariants",
                            as: "variant",
                            in: { $ifNull: ["$$variant.inventory.quantity", 0] },
                        },
                    },
                },
            },
        },
        {
            $addFields: {
                minPriceMissing: {
                    $cond: [{ $ifNull: ["$minPrice", false] }, 0, 1],
                },
            },
        },
    ];

    pipeline.push({ $sort: { createdAt: -1 } });

    return pipeline;
}

export async function getPopularProducts({ page = 1, perPage = 12, q }: Props) {
    const $match: FilterQuery<any> = {
        status: "active"
    };

    if (q?.trim()) {
        $match.$text = {
            $search: q.trim()
        };
    };

    const total = await ProductModel.countDocuments($match);


    const items = await ProductModel.aggregate([
        {
            $match
        },
        ...buildPipeline(),
        {
            $lookup: {
                from: "invoices",
                let: { id: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ["$$id", "$lines.productId"]
                            }
                        }
                    },
                    { $count: "count" }
                ],
                as: "popularity"
            }
        },
        {
            $addFields: {
                popularity: {
                    $ifNull: [{ $arrayElemAt: ["$popularity.count", 0] }, 0]
                }
            }
        },
        {
            $sort: {
                popularity: -1
            }
        },
        {
            $skip: (page - 1) * perPage
        },
        {
            $limit: perPage
        }
    ]);

    return { total, items }
}


export async function getDiscountProducts({ page = 1, perPage = 12, q }: Props) {
    const $match: FilterQuery<any> = {
        status: "active",
        "variants.offer": { $exists: true }
    };

    if (q?.trim()) {
        $match.$text = {
            $search: q.trim()
        };
    };

    const total = await ProductModel.countDocuments($match);


    const items = await ProductModel.aggregate([
        {
            $match
        },
        ...buildPipeline(),
        {
            $addFields: {
                variants: {
                    $map: {
                        input: "$variants",
                        as: "v",
                        in: {
                            $mergeObjects: [
                                "$$v",
                                {
                                    discountPercent: {
                                        $cond: [
                                            { $eq: ["$$v.price.amount", 0] },
                                            0,
                                            {
                                                $round: [
                                                    {
                                                        $multiply: [
                                                            {
                                                                $divide: [
                                                                    "$$v.offer.amount",
                                                                    "$$v.price.amount"
                                                                ]
                                                            },
                                                            100
                                                        ]
                                                    },
                                                    1 // 1 decimal place
                                                ]
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        },
        {
            $sort: {
                "variants.discountPercent": -1
            }
        },
        {
            $skip: (page - 1) * perPage
        },
        {
            $limit: perPage
        }
    ]);

    return { total, items }
}


export async function getNewestProducts({ page = 1, perPage = 12, q }: Props) {
    const $match: FilterQuery<any> = {
        status: "active",
    };

    if (q?.trim()) {
        $match.$text = {
            $search: q.trim()
        };
    };

    const total = await ProductModel.countDocuments($match);


    const items = await ProductModel.aggregate([
        {
            $match
        },
        ...buildPipeline(),
        {
            $sort: {
                _id: -1
            }
        },
        {
            $skip: (page - 1) * perPage
        },
        {
            $limit: perPage
        }
    ]);

    return { total, items }
}