import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.enum(['UPI', 'COD']),
});
