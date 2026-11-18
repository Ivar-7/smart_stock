import { z } from 'zod';

export const supportedCurrencySchema = z.enum(['USD', 'EUR', 'GBP', 'KES', 'CAD', 'AUD']);

export const shopSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Shop name must be at least 2 characters').max(80),
  currency: supportedCurrencySchema,
  serviceLevelTarget: z.number().min(0.85).max(0.99),
  defaultReviewCycleDays: z.number().int().min(1).max(30),
  bulkMultiplierThreshold: z.number().min(2).max(10),
  browserAlertsEnabled: z.boolean(),
});

export const shopProfileDocSchema = shopSettingsSchema.extend({
  ownerUid: z.string().min(1).max(128),
  seededAt: z.string().nullable(),
});
