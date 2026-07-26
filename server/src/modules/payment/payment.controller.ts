import { Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service.js';

export class PaymentController {
  async initiate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await paymentService.initiatePayment(req.body);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      await paymentService.handleWebhook(req.body, signature);
      res.json({ success: true });
    } catch (error) { next(error); }
  }

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await paymentService.getPaymentStatus(req.params.orderId);
      res.json({ success: true, data: status });
    } catch (error) { next(error); }
  }
}

export const paymentController = new PaymentController();
