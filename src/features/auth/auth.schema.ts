import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const signUpSchema = signInSchema.extend({
  shopName: z.string().trim().min(2, 'Shop name must be at least 2 characters').max(80),
});
