import { z } from 'zod';

export const createOfferSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FLAT']),
  value: z.number().positive(),
  minOrderValue: z.number().positive().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const updateOfferSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FLAT']).optional(),
  value: z.number().positive().optional(),
  minOrderValue: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});
