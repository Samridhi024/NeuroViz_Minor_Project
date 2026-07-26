import { Request, Response, NextFunction } from 'express';
import { orderService } from './order.service.js';

export class OrderController {
  async placeOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await orderService.placeOrder(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: order });
    } catch (error) { next(error); }
  }

  async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await orderService.getOrders(req.user!.userId, req.query);
      res.json({ success: true, data: orders });
    } catch (error) { next(error); }
  }

  async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await orderService.getOrderById(req.params.id, req.user!.userId);
      res.json({ success: true, data: order });
    } catch (error) { next(error); }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await orderService.updateStatus(req.params.id, req.body);
      res.json({ success: true, data: order });
    } catch (error) { next(error); }
  }

  async reorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await orderService.reorder(req.params.id, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }
}

export const orderController = new OrderController();
