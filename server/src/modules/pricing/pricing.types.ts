export interface PricingCalculation {
  subtotal: number;
  discountAmount: number;
  deliveryCharge: number;
  total: number;
  appliedRules: string[];
}

export interface CreatePricingRuleInput {
  ruleType: 'FREE_DELIVERY' | 'DISCOUNT' | 'DELIVERY_CHARGE';
  minOrderValue: number;
  discountPercentage?: number;
  deliveryCharge?: number;
  priority: number;
}
