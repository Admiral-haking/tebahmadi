import { IServiceType } from "../models/serviceInfo";
import VendorModel from "../models/vendor";

export async function getVendors(service: IServiceType) {
    const item = await VendorModel.findOne({ service }).lean();

    if (!item) return [];

    return item.vendors;
}


export async function setVendors(service: IServiceType, vendors: string | string[]) {
    await VendorModel.updateOne({ service }, typeof vendors === 'string' ? { $addToSet: { vendors } } : { $set: { vendors } }, { upsert: true })
}