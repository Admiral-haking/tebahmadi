import { Document, model, Model, models, Schema, Types } from "mongoose";

export interface SnapVariant extends Document<Types.ObjectId> {
    productId?: Types.ObjectId
    variantId?: Types.ObjectId
    barcode: string
    snpProductId: string
    quantity: number
    displayName: string
    vendorId: string
    price: number
}

const schema = new Schema<SnapVariant>({
    productId: {
        type: Schema.Types.ObjectId,
    },
    variantId: {
        type: Schema.Types.ObjectId,
    },
    barcode: {
        type: String,
        trim: true
    },
    snpProductId: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    displayName: {
        type: String,
        required: true,
    },
    vendorId: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true
    },
}, {
    timestamps: true // adds createdAt and updatedAt fields
});

// Compound + single-field indexes for the hot sync queries.
schema.index({ productId: 1, variantId: 1, });
schema.index({ snpProductId: 1 });        // upsert filter + page existing lookup
schema.index({ vendorId: 1, barcode: 1 }); // snpSyncStock / price lookups
schema.index({ variantId: 1 });            // display/reconcile/presence (variantId OR barcode)
schema.index({ barcode: 1 });

if (process.env.NODE_ENV === "development") {
    delete models.snpVariant
}
const SnapVariantModel: Model<SnapVariant> = models.snpVariant || model<SnapVariant>("snpVariant", schema);

/**
 * Build the Snapp variant indexes explicitly (production has autoIndex off).
 * Called at the start of each variant sync; createIndex is a no-op when the
 * index already exists.
 */
export async function ensureSnpVariantIndexes() {
    await Promise.all([
        SnapVariantModel.collection.createIndex({ snpProductId: 1 }, { name: "snpProductId_1" }),
        SnapVariantModel.collection.createIndex({ vendorId: 1, barcode: 1 }, { name: "vendorId_1_barcode_1" }),
        SnapVariantModel.collection.createIndex({ variantId: 1 }, { name: "variantId_1" }),
        SnapVariantModel.collection.createIndex({ barcode: 1 }, { name: "barcode_1" }),
    ]).catch((err) => console.error("snp variant index ensure failed", err));
}


export default SnapVariantModel;