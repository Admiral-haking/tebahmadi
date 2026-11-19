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

    const item = await ServiceInfoModel.findOne({ service, id, vendorId }).lean();

    if (!item) return await ServiceInfoModel.create({ service, id, vendorId, data });

    return await ServiceInfoModel.updateOne({ service, id, vendorId }, { $set: { data } });
}
