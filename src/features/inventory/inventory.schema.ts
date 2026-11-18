import { z } from 'zod';
import { isValidIsoDate } from '../../shared/utils/date';
import { PRODUCT_CATEGORIES } from './inventory.types';

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .refine(isValidIsoDate, {
    message: 'Invalid calendar date',
  });

export const supplierInputSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name is required').max(80),
  contactName: z.string().trim().max(80),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'Enter a valid supplier email address',
    }),
  phone: z.string().trim().max(40),
  defaultLeadTimeDays: z.number().int().min(1, 'Lead time must be at least 1 day').max(60),
  orderDays: z.array(z.string().trim().min(1).max(12)).max(7),
  notes: z.string().trim().max(500),
});

export const productInputSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(2, 'SKU must be at least 2 characters')
      .max(40)
      .transform((v) => v.toUpperCase()),
    name: z.string().trim().min(2, 'Product name is required').max(100),
    category: z.enum(PRODUCT_CATEGORIES),
    unit: z.string().trim().min(1, 'Unit is required').max(24),
    currentStock: z.number().min(0, 'Stock cannot be negative').max(100000),
    onOrderQty: z.number().min(0).max(100000),
    unitCost: z.number().min(0).max(100000),
    sellingPrice: z.number().min(0).max(100000),
    supplierId: z.string().trim().min(1, 'Select a supplier').max(64),
    leadTimeDays: z.number().int().min(1).max(60),
    safetyDays: z.number().int().min(0).max(30),
    packSize: z.number().int().min(1).max(500),
    isPerishable: z.boolean(),
    shelfLifeDays: z.number().int().min(1).max(365).nullable(),
    nearestExpiryDate: isoDateString.nullable(),
    bulkUnitThreshold: z.number().int().min(2).max(500),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.isPerishable && (data.shelfLifeDays === null || data.shelfLifeDays < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shelfLifeDays'],
        message: 'Perishable items require a shelf life in days',
      });
    }
  });

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1).max(64),
  mode: z.enum(['add', 'remove', 'set']),
  quantity: z.number().min(0).max(100000),
  reason: z.enum(['restock_received', 'spoilage', 'cycle_count']),
  expiryDate: isoDateString.nullable(),
  note: z.string().trim().max(240),
});
