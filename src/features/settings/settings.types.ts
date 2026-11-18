import type { SupportedCurrency } from '../../shared/utils/format';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface ShopProfile {
  ownerUid: string;
  name: string;
  currency: SupportedCurrency;
  serviceLevelTarget: number;
  defaultReviewCycleDays: number;
  bulkMultiplierThreshold: number;
  browserAlertsEnabled: boolean;
  seededAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShopSettingsInput {
  name: string;
  currency: SupportedCurrency;
  serviceLevelTarget: number;
  defaultReviewCycleDays: number;
  bulkMultiplierThreshold: number;
  browserAlertsEnabled: boolean;
}
