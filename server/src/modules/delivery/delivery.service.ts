import { AcceptOrderInput, LocationUpdateInput } from './delivery.types.js'
import prisma from '../../lib/prisma'

const COD_CAP = Number(process.env.PARTNER_COD_CAP || 2000)

export class DeliveryService {
  async getAvailableOrders(partnerId: string) {
    // TODO: Get orders available for pickup
    throw new Error('Not implemented')
  }

  // Partner accepts an order. Enforce COD cash-on-hand cap before assigning COD orders.
  async acceptOrder(partnerId: string, input: AcceptOrderInput) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId } })
    if (!order) throw new Error('Order not found')

    if (order.paymentMethod === 'COD') {
      const ledger = await prisma.partnerCashLedger.findUnique({ where: { partnerId } as any })
      const cashOnHand = ledger ? Number(ledger.cashOnHand.toString()) : 0
      if (cashOnHand >= COD_CAP) {
        throw new Error('Partner COD cash-on-hand limit exceeded; settle before accepting COD orders')
      }
    }

    // assign partner and mark as accepted
    await prisma.order.update({ where: { id: order.id }, data: { deliveryPartnerId: partnerId, status: 'ASSIGNED' } })
    return { success: true }
  }

  async rejectOrder(partnerId: string, orderId: string) {
    // TODO: Reject order assignment
    throw new Error('Not implemented')
  }

  async updateLocation(partnerId: string, input: LocationUpdateInput) {
    // TODO: Update delivery partner location in Redis, broadcast via Socket.IO
    throw new Error('Not implemented')
  }

  async getTrackingInfo(orderId: string) {
    // TODO: Get delivery partner location for order tracking
    throw new Error('Not implemented')
  }

  async completeDelivery(partnerId: string, orderId: string) {
    // TODO: Mark delivery complete, update order status
    throw new Error('Not implemented')
  }

  async getEarnings(partnerId: string, period: string) {
    // TODO: Calculate earnings for daily/weekly/monthly
    throw new Error('Not implemented')
  }
}

export const deliveryService = new DeliveryService()
