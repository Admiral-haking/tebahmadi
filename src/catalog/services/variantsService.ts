import { PipelineStage, Types } from "mongoose";
import ProductModel, { VariantSchema } from "../models/Product";
import { syncLinkedVariantToServices } from "@/sync/service-stock";
import { normalizeStock } from "@/lib/stock";
import { revalidatePath, revalidateTag } from "next/cache";
import { TAGS } from "@/lib/cache";

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const searchVariantsWithDisplayName = async (searchTerm: string, page = 1, limit = 20, from_updated_date?: Date) => {
    const skip = (page - 1) * limit;
    const cleanSearchTerm = searchTerm.trim();
    const safeSearchTerm = escapeRegex(cleanSearchTerm);
    const searchMatch: PipelineStage.Match | null = safeSearchTerm
        ? {
            $match: {
                $or: [
                    { displayName: { $regex: safeSearchTerm, $options: 'i' } },
                    { 'variants.barcode': { $regex: safeSearchTerm, $options: 'i' } },
                    { 'variants.sku': { $regex: safeSearchTerm, $options: 'i' } },
                ]
            }
        }
        : null;

    const pipeline: PipelineStage[] = [
        // Match only products with variants
        { $match: { 'variants.0': { $exists: true } } },

        // Unwind variants
        { $unwind: '$variants' },

        // Lookup product type data
        {
            $lookup: {
                from: 'producttypes',
                localField: 'productTypeId',
                foreignField: '_id',
                as: 'productType'
            }
        },
        { $unwind: { path: '$productType', preserveNullAndEmptyArrays: true } },

        // Add dynamic displayName
        {
            $addFields: {
                displayName: {
                    $let: {
                        vars: {
                            attrStrings: {
                                $map: {
                                    input: '$variants.attributeValues',
                                    as: 'attr',
                                    in: {
                                        $cond: {
                                            if: { $eq: ['$$attr.key', 'weightGrams'] },
                                            then: null,
                                            else: {
                                                $let: {
                                                    vars: {
                                                        attributeDef: {
                                                            $first: {
                                                                $filter: {
                                                                    input: { $ifNull: ['$productType.attributes', []] },
                                                                    cond: { $eq: ['$$this.key', '$$attr.key'] }
                                                                }
                                                            }
                                                        }
                                                    },
                                                    in: {
                                                        $concat: [
                                                            { $ifNull: ['$$attributeDef.label', '$$attr.key'] },
                                                            ': ',
                                                            {
                                                                $cond: {
                                                                    // Check if value is an object (color)
                                                                    if: { $eq: [{ $type: '$$attr.value' }, 'object'] },
                                                                    then: { $ifNull: ['$$attr.value.name', ''] },
                                                                    else: { $toString: '$$attr.value' }
                                                                }
                                                            }
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        in: {
                            $cond: {
                                if: {
                                    $eq: [
                                        {
                                            $size: {
                                                $filter: {
                                                    input: '$$attrStrings',
                                                    cond: { $ne: ['$$this', null] }
                                                }
                                            }
                                        },
                                        0
                                    ]
                                },
                                then: '$title',
                                else: {
                                    $concat: [
                                        '$title',
                                        ' | ',
                                        {
                                            $reduce: {
                                                input: {
                                                    $filter: {
                                                        input: '$$attrStrings',
                                                        cond: { $ne: ['$$this', null] }
                                                    }
                                                },
                                                initialValue: '',
                                                in: {
                                                    $cond: {
                                                        if: { $eq: ['$$value', ''] },
                                                        then: '$$this',
                                                        else: { $concat: ['$$value', ', ', '$$this'] }
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },

        ...(searchMatch ? [searchMatch] : []),

        // Project the final shape
        {
            $project: {
                _id: '$variants._id',
                sku: '$variants.sku',
                displayName: 1,
                price: '$variants.price',
                offer: '$variants.offer',
                inventory: '$variants.inventory',
                minimumOrderQuantity: '$variants.minimumOrderQuantity',
                maximumOrderQuantity: '$variants.maximumOrderQuantity',
                mediaIds: '$variants.mediaIds',
                barcode: '$variants.barcode',
                active: '$variants.active',
                colorKey: '$variants.colorKey',
                colorName: '$variants.colorName',
                colorSwatches: '$variants.colorSwatches',
                colorFamily: '$variants.colorFamily',
                createdAt: '$variants.createdAt',
                updatedAt: '$variants.updatedAt',
                product: {
                    _id: '$_id',
                    title: '$title',
                    slug: '$slug',
                    brand: '$brand',
                    status: '$status'
                }
            }
        },

        // Pagination
        { $sort: { _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        // Marketplace links: match on variantId OR barcode. A bare variantId join
        // breaks whenever the catalog is re-imported (variant subdocument _ids are
        // regenerated, orphaning every marketplace record). barcode is the stable
        // business key the sync itself links on, so falling back to it keeps the
        // connections visible after a re-import. Matching by barcode is additive —
        // it never removes a variantId match.
        ...(["dgkvariants", "bslvariants", "snpvariants"] as const).map((from, i) => ({
            $lookup: {
                from,
                let: { vid: "$_id", bc: "$barcode" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    { $eq: ["$variantId", "$$vid"] },
                                    {
                                        $and: [
                                            { $ne: ["$$bc", null] },
                                            { $ne: ["$$bc", ""] },
                                            { $eq: ["$barcode", "$$bc"] },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                ],
                as: ["dgk", "bsl", "snp"][i],
            },
        }) as PipelineStage),
    ];

    // Count pipeline (simplified)
    const countPipeline: PipelineStage[] = [
        { $match: { 'variants.0': { $exists: true } } },
        { $unwind: '$variants' },
        {
            $lookup: {
                from: 'producttypes',
                localField: 'productTypeId',
                foreignField: '_id',
                as: 'productType'
            }
        },
        { $unwind: { path: '$productType', preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                displayName: {
                    $let: {
                        vars: {
                            attrStrings: {
                                $map: {
                                    input: '$variants.attributeValues',
                                    as: 'attr',
                                    in: {
                                        $cond: {
                                            if: { $eq: ['$$attr.key', 'weightGrams'] },
                                            then: null,
                                            else: {
                                                $let: {
                                                    vars: {
                                                        attributeDef: {
                                                            $first: {
                                                                $filter: {
                                                                    input: { $ifNull: ['$productType.attributes', []] },
                                                                    cond: { $eq: ['$$this.key', '$$attr.key'] }
                                                                }
                                                            }
                                                        }
                                                    },
                                                    in: {
                                                        $concat: [
                                                            { $ifNull: ['$$attributeDef.label', '$$attr.key'] },
                                                            ': ',
                                                            {
                                                                $cond: {
                                                                    if: { $eq: [{ $type: '$$attr.value' }, 'object'] },
                                                                    then: { $ifNull: ['$$attr.value.name', ''] },
                                                                    else: { $toString: '$$attr.value' }
                                                                }
                                                            }
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        in: {
                            $cond: {
                                if: {
                                    $eq: [
                                        {
                                            $size: {
                                                $filter: {
                                                    input: '$$attrStrings',
                                                    cond: { $ne: ['$$this', null] }
                                                }
                                            }
                                        },
                                        0
                                    ]
                                },
                                then: '$title',
                                else: {
                                    $concat: [
                                        '$title',
                                        ' | ',
                                        {
                                            $reduce: {
                                                input: {
                                                    $filter: {
                                                        input: '$$attrStrings',
                                                        cond: { $ne: ['$$this', null] }
                                                    }
                                                },
                                                initialValue: '',
                                                in: {
                                                    $cond: {
                                                        if: { $eq: ['$$value', ''] },
                                                        then: '$$this',
                                                        else: { $concat: ['$$value', ' | ', '$$this'] }
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        ...(searchMatch ? [searchMatch] : []),
        { $count: 'total' }
    ];

    if (from_updated_date) {
        const stage: PipelineStage = {
            $match: { updatedAt: { $gte: from_updated_date } }
        }
        pipeline.unshift(stage);
        countPipeline.unshift(stage);
    }

    const [variants, countResult] = await Promise.all([
        ProductModel.aggregate(pipeline),
        ProductModel.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total || 0;

    return {
        data: variants,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};


interface PatchVariantInput {
    variantId: Types.ObjectId | string;
    updates: Partial<{
        price: number;
        quantity: number;
        offer: number;
        active: boolean;
        barcode?: string;
        old_barcode?: string;
    }>;
}

export const patchVariant = async (input: PatchVariantInput, sync = false) => {
    const { variantId, updates } = input;

    // Build dynamic update object for the specific variant
    const updateObject: any = {};

    if (updates.price !== undefined) {
        updateObject[`variants.$.price.amount`] = updates.price;
    }
    if (updates.quantity !== undefined) {
        // Stock can never be negative.
        updates.quantity = normalizeStock(updates.quantity);
        updateObject[`variants.$.inventory.quantity`] = updates.quantity;
    }
    if (updates.barcode) {
        updateObject[`variants.$.barcode`] = updates.barcode;
    }
    if (updates.offer !== undefined) {
        updateObject[`variants.$.offer.amount`] = updates.offer;
    }
    if (updates.active !== undefined) {
        updateObject[`variants.$.active`] = Boolean(updates.active);
    }
    // Update the variant
    const result = await ProductModel.findOneAndUpdate(
        { 'variants._id': variantId },
        { $set: updateObject },
        {
            new: true,  // Return updated document
            runValidators: true  // Run schema validators
        }
    );

    if (!result) {
        throw new Error(`Variant with id ${variantId} not found`);
    }

    // Find and return the updated variant
    const updatedVariant = result.variants.find(
        (v: VariantSchema) => v._id.toString() === variantId.toString()
    );

    if (sync) {
        const resolvedBarcode = String(updatedVariant?.barcode || updatedVariant?.sku || "").trim();
        // Target the linked marketplace records (by variantId OR barcode) and push
        // each with its own barcode, so records whose barcode drifted from the
        // site (e.g. after a re-import) still get updated.
        const stock =
            updates.quantity !== undefined
                ? updates.quantity
                : typeof updates.barcode === "string" && updates.barcode.trim().length > 0
                    ? Math.max(0, Number(updatedVariant?.inventory?.quantity ?? 0) || 0)
                    : undefined;

        if (stock !== undefined || updates.price !== undefined) {
            await syncLinkedVariantToServices(variantId, resolvedBarcode, {
                stock,
                price: updates.price,
            });
        }
    }
    revalidateTag(TAGS.PRODUCT_LIST);
    revalidateTag(TAGS.PRODUCT(result.slug));
    revalidatePath("/")

    return {
        product: result,
        variant: updatedVariant
    };
};
