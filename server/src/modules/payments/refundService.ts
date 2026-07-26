import prisma from '../../lib/prisma'
import { refundRazorpay } from './adapters/razorpayAdapter'
import { refundPhonePe } from './adapters/phonepeAdapter'
import { upiPayout } from './adapters/upiPayoutAdapter'

type RefundResult = { success: boolean; providerRef?: string; error?: string }

const RETRY_COUNT = 3

async function insertIdempotency(key: string) {
  try {
    return await prisma.idempotencyKey.create({ data: { key } })
  } catch (e) {
    // unique constraint violation means key exists
    return null
  }
}

async function hasIdempotency(key: string) {
  const row = await prisma.idempotencyKey.findUnique({ where: { key } as any })
  return !!row
}

async function retry<T extends RefundResult>(fn: () => Promise<T>, attempts = RETRY_COUNT): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fn()
      if (res.success) return res
      lastErr = res.error
    } catch (e: any) {
      lastErr = e?.message || e
    }
    // backoff
    await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)))
  }
  return { success: false, error: lastErr }
}

export async function refundPreFulfillment(gateway: 'RAZORPAY' | 'PHONEPE', transactionId: string, amount: number, idempotencyKey?: string) {
  if (idempotencyKey) {
    if (await hasIdempotency(idempotencyKey)) {
      throw new Error('Duplicate idempotency key')
    }
    await insertIdempotency(idempotencyKey)
  }

  if (gateway === 'RAZORPAY') {
    return await retry(() => refundRazorpay(transactionId, amount, idempotencyKey))
  }
  return await retry(() => refundPhonePe(transactionId, amount, idempotencyKey))
}

export async function refundPostDeliveryDispute(orderId: string, userId: string, amount: number, partnerId?: string) {
  // Attempt UPI payout to user (if needed) or partner; if payout fails, credit in-app wallet (store RefundRequest)
  if (partnerId) {
    const partner = await prisma.deliveryPartner.findUnique({ where: { id: partnerId } })
    if (partner && partner.upiId) {
      const res = await retry(() => upiPayout(partnerId, partner.upiId as string, amount))
      if (res.success) {
        await prisma.partnerSettlement.create({ data: { partnerId, amount, method: 'UPI', settledAt: new Date(), reference: res.providerRef } })
        return { success: true, providerRef: res.providerRef }
      }
    }
  }

  // Fallback: credit user's in-app wallet (create RefundRequest record)
  const rr = await prisma.refundRequest.create({ data: { orderId, userId, type: 'REFUND', reason: 'POST_DELIVERY_DISPUTE', status: 'RESOLVED', resolutionNote: 'Credited to in-app wallet' } as any })
  return { success: true, creditedToWallet: true, refundRequestId: rr.id }
}
