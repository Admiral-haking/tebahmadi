import { Document, model, Model, models, Schema, Types } from "mongoose";

export interface BslVariant extends Document<Types.ObjectId> {
    productId?: Types.ObjectId
    variantId?: Types.ObjectId
    barcode: string
    bslVariantId: number | null
    bslProductId: number
    quantity: number
    displayName: string
    vendorId: string
    sku: string
    price: number
}

const schema = new Schema<BslVariant>({
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
    sku: {
        type: String,
        trim: true
    },
    bslVariantId: {
        type: Number,
        default: null
    },
    bslProductId: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
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
}, {
    timestamps: true // adds createdAt and updatedAt fields
});

schema.index({ productId: 1, variantId: 1 });
schema.index({ vendorId: 1, bslProductId: 1, bslVariantId: 1 }, { unique: true });
schema.index({ vendorId: 1, barcode: 1 });

if (process.env.NODE_ENV === "development") {
    delete models.bslVariant
}
const BslVariantModel: Model<BslVariant> = models.bslVariant || model<BslVariant>("bslVariant", schema);

export async function ensureBslVariantIndexes() {
    await BslVariantModel.collection.createIndex(
        { vendorId: 1, bslProductId: 1, bslVariantId: 1 },
        { unique: true, name: "vendorId_1_bslProductId_1_bslVariantId_1" },
    );
    await BslVariantModel.collection.createIndex(
        { vendorId: 1, barcode: 1 },
        { name: "vendorId_1_barcode_1" },
    );
    // Display/reconcile $lookups + presence match on variantId OR barcode.
    await BslVariantModel.collection.createIndex({ variantId: 1 }, { name: "variantId_1" });
    await BslVariantModel.collection.createIndex({ barcode: 1 }, { name: "barcode_1" });
}


export default BslVariantModel;
