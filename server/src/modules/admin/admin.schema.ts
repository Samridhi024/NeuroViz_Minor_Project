import { z } from 'zod';

export const adminLoginSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Invalid phone number'),
  password: z.string().min(6),
});

export const kycActionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().optional(),
});

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  entityType: z.string().optional(),
  adminId: z.string().uuid().optional(),
});
