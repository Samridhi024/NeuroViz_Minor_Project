import { Request, Response, NextFunction } from 'express';
import { inventoryService } from './inventory.service.js';

export class InventoryController {
  async listBatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const batches = await inventoryService.listBatches(req.query.productId as string);
      res.json({ success: true, data: batches });
    } catch (error) { next(error); }
  }

  async createBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const batch = await inventoryService.createBatch(req.body);
      res.status(201).json({ success: true, data: batch });
    } catch (error) { next(error); }
  }

  async extendBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const batch = await inventoryService.extendBatch(req.params.id, req.body);
      res.json({ success: true, data: batch });
    } catch (error) { next(error); }
  }

  async markPerished(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await inventoryService.markPerished(req.params.id, req.user!.userId, req.body.reason);
      res.json({ success: true, data: { message: 'Batch marked as perished' } });
    } catch (error) { next(error); }
  }
}

export const inventoryController = new InventoryController();
