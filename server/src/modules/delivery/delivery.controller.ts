import { Request, Response, NextFunction } from 'express';
import { deliveryService } from './delivery.service.js';

export class DeliveryController {
  async getAvailableOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await deliveryService.getAvailableOrders(req.user!.userId);
      res.json({ success: true, data: orders });
    } catch (error) { next(error); }
  }

  async acceptOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await deliveryService.acceptOrder(req.user!.userId, req.body);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  async updateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await deliveryService.updateLocation(req.user!.userId, req.body);
      res.json({ success: true, data: { message: 'Location updated' } });
    } catch (error) { next(error); }
  }

  async getTracking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tracking = await deliveryService.getTrackingInfo(req.params.id);
      res.json({ success: true, data: tracking });
    } catch (error) { next(error); }
  }

  async completeDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await deliveryService.completeDelivery(req.user!.userId, req.params.id);
      res.json({ success: true, data: { message: 'Delivery completed' } });
    } catch (error) { next(error); }
  }
}

export const deliveryController = new DeliveryController();
