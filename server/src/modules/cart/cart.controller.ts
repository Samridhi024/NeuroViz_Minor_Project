import { Request, Response, NextFunction } from 'express';
import { cartService } from './cart.service.js';

export class CartController {
  async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await cartService.getCart(req.user!.userId);
      res.json({ success: true, data: cart });
    } catch (error) { next(error); }
  }

  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await cartService.addItem(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: cart });
    } catch (error) { next(error); }
  }

  async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await cartService.updateItem(req.user!.userId, req.params.id, req.body);
      res.json({ success: true, data: cart });
    } catch (error) { next(error); }
  }

  async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await cartService.removeItem(req.user!.userId, req.params.id);
      res.json({ success: true, data: { message: 'Item removed' } });
    } catch (error) { next(error); }
  }
}

export const cartController = new CartController();
