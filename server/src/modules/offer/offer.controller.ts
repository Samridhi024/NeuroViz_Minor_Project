import { Request, Response, NextFunction } from 'express';
import { offerService } from './offer.service.js';

export class OfferController {
  async listActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const offers = await offerService.listActive();
      res.json({ success: true, data: offers });
    } catch (error) { next(error); }
  }

  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const offers = await offerService.listAll();
      res.json({ success: true, data: offers });
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const offer = await offerService.create(req.body);
      res.status(201).json({ success: true, data: offer });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const offer = await offerService.update(req.params.id, req.body);
      res.json({ success: true, data: offer });
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await offerService.delete(req.params.id);
      res.json({ success: true, data: { message: 'Offer deleted' } });
    } catch (error) { next(error); }
  }
}

export const offerController = new OfferController();
