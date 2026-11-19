import { Document, Model, model, models, Schema, Types } from "mongoose";
import { IServiceType } from "./serviceInfo";

interface IService extends Document<Types.ObjectId> {
    service: IServiceType
    vendors: string[]
}

const schema = new Schema<IService>({
    service: {
        type: String,
        enum: ["dgk", "basalaam", "snapp"],
        required: true,
        unique: true
    },
    vendors: {
        type: [String],
        required: true
    },
});


const VendorModel: Model<IService> = models.Vendor || model<IService>("Vendor", schema);

export default VendorModel;