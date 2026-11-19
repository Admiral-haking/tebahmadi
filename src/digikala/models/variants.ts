import { Document, model, Model, models, Schema, Types } from "mongoose";

interface DgkVariants extends Document<Types.ObjectId> {
    productId?: Types.ObjectId
    variantId?: Types.ObjectId
    barcode: string
    dgkVariantId: number
    dgkProductId: number
    quantity: number
    displayName: string
    vendorId: string
    price: number
}

const schema = new Schema<DgkVariants>({
    productId: {
        type: Schema.Types.ObjectId,
    },
    variantId: {
        type: Schema.Types.ObjectId,
    },
    barcode: {
        type: String,
    },
    dgkVariantId: {
        type: Number,
        required: true,
    },
    dgkProductId: {
        type: Number,
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

schema.index({ productId: 1, variantId: 1 });
schema.index({ vendorId: 1, dgkVariantId: 1 }, { unique: true });
schema.index({ vendorId: 1, barcode: 1 });

if (process.env.NODE_ENV === "development") {
    delete models.dgkVariant
}
const DgkVariantModel: Model<DgkVariants> = models.dgkVariant || model<DgkVariants>("dgkVariant", schema);

export async function ensureDgkVariantIndexes() {
    const legacyIndex = "dgkVariantId_1";

    try {
        const indexes = await DgkVariantModel.collection.indexes();
        const index = indexes.find((item) => item.name === legacyIndex);

        if (index?.unique) {
            await DgkVariantModel.collection.dropIndex(legacyIndex);
        }
    } catch (err: any) {
        if (err?.codeName !== "IndexNotFound" && err?.code !== 27) {
            console.error("dgk legacy variant index cleanup failed", err);
        }
    }

    await DgkVariantModel.collection.createIndex(
        { vendorId: 1, dgkVariantId: 1 },
        { unique: true, name: "vendorId_1_dgkVariantId_1" },
    );
    await DgkVariantModel.collection.createIndex(
        { vendorId: 1, barcode: 1 },
        { name: "vendorId_1_barcode_1" },
    );
    // The display/reconcile $lookups and presence queries match on variantId OR
    // barcode (without vendor scope), so index each on its own.
    await DgkVariantModel.collection.createIndex({ variantId: 1 }, { name: "variantId_1" });
    await DgkVariantModel.collection.createIndex({ barcode: 1 }, { name: "barcode_1" });
}


export default DgkVariantModel;
