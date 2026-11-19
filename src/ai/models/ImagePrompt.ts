import { Schema, model, models, type HydratedDocument } from "mongoose";

export interface ImagePromptSchema {
    name: string;
    prompt: string;
    createdAt: Date;
    updatedAt: Date;
}

export type ImagePromptDocument = HydratedDocument<ImagePromptSchema>;

const imagePromptSchema = new Schema<ImagePromptSchema>(
    {
        name: { type: String, required: true, trim: true },
        prompt: { type: String, required: true, trim: true },
    },
    {
        timestamps: true,
    },
);

imagePromptSchema.index({ createdAt: -1 });

const ImagePromptModel =
    models.ImagePrompt || model<ImagePromptSchema>("ImagePrompt", imagePromptSchema, "ai_image_prompts");

export default ImagePromptModel;
