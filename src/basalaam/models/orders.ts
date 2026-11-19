import { Document, Model, Schema, model, models } from "mongoose";

interface IBslOrder extends Document {
    amount: number
    title: string
    bslProductId: number
    bslVariantId: number
    quantity: number
    barcode?: string
    bslOrderId: number
    bslOrderItemId: number
    bslImageUrl: string
    paymentType: 'cache' | 'credit'
    bslOrderStatus: number
}

const BslOrderSchema = new Schema<IBslOrder>({
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
    bslProductId: {
        type: Number,
        required: true
    },
    bslVariantId: {
        type: Number,
        default: null
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
    bslOrderId: {
        type: Number,
        required: true,
    },
    bslOrderItemId: {
        type: Number,
        required: true,
    },
    bslOrderStatus: {
        type: Number,
        required: true,
    },
    bslImageUrl: {
        type: String,
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
BslOrderSchema.index({ status: 1 });
BslOrderSchema.index({ bslVariantId: 1 });

if (process.env.NODE_ENV === 'development') {
    delete models.BslOrder
}

const BslOrder: Model<IBslOrder> = models.BslOrder || model<IBslOrder>('BslOrder', BslOrderSchema);

export default BslOrder;