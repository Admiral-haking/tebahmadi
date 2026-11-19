import { connectMongoose } from "@/lib/mongoose";
import { Document, model, Model, models, Schema } from "mongoose";

interface ILock extends Document {
    syncId: string
    locked: boolean

    createdAt: Date
    updatedAt: Date
}

const schema = new Schema<ILock>({
    syncId: { type: String, required: true, unique: true },
    locked: { type: Boolean, default: true }
}, { timestamps: true })

const syncModel: Model<ILock> = models.Lock || model<ILock>("Lock", schema);


export default async function syncLockStatus(syncId: string) {
    await connectMongoose();

    await syncModel.deleteOne({ syncId, createdAt: { $lte: new Date(Date.now() - (1e3 * 60 * 30)) } });

    let status = await syncModel.findOne({ syncId });

    if (!status) {
        await syncModel.create({ syncId, locked: false });
        status = await syncModel.findOne({ syncId });
    }

    async function lock() {
        await syncModel.updateOne({ syncId }, { $set: { locked: true } });
    }
    async function unlock() {
        await syncModel.updateOne({ syncId }, { $set: { locked: false } });
    }

    return {
        locked: !!status?.locked,
        lock,
        unlock
    }

}