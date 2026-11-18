import { createContext, useContext } from 'react';
import type { AppError } from '../../shared/errors';
import type { AuthUserSummary } from './auth.types';

export interface AuthContextValue {
  user: AuthUserSummary | null;
  isReady: boolean;
  isBusy: boolean;
  isProvisioning: boolean;
  error: AppError | null;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (
    email: string,
    password: string,
    shopName: string,
    seedSampleData: boolean,
  ) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
