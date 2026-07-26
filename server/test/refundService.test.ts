import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../src/lib/prisma', () => ({
  default: {
    idempotencyKey: {
      create: vi.fn(async ({ data }) => data),
      findUnique: vi.fn(async ({ where: { key } }) => null)
    },
    deliveryPartner: {
      findUnique: vi.fn(async ({ where: { id } }) => ({ id, upiId: id === 'p_upi' ? 'partner@upi' : null }))
    },
    partnerSettlement: {
      create: vi.fn(async ({ data }) => ({ id: 'ps1', ...data }))
    },
    refundRequest: {
      create: vi.fn(async ({ data }) => ({ id: 'rr1', ...data }))
    }
  }
}))

vi.mock('../src/modules/payments/adapters/razorpayAdapter', () => ({ refundRazorpay: vi.fn(async () => ({ success: true, providerRef: 'rref1' })) }))
vi.mock('../src/modules/payments/adapters/phonepeAdapter', () => ({ refundPhonePe: vi.fn(async () => ({ success: true, providerRef: 'pref1' })) }))
vi.mock('../src/modules/payments/adapters/upiPayoutAdapter', () => ({ upiPayout: vi.fn(async () => ({ success: true, providerRef: 'upiref1' })) }))

import { refundPreFulfillment, refundPostDeliveryDispute } from '../src/modules/payments/refundService'

describe('refundService', () => {
  it('refunds via Razorpay with idempotency', async () => {
    const res = await refundPreFulfillment('RAZORPAY', 'tx1', 100, 'idem1')
    expect(res.success).toBe(true)
  })

  it('posts UPI payout to partner when available', async () => {
    const res = await refundPostDeliveryDispute('order1', 'user1', 200, 'p_upi')
    expect(res.success).toBe(true)
    expect(res.providerRef).toBeTruthy()
  })

  it('falls back to wallet credit when partner has no UPI', async () => {
    const res = await refundPostDeliveryDispute('order2', 'user2', 150, 'p_no_upi')
    expect(res.success).toBe(true)
    expect(res.creditedToWallet).toBe(true)
  })
})
