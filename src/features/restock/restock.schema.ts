import { z } from 'zod';
import { isValidIsoDate } from '../../shared/utils/date';

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .refine(isValidIsoDate, {
    message: 'Invalid calendar date',
  });

export const createRestockOrderSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.number().int().min(1, 'Order at least 1 unit').max(100000),
  expectedDate: isoDateString,
  notes: z.string().trim().max(300),
});

export const receiveRestockOrderSchema = z.object({
  orderId: z.string().min(1).max(64),
  receivedQty: z.number().int().min(1).max(100000),
  newExpiryDate: isoDateString.nullable(),
  note: z.string().trim().max(240),
});
