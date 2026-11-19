import { Document, Types, Schema, model, Model, models } from "mongoose";

interface ITracker extends Document {
    orderId: string
    amount: number
    vendorId?: string
    items: {
        serviceVariantId: string
        variantId?: Types.ObjectId
        title: string
        quantity: number
        src?: string
        url?: string
        trackingCode?: string
        city?: string
        state?: string
    }[]
    serviceId: string
    orderStatus?: string
    progressState?: string
    discount: number
    shippingServiceName?: string
    shippingServiceId?: string
    customerName?: string
    customerPhone?: string
    customerPostalCode?: string
    customerAddress?: string
    customerCity?: string
    customerState?: string
    customerHouseNumber?: string
    customerHouseUnit?: string
}

// Create the schema
const trackerSchema = new Schema<ITracker>(
    {
        orderId: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        vendorId: {
            type: String,
            required: false,
            trim: true,
            index: true
        },
        items: [
            {
                variantId: {
                    type: Schema.Types.ObjectId,
                    required: false,
                },
                serviceVariantId: {
                    type: String,
                    required: true,
                    trim: true
                },
                title: {
                    type: String,
                    trim: true
                },
                quantity: {
                    type: Number,
                    required: true
                },
                src: {
                    type: String,
                    required: false,
                    trim: true
                },
                url: {
                    type: String,
                    required: false,
                    trim: true
                },
                trackingCode: {
                    type: String,
                    required: false,
                },
                city: {
                    type: String,
                    required: false,
                },
                state: {
                    type: String,
                    required: false,
                },
            }
        ],
        serviceId: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        orderStatus: {
            type: String,
            required: false,
            trim: true,
            index: true
        },
        progressState: {
            type: String,
            required: false,
            trim: true,
            index: true
        },
        discount: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        shippingServiceName: {
            type: String,
            required: false,
            trim: true
        },
        shippingServiceId: {
            type: String,
            required: false,
            trim: true,
            index: true
        },
        customerName: {
            type: String,
            required: false,
            trim: true,
            index: true
        },
        customerPhone: {
            type: String,
            required: false,
            trim: true,
            index: true
        },
        customerPostalCode: {
            type: String,
            required: false,
            trim: true,
            index: true
        },
        customerAddress: {
            type: String,
            required: false,
            trim: true
        },
        customerCity: {
            type: String,
            required: false,
            trim: true,
            index: true
        },
        customerState: {
            type: String,
            required: false,
            trim: true,
            index: true
        },
        customerHouseNumber: {
            type: String,
            required: false,
            trim: true
        },
        customerHouseUnit: {
            type: String,
            required: false,
            trim: true
        }
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt
        versionKey: false // Removes __v field
    }
);

trackerSchema.statics.findByTrackingCode = function (trackingCode: string) {
    return this.findOne({ trackingCode });
};

if (process.env.NODE_ENV === 'development') {
    delete models.Tracker
}

export const TrackerModel: Model<ITracker> = models.Tracker || model<ITracker>('Tracker', trackerSchema);
