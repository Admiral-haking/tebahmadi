import type { MediaKind, MediaScope } from '@/types';

export interface MediaListItem {
  id: string;
  groupId: string;
  kind: MediaKind;
  scope: MediaScope;
  filename: string;
  contentType: string;
  originalId: string;
  mobileId?: string;
  thumbId?: string;
  ownerUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type FilterScope = MediaScope | 'all';
export type FilterKind = MediaKind | 'all';

export interface MediaFilterState {
  scope: FilterScope;
  kind: FilterKind;
  q: string;
  owner: string;
}
