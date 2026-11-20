import type { AvatarVariantIds, Permission, UserRole } from '@/types';

export interface AuthUser {
  _id: string;
  id: string;
  phone: string;
  fname?: string;
  lname?: string;
  age?: number;
  state?: string;
  city?: string;
  address?: string;
  avatar?: AvatarVariantIds;
  roles: UserRole[];
  permissions?: Permission[];
  createdAt?: string;
  updatedAt?: string;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

export type LoginStep = 'idle' | 'requesting' | 'code-sent' | 'verifying';

export interface LoginContextValue {
  phone: string;
  code: string;
  step: LoginStep;
  error: string | null;
  isSubmitting: boolean;
  manualCode: boolean;
  requestCode: (phone: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  reset: () => void;
  setPhone: (value: string) => void;
  setCode: (value: string) => void;
}
