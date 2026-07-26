import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockOrder = { id: 'order1', paymentMethod: 'COD' }

vi.mock('../src/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(async ({ where: { id } }) => (id === mockOrder.id ? mockOrder : null)),
      update: vi.fn(async ({ where, data }) => ({ ...mockOrder, ...data }))
    },
    partnerCashLedger: {
      findUnique: vi.fn(async ({ where: { partnerId } }: any) => {
        if (partnerId === 'p_ok') return { partnerId, cashOnHand: 1000 }
        if (partnerId === 'p_bad') return { partnerId, cashOnHand: 2500 }
        return null
      })
    }
  }
}))

import { deliveryService } from '../src/modules/delivery/delivery.service'

describe('DeliveryService.acceptOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows partner with low cashOnHand to accept COD order', async () => {
    const res = await deliveryService.acceptOrder('p_ok', { orderId: 'order1' })
    expect(res).toEqual({ success: true })
  })

  it('rejects partner exceeding COD cap', async () => {
    await expect(deliveryService.acceptOrder('p_bad', { orderId: 'order1' })).rejects.toThrow()
  })
})
