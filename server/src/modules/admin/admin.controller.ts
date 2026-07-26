import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service.js';

export class AdminController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.login(req.body);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getDashboard();
      res.json({ success: true, data: stats });
    } catch (error) { next(error); }
  }

  async listDeliveryPartners(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const partners = await adminService.listDeliveryPartners(req.query);
      res.json({ success: true, data: partners });
    } catch (error) { next(error); }
  }

  async handleKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.handleKyc(req.params.id, req.user!.userId, req.body);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await adminService.getAuditLogs(req.query);
      res.json({ success: true, data: logs });
    } catch (error) { next(error); }
  }
}

export const adminController = new AdminController();
