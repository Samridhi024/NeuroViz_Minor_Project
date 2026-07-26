import { z } from 'zod';

export const placeOrderSchema = z.object({
  addressId: z.string().uuid(),
  paymentMethod: z.enum(['UPI', 'COD']),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
  cancellationReason: z.string().optional(),
});

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z.string().optional(),
});
