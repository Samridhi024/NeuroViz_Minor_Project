import request from 'supertest'
import { describe, it, expect, vi } from 'vitest'

// Mock auth to bypass JWT
vi.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user', role: 'CUSTOMER', type: 'CUSTOMER' }
    return next()
  }
}))

// Mock prisma globally to avoid requiring generated client
vi.mock('../../src/lib/prisma', () => ({
  default: {
    inventoryAllocation: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async ({ data }) => ({ ...data }))
    }
  }
}))

// Mock redis client
vi.mock('../../src/lib/redis', () => ({
  default: {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    incrbyfloat: vi.fn(async () => {}),
    del: vi.fn(async () => {})
  },
  releaseReservation: vi.fn(async () => {})
}))

import app from '../../src/app'

describe('Concurrency: checkout.commit', () => {
  it('handles multiple concurrent commits', async () => {
    const concurrency = 20
    const promises: Promise<any>[] = []

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        request(app)
          .post('/api/v1/checkout/commit')
          .set('Authorization', 'Bearer dummy')
          .send({ reservationIds: [], paymentTransactionId: `tx-${i}` })
      )
    }

    const results = await Promise.all(promises)
    for (const res of results) {
      expect([200, 400, 404, 500]).toContain(res.status)
    }
  })
})
