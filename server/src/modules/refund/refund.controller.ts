import { Request, Response, NextFunction } from 'express';
import { refundService } from './refund.service.js';

export class RefundController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refund = await refundService.create(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: refund });
    } catch (error) { next(error); }
  }

  async listByUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refunds = await refundService.listByUser(req.user!.userId);
      res.json({ success: true, data: refunds });
    } catch (error) { next(error); }
  }

  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refunds = await refundService.listAll(req.query);
      res.json({ success: true, data: refunds });
    } catch (error) { next(error); }
  }

  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refund = await refundService.resolve(req.params.id, req.user!.userId, req.body);
      res.json({ success: true, data: refund });
    } catch (error) { next(error); }
  }
}

export const refundController = new RefundController();
