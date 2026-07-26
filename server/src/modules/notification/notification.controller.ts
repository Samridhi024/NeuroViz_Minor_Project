import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service.js';

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notifications = await notificationService.list(req.user!.userId, req.query);
      res.json({ success: true, data: notifications });
    } catch (error) { next(error); }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAsRead(req.params.id, req.user!.userId);
      res.json({ success: true, data: { message: 'Marked as read' } });
    } catch (error) { next(error); }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAllAsRead(req.user!.userId);
      res.json({ success: true, data: { message: 'All marked as read' } });
    } catch (error) { next(error); }
  }
}

export const notificationController = new NotificationController();
