import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  registerShopAccount,
  signInDemoShop,
  signInWithEmail,
  signInWithGooglePopup,
  signOutShop,
  subscribeToAuthState,
} from '../features/auth/auth.api';
import type { AuthUserSummary } from '../features/auth/auth.types';
import { AuthContext } from '../features/auth/useAuth';
import { seedShopWorkspace } from '../features/seed/seed.api';
import { ensureShopProfile } from '../features/settings/settings.api';
import { toAppError, type AppError } from '../shared/errors';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = subscribeToAuthState(
        (nextUser) => {
          setUser(nextUser);
          setIsReady(true);
        },
        (err) => {
          setError(toAppError(err));
          setIsReady(true);
        },
      );
      return unsubscribe;
    } catch (err) {
      queueMicrotask(() => {
        setError(toAppError(err));
        setIsReady(true);
      });
      return undefined;
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    setIsBusy(true);
    setIsProvisioning(true);
    setError(null);
    try {
      const signedUser = await signInWithEmail(email, password);
      await ensureShopProfile(signedUser.uid);
    } catch (err) {
      const mapped = toAppError(err);
      setError(mapped);
      throw mapped;
    } finally {
      setIsProvisioning(false);
      setIsBusy(false);
    }
  }, []);

  const signUpEmail = useCallback(
    async (email: string, password: string, shopName: string, seedSampleData: boolean) => {
      setIsBusy(true);
      setIsProvisioning(true);
      setError(null);
      try {
        const created = await registerShopAccount(email, password, shopName);
        if (seedSampleData) {
          await seedShopWorkspace(created.uid, { shopName });
        } else {
          await ensureShopProfile(created.uid, shopName);
        }
      } catch (err) {
        const mapped = toAppError(err);
        setError(mapped);
        throw mapped;
      } finally {
        setIsProvisioning(false);
        setIsBusy(false);
      }
    },
    [],
  );

  const signInGoogle = useCallback(async () => {
    setIsBusy(true);
    setIsProvisioning(true);
    setError(null);
    try {
      const signedUser = await signInWithGooglePopup();
      await ensureShopProfile(
        signedUser.uid,
        signedUser.displayName ? `${signedUser.displayName}'s Shop` : 'Cornerstone Provisions',
      );
    } catch (err) {
      const mapped = toAppError(err);
      setError(mapped);
      throw mapped;
    } finally {
      setIsProvisioning(false);
      setIsBusy(false);
    }
  }, []);

  const signInDemo = useCallback(async () => {
    setIsBusy(true);
    setIsProvisioning(true);
    setError(null);
    try {
      const demoUser = await signInDemoShop();
      await seedShopWorkspace(demoUser.uid, {
        shopName: 'Cornerstone Provisions',
        clearExisting: false,
      });
    } catch (err) {
      const mapped = toAppError(err);
      setError(mapped);
      throw mapped;
    } finally {
      setIsProvisioning(false);
      setIsBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      await signOutShop();
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setIsBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      isReady,
      isBusy,
      isProvisioning,
      error,
      signInEmail,
      signUpEmail,
      signInGoogle,
      signInDemo,
      signOut,
      clearError,
    }),
    [
      user,
      isReady,
      isBusy,
      isProvisioning,
      error,
      signInEmail,
      signUpEmail,
      signInGoogle,
      signInDemo,
      signOut,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
