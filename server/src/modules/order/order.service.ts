import { PlaceOrderInput, UpdateOrderStatusInput } from './order.types.js';
import prisma from '../../lib/prisma'
import { allocateFEFO } from '../inventory/fefoService'

export class OrderService {
  async placeOrder(userId: string, input: PlaceOrderInput) {
    // Create order skeleton
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        userId,
        addressId: input.addressId,
        subtotal: input.subtotal,
        discountAmount: input.discountAmount || 0,
        deliveryCharge: input.deliveryCharge || 0,
        total: input.total,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'PENDING'
      }
    })

    // create order items
    const orderItems = [] as any[]
    for (const it of input.items) {
      const oi = await prisma.orderItem.create({ data: {
        orderId: order.id,
        productVariantId: it.productVariantId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice
      }})
      orderItems.push({ id: oi.id, productVariantId: it.productVariantId, quantityKg: it.quantity })
    }

    // allocate FEFO and create reservations
    const allocations = await allocateFEFO(order.id, orderItems)

    return { order, allocations }
  }

  async getOrders(userId: string, query: any) {
    // TODO: Get user orders with pagination
    throw new Error('Not implemented');
  }

  async getOrderById(orderId: string, userId: string) {
    // TODO: Get order details with items
    throw new Error('Not implemented');
  }

  async updateStatus(orderId: string, input: UpdateOrderStatusInput) {
    // TODO: Update order status, send notifications
    throw new Error('Not implemented');
  }

  async reorder(orderId: string, userId: string) {
    // TODO: Re-add order items to cart
    throw new Error('Not implemented');
  }
}

export const orderService = new OrderService();
