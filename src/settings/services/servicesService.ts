import { connectMongoose } from "@/lib/mongoose";
import ServiceInfoModel, { IServiceType } from "../models/serviceInfo";

export async function getServiceInfo<T = any>(service: IServiceType, id: string, vendorId: string) {
    await connectMongoose();

    const item = await ServiceInfoModel.findOne({ service, id, vendorId }).lean();

    if (!item) return null;

    return item.data as T
}

export async function setServiceInfo<T = any>(service: IServiceType, id: string, vendorId: string, data: T) {
    await connectMongoose();

    // Let MongoDB perform registration as one atomic upsert. A read-then-create
    // sequence can race when an operator retries credential registration and
    // surface a duplicate-key error even though the credentials are valid.
    return ServiceInfoModel.findOneAndUpdate(
        { service, id, vendorId },
        { $set: { data } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );
}
