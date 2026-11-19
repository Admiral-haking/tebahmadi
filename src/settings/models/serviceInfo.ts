import { Document, Model, model, models, Schema, Types } from "mongoose";

const COLLECTION = 'service_info';

export type IServiceType = "dgk" | "basalaam" | "snapp" | "holoo";

interface IServiceInfo extends Document<Types.ObjectId> {
    service: IServiceType,
    id: string
    data: any
    vendorId: string
}

const schema = new Schema<IServiceInfo>({
    service: {
        type: String,
        enum: ["dgk", "basalaam", "snapp", "holoo"],
        required: true,
    },
    id: {
        type: String,
        required: true
    },
    vendorId: {
        type: String,
        required: true
    },
    data: {
        type: Schema.Types.Mixed,
        required: true
    }
});

schema.index({ service: 1, id: -1, vendorId: 1 }, { unique: true })


const ServiceInfoModel: Model<IServiceInfo> = models[COLLECTION] || model<IServiceInfo>(COLLECTION, schema);


export default ServiceInfoModel;