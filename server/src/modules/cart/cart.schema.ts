import { z } from 'zod';

export const addToCartSchema = z.object({
  productVariantId: z.string().uuid(),
  quantity: z.number().int().positive().max(50),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(50),
});
