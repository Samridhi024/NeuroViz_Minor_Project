import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.enum(['Fruits', 'Vegetables', 'Leafy Greens', 'Farm Produce']),
  imageUrl: z.string().url().optional(),
  unit: z.string().min(1).max(20),
  variants: z.array(z.object({
    weightGrams: z.number().positive(),
    price: z.number().positive(),
    discountPrice: z.number().positive().optional(),
  })).min(1),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  category: z.enum(['Fruits', 'Vegetables', 'Leafy Greens', 'Farm Produce']).optional(),
  imageUrl: z.string().url().optional(),
  unit: z.string().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'category']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
