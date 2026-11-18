import type { User } from 'firebase/auth';

export interface AuthUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
}

export function mapFirebaseUser(user: User): AuthUserSummary {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    isAnonymous: user.isAnonymous,
  };
}
