import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Unsubscribe,
} from 'firebase/auth';
import { logDiagnosticError } from '../../shared/errors';
import { getFirebaseAuth } from '../../shared/firebase/firebaseClient';
import { mapFirebaseUser, type AuthUserSummary } from './auth.types';

export function subscribeToAuthState(
  onUser: (user: AuthUserSummary | null) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(
    auth,
    (user) => {
      onUser(user ? mapFirebaseUser(user) : null);
    },
    (error) => {
      onError(logDiagnosticError(error, 'auth.subscribe'));
    },
  );
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUserSummary> {
  try {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    return mapFirebaseUser(cred.user);
  } catch (error) {
    throw logDiagnosticError(error, 'auth.signInWithEmail');
  }
}

export async function registerShopAccount(
  email: string,
  password: string,
  shopName: string,
): Promise<AuthUserSummary> {
  try {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    await updateProfile(cred.user, { displayName: shopName });
    return mapFirebaseUser(cred.user);
  } catch (error) {
    throw logDiagnosticError(error, 'auth.registerShopAccount');
  }
}

export async function signInWithGooglePopup(): Promise<AuthUserSummary> {
  try {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(getFirebaseAuth(), provider);
    return mapFirebaseUser(cred.user);
  } catch (error) {
    throw logDiagnosticError(error, 'auth.signInWithGooglePopup');
  }
}

export async function signInDemoShop(): Promise<AuthUserSummary> {
  try {
    const cred = await signInAnonymously(getFirebaseAuth());
    return mapFirebaseUser(cred.user);
  } catch (error) {
    throw logDiagnosticError(error, 'auth.signInDemoShop');
  }
}

export async function signOutShop(): Promise<void> {
  try {
    await signOut(getFirebaseAuth());
  } catch (error) {
    throw logDiagnosticError(error, 'auth.signOutShop');
  }
}
