import { Request, Response, NextFunction } from 'express';
import { pricingService } from './pricing.service.js';

export class PricingController {
  async listRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rules = await pricingService.listRules();
      res.json({ success: true, data: rules });
    } catch (error) { next(error); }
  }

  async createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rule = await pricingService.createRule(req.body);
      res.status(201).json({ success: true, data: rule });
    } catch (error) { next(error); }
  }

  async updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rule = await pricingService.updateRule(req.params.id, req.body);
      res.json({ success: true, data: rule });
    } catch (error) { next(error); }
  }

  async deleteRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await pricingService.deleteRule(req.params.id);
      res.json({ success: true, data: { message: 'Pricing rule deleted' } });
    } catch (error) { next(error); }
  }
}

export const pricingController = new PricingController();
