import { z } from 'zod';

export const createRefundSchema = z.object({
  orderId: z.string().uuid(),
  type: z.enum(['REFUND', 'REPLACEMENT']),
  reason: z.string().min(10).max(500),
  photoUrl: z.string().url().optional(),
});

export const resolveRefundSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  resolutionNote: z.string().min(1).max(500),
});
