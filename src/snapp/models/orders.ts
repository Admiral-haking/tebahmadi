import { Document, Model, Schema, model, models } from "mongoose";

interface ISnpOrder extends Document {
    amount: number
    title: string
    snpVariantId: string
    quantity: number
    barcode?: string
    snpOrderId: number
    status: string
}

const SnpOrderSchema = new Schema<ISnpOrder>({
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    snpVariantId: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    barcode: {
        type: String,
        required: false,
        trim: true
    },
    snpOrderId: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        required: true,
    },
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Optional: Add indexes for better query performance
SnpOrderSchema.index({ status: 1 });
SnpOrderSchema.index({ snpVariantId: 1 });

if (process.env.NODE_ENV === 'development') {
    delete models.SnpOrder
}

const SnpOrder: Model<ISnpOrder> = models.SnpOrder || model<ISnpOrder>('SnpOrder', SnpOrderSchema);

export default SnpOrder;
