import { PricingCalculation, CreatePricingRuleInput } from './pricing.types.js';

export class PricingService {
  async calculateTotal(subtotal: number): Promise<PricingCalculation> {
    // TODO: Fetch active pricing rules, apply in priority order
    // Rules: >=₹100 free delivery, <₹100 delivery charge, >=₹500 5% discount
    throw new Error('Not implemented');
  }

  async listRules() {
    // TODO: List all pricing rules
    throw new Error('Not implemented');
  }

  async createRule(input: CreatePricingRuleInput) {
    // TODO: Create pricing rule
    throw new Error('Not implemented');
  }

  async updateRule(id: string, input: Partial<CreatePricingRuleInput>) {
    // TODO: Update pricing rule
    throw new Error('Not implemented');
  }

  async deleteRule(id: string) {
    // TODO: Delete pricing rule
    throw new Error('Not implemented');
  }
}

export const pricingService = new PricingService();
