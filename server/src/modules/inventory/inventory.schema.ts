import { z } from 'zod';

export const createBatchSchema = z.object({
  productId: z.string().uuid(),
  quantityKg: z.number().positive(),
  harvestDate: z.string().datetime(),
  bestBeforeDate: z.string().datetime(),
});

export const extendBatchSchema = z.object({
  graceDays: z.number().int().min(1).max(2),
});
