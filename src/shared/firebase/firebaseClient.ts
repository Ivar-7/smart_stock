import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { z } from 'zod';
import { AppError } from '../errors';

const firebaseEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1, 'Missing VITE_FIREBASE_API_KEY'),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Missing VITE_FIREBASE_AUTH_DOMAIN'),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1, 'Missing VITE_FIREBASE_PROJECT_ID'),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Missing VITE_FIREBASE_STORAGE_BUCKET'),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, 'Missing VITE_FIREBASE_MESSAGING_SENDER_ID'),
  VITE_FIREBASE_APP_ID: z.string().min(1, 'Missing VITE_FIREBASE_APP_ID'),
  VITE_FIREBASE_MEASUREMENT_ID: z.string().optional(),
});

function readFirebaseConfig() {
  const parsed = firebaseEnvSchema.safeParse({
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  });

  if (!parsed.success) {
    throw new AppError({
      code: 'ENV_CONFIG_ERROR',
      userMessage: 'Firebase configuration is incomplete. Check your .env environment settings.',
      technicalMessage: parsed.error.message,
      recoverable: false,
    });
  }

  return {
    apiKey: parsed.data.VITE_FIREBASE_API_KEY,
    authDomain: parsed.data.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: parsed.data.VITE_FIREBASE_PROJECT_ID,
    storageBucket: parsed.data.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: parsed.data.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: parsed.data.VITE_FIREBASE_APP_ID,
    measurementId: parsed.data.VITE_FIREBASE_MEASUREMENT_ID,
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) {
    return cachedApp;
  }
  const existing = getApps()[0];
  cachedApp = existing ?? initializeApp(readFirebaseConfig());
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp());
  }
  return cachedAuth;
}

export function getFirebaseDb(): Firestore {
  if (cachedDb) {
    return cachedDb;
  }
  const app = getFirebaseApp();
  try {
    cachedDb = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    cachedDb = getFirestore(app);
  }
  return cachedDb;
}
