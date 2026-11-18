import { z } from 'zod';
import { isValidIsoDate } from '../../shared/utils/date';

export const saleInputSchema = z
  .object({
    productId: z.string().trim().min(1, 'Select a product').max(64),
    soldDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format')
      .refine(isValidIsoDate, { message: 'Enter a valid sale date' }),
    quantity: z.number().positive('Quantity must be greater than zero').max(50000),
    unitPrice: z.number().min(0, 'Unit price cannot be negative').max(100000),
    orderType: z.enum(['normal', 'bulk']),
    isPromotion: z.boolean(),
    promoTag: z.string().trim().max(60),
    anomalyAction: z.enum(['auto', 'dampen', 'keep']),
    notes: z.string().trim().max(240),
    deductStock: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.isPromotion && data.promoTag.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['promoTag'],
        message:
          'Add a short tag (e.g., Weekend 15% Off) so promotions do not skew baseline demand',
      });
    }
  });
