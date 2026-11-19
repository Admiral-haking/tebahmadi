export type UserRole = 'admin' | 'manager' | 'staff' | 'customer';

export type Permission =
  | 'users:read'
  | 'users:write'
  | 'media:read'
  | 'media:write'
  | 'media:read:all'
  | 'products:read'
  | 'products:write'
  | 'orders:read'
  | 'orders:write'
  | 'promotions:write'
  | 'catalog:publish';

export type MediaScope = 'avatar' | 'attachment' | 'gallery';

export type MediaKind = 'image' | 'file';

export interface AvatarVariantIds {
  originalId: string;
  mobileId: string;
  thumbId: string;
  groupId: string;
}
