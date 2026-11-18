import { ZodError } from 'zod';
import { AppError, type AppErrorCode, type ErrorContextMap } from './errors.types';

interface FirebaseLikeError {
  code: string;
  message?: string;
}

function isFirebaseLikeError(value: unknown): value is FirebaseLikeError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}

const FIREBASE_CODE_MAP: Record<string, { code: AppErrorCode; userMessage: string }> = {
  'auth/invalid-credential': {
    code: 'AUTH_INVALID_CREDENTIALS',
    userMessage: 'The email or password does not match an active shop account.',
  },
  'auth/wrong-password': {
    code: 'AUTH_INVALID_CREDENTIALS',
    userMessage: 'The email or password does not match an active shop account.',
  },
  'auth/user-not-found': {
    code: 'AUTH_INVALID_CREDENTIALS',
    userMessage: 'No shop account was found for that email address.',
  },
  'auth/invalid-email': {
    code: 'VALIDATION_ERROR',
    userMessage: 'Please enter a valid email address.',
  },
  'auth/email-already-in-use': {
    code: 'AUTH_EMAIL_IN_USE',
    userMessage: 'An account with this email already exists. Try signing in instead.',
  },
  'auth/weak-password': {
    code: 'VALIDATION_ERROR',
    userMessage: 'Please choose a stronger password with at least 6 characters.',
  },
  'auth/popup-closed-by-user': {
    code: 'AUTH_POPUP_CLOSED',
    userMessage: 'Google sign-in was cancelled before finishing.',
  },
  'auth/cancelled-popup-request': {
    code: 'AUTH_POPUP_CLOSED',
    userMessage: 'Google sign-in was interrupted. Please try again.',
  },
  'auth/unauthorized-domain': {
    code: 'AUTH_UNAUTHORIZED_DOMAIN',
    userMessage: 'This domain is not authorized for sign-in in Firebase Authentication settings.',
  },
  'auth/too-many-requests': {
    code: 'AUTH_TOO_MANY_REQUESTS',
    userMessage: 'Too many sign-in attempts in a short window. Wait a moment and try again.',
  },
  'auth/network-request-failed': {
    code: 'NETWORK_ERROR',
    userMessage: 'Network connection failed while contacting authentication services.',
  },
  'auth/operation-not-allowed': {
    code: 'AUTH_REQUIRED',
    userMessage: 'This sign-in method is not enabled on the Firebase project yet.',
  },
  'permission-denied': {
    code: 'FIRESTORE_PERMISSION_DENIED',
    userMessage: 'You do not have permission to view or update this shop data.',
  },
  'failed-precondition': {
    code: 'FIRESTORE_INDEX_REQUIRED',
    userMessage: 'The database query requires an index or setup step before running.',
  },
  unavailable: {
    code: 'FIRESTORE_UNAVAILABLE',
    userMessage: 'Cloud sync is temporarily unreachable. Check your internet connection and retry.',
  },
  'not-found': {
    code: 'FIRESTORE_NOT_FOUND',
    userMessage: 'The requested shop record could not be found.',
  },
};

export function toAppError(
  error: unknown,
  fallbackMessage = 'Something went wrong while completing your request. Please try again.',
  context: ErrorContextMap = {},
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const fieldLabel = firstIssue?.path.length ? `${firstIssue.path.join('.')}: ` : '';
    const detail = firstIssue?.message ?? 'Invalid input values provided.';
    return new AppError({
      code: 'VALIDATION_ERROR',
      userMessage: `${fieldLabel}${detail}`,
      technicalMessage: error.message,
      recoverable: true,
      context,
      cause: error,
    });
  }

  if (isFirebaseLikeError(error)) {
    const normalizedCode = error.code.replace(/^firestore\//, '');
    const mapped = FIREBASE_CODE_MAP[error.code] ?? FIREBASE_CODE_MAP[normalizedCode];
    if (mapped) {
      return new AppError({
        code: mapped.code,
        userMessage: mapped.userMessage,
        technicalMessage: `${error.code}: ${error.message ?? ''}`,
        recoverable: true,
        context: { ...context, firebaseCode: error.code },
        cause: error,
      });
    }
  }

  if (error instanceof Error) {
    const looksOffline =
      /network|fetch|offline|timeout/i.test(error.message) && !/permission/i.test(error.message);
    return new AppError({
      code: looksOffline ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
      userMessage: looksOffline
        ? 'Could not reach the network. Please check your connection and try again.'
        : fallbackMessage,
      technicalMessage: error.message,
      recoverable: true,
      context,
      cause: error,
    });
  }

  return new AppError({
    code: 'UNKNOWN_ERROR',
    userMessage: fallbackMessage,
    technicalMessage: String(error),
    recoverable: true,
    context,
    cause: error,
  });
}
