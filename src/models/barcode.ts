import { Document, model, Model, models, Schema } from "mongoose";

interface IBarcode extends Document {
    name: string
    prefix: string
    last: number
}


const schema = new Schema<IBarcode>({
    name: { type: String, required: true, unique: true, trim: true },
    prefix: { type: String, required: true, unique: true, trim: true, uppercase: true },
    last: { type: Number, default: 0 }
});


const BarcodeModel: Model<IBarcode> = models.Barcode || model<IBarcode>("Barcode", schema);


export default BarcodeModel;