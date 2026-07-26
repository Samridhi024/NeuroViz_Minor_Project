import { Request, Response, NextFunction } from 'express'
import prisma from '../../lib/prisma'
import { releaseReservation } from '../../lib/redis'

export class CheckoutController {
  async commit(req: Request, res: Response, next: NextFunction) {
    try {
      const { reservationIds, paymentTransactionId } = req.body
      // Mark allocations as COMMITTED
      for (const rid of reservationIds) {
        const alloc = await prisma.inventoryAllocation.findUnique({ where: { reservationId: rid } })
        if (!alloc) continue
        await prisma.inventoryAllocation.update({ where: { id: alloc.id }, data: { status: 'COMMITTED' } })
        // remove reservation key
        await releaseReservation(`reservation:${rid}`)
      }

      // update order payment status
      if (paymentTransactionId) {
        // find transaction and update order
      }

      res.json({ success: true })
    } catch (err) { next(err) }
  }
}

export const checkoutController = new CheckoutController()
