import { Document, Model, Schema, model, models } from "mongoose";

interface IDgkOrder extends Document {
    amount: number
    title: string
    dgkVariantId: number
    quantity: number
    barcode?: string
    dgkOrderId: number
    dgkOrderItemId: number
    dgkImageUrl: string
    status: 'pending' | 'processed' | 'returned' | 'canceled'
    paymentType: 'cache' | 'credit'
}

const DgkOrderSchema = new Schema<IDgkOrder>({
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
    dgkVariantId: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    barcode: {
        type: String,
        required: false,
        trim: true
    },
    dgkOrderId: {
        type: Number,
        required: true,
    },
    dgkOrderItemId: {
        type: Number,
        required: true,
    },
    dgkImageUrl: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processed', 'returned', 'canceled'],
        default: 'pending'
    },
    paymentType: {
        type: String,
        required: true,
        enum: ['cache', 'credit'],
        default: 'cache'
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Optional: Add indexes for better query performance
DgkOrderSchema.index({ status: 1 });
DgkOrderSchema.index({ dgkVariantId: 1 });

if (process.env.NODE_ENV === 'development') {
    delete models.DgkOrder
}

const DgkOrder: Model<IDgkOrder> = models.DgkOrder || model<IDgkOrder>('DgkOrder', DgkOrderSchema);

export default DgkOrder;