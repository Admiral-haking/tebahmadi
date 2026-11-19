import { Schema, model, models, type HydratedDocument, type Model, Types } from 'mongoose';
import type { AvatarVariantIds, Permission, UserRole } from '@/types';

interface AvatarVariantSchema {
  originalId: Types.ObjectId;
  mobileId: Types.ObjectId;
  thumbId: Types.ObjectId;
  groupId: Types.ObjectId;
}

export interface UserSchema {
  phone: string;
  fname?: string;
  lname?: string;
  age?: number;
  state?: string;
  city?: string;
  address?: string;
  avatar?: AvatarVariantSchema;
  roles: UserRole[];
  permissions?: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserSchema>;

export type UserLean = Omit<UserSchema, 'avatar'> & {
  _id: string;
  avatar?: AvatarVariantIds;
  id: string;
};

const avatarSchema = new Schema<AvatarVariantSchema>(
  {
    originalId: { type: Schema.Types.ObjectId, required: true },
    mobileId: { type: Schema.Types.ObjectId, required: true },
    thumbId: { type: Schema.Types.ObjectId, required: true },
    groupId: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const userSchema = new Schema<UserSchema>(
  {
    phone: { type: String, required: true },
    fname: { type: String },
    lname: { type: String },
    age: { type: Number, min: 0, max: 120 },
    state: { type: String },
    city: { type: String },
    address: { type: String },
    avatar: { type: avatarSchema },
    roles: {
      type: [String],
      enum: ['admin', 'manager', 'staff', 'customer'],
      default: ['customer'],
    },
    permissions: {
      type: [String],
      enum: [
        'users:read',
        'users:write',
        'media:read',
        'media:write',
        'media:read:all',
        'products:read',
        'products:write',
        'orders:read',
        'orders:write',
        'promotions:write',
        'catalog:publish',
      ],
      default: undefined,
    },
  },
  { timestamps: true },
);

userSchema.index({ phone: 1 }, { unique: true });

userSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret: UserSchema & { _id: Types.ObjectId }): UserLean => {
    const avatar = ret.avatar;
    const id = ret._id.toString();

    const serialized: UserLean = {
      ...ret,
      _id: id,
      id,
      avatar: avatar
        ? {
          originalId: avatar.originalId.toString(),
          mobileId: avatar.mobileId.toString(),
          thumbId: avatar.thumbId.toString(),
          groupId: avatar.groupId.toString(),
        }
        : undefined,
    };

    if (!serialized.avatar) {
      delete serialized.avatar;
    }

    return serialized;
  },
});

const UserModel: Model<UserSchema> = models.User || model<UserSchema>('User', userSchema);

export default UserModel;
