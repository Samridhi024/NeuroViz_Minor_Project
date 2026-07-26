import { z } from 'zod';

export const acceptOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
