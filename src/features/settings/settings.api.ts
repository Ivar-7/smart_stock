import {
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { logDiagnosticError, toAppError, type AppError } from '../../shared/errors';
import { shopDocRef } from '../../shared/firebase/collections';
import { getFirebaseDb } from '../../shared/firebase/firebaseClient';
import { timestampToIso } from '../../shared/firebase/firestoreHelpers';
import { shopProfileDocSchema, shopSettingsSchema } from './settings.schema';
import type { ShopProfile, ShopSettingsInput } from './settings.types';

function decodeShopProfile(raw: Record<string, unknown>, ownerUid: string): ShopProfile | null {
  const normalized = {
    ownerUid: typeof raw.ownerUid === 'string' ? raw.ownerUid : ownerUid,
    name: raw.name,
    currency: raw.currency,
    serviceLevelTarget: raw.serviceLevelTarget,
    defaultReviewCycleDays: raw.defaultReviewCycleDays,
    bulkMultiplierThreshold: raw.bulkMultiplierThreshold,
    browserAlertsEnabled: Boolean(raw.browserAlertsEnabled),
    seededAt: raw.seededAt ? timestampToIso(raw.seededAt) : null,
  };
  const parsed = shopProfileDocSchema.safeParse(normalized);
  if (!parsed.success) {
    return null;
  }
  return {
    ...parsed.data,
    createdAt: timestampToIso(raw.createdAt),
    updatedAt: timestampToIso(raw.updatedAt),
  };
}

export function subscribeToShopProfile(
  shopId: string,
  onProfile: (profile: ShopProfile | null) => void,
  onError: (error: AppError) => void,
): Unsubscribe {
  return onSnapshot(
    shopDocRef(shopId),
    (snap) => {
      if (!snap.exists()) {
        onProfile(null);
        return;
      }
      onProfile(decodeShopProfile(snap.data(), shopId));
    },
    (error) => {
      onError(logDiagnosticError(error, 'settings.subscribeToShopProfile', { shopId }));
    },
  );
}

export async function ensureShopProfile(
  shopId: string,
  defaultName = 'Cornerstone Provisions',
): Promise<ShopProfile> {
  try {
    const db = getFirebaseDb();
    const ref = shopDocRef(shopId);

    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const existing = decodeShopProfile(snap.data(), shopId);
        if (existing) {
          return existing;
        }
      }

      const payload: ShopSettingsInput = {
        name: defaultName.slice(0, 80) || 'Cornerstone Provisions',
        currency: 'USD',
        serviceLevelTarget: 0.95,
        defaultReviewCycleDays: 7,
        bulkMultiplierThreshold: 3.5,
        browserAlertsEnabled: false,
      };

      tx.set(ref, {
        ...payload,
        ownerUid: shopId,
        seededAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const now = new Date().toISOString();
      return {
        ...payload,
        ownerUid: shopId,
        seededAt: null,
        createdAt: now,
        updatedAt: now,
      };
    });
  } catch (error) {
    throw logDiagnosticError(error, 'settings.ensureShopProfile', { shopId });
  }
}

export async function updateShopSettings(shopId: string, input: ShopSettingsInput): Promise<void> {
  try {
    const validated = shopSettingsSchema.parse(input);
    await updateDoc(shopDocRef(shopId), {
      ...validated,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(error, 'Unable to save shop settings.');
  }
}
