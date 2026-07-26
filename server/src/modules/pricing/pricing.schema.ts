import { z } from 'zod';

export const createPricingRuleSchema = z.object({
  ruleType: z.enum(['FREE_DELIVERY', 'DISCOUNT', 'DELIVERY_CHARGE']),
  minOrderValue: z.number().min(0),
  discountPercentage: z.number().min(0).max(100).optional(),
  deliveryCharge: z.number().min(0).optional(),
  priority: z.number().int().min(0),
});

export const updatePricingRuleSchema = createPricingRuleSchema.partial();
