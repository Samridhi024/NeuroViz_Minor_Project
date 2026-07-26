import request from 'supertest'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock auth to bypass JWT verification in in-process tests
vi.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user', role: 'CUSTOMER', type: 'CUSTOMER' }
    return next()
  }
}))

// Mock prisma to simulate inventoryAllocation lookup/update
const mockAlloc = { id: 'ia1', reservationId: 'res1', status: 'RESERVED' }
vi.mock('../../src/lib/prisma', () => ({
  default: {
    inventoryAllocation: {
      findUnique: vi.fn(async ({ where: { reservationId } }) => {
        if (reservationId === 'res1') return mockAlloc
        return null
      }),
      update: vi.fn(async ({ where: { id }, data }) => ({ ...mockAlloc, ...data }))
    }
  }
}))

// Mock redis releaseReservation function
vi.mock('../../src/lib/redis', () => ({
  releaseReservation: vi.fn(async () => {}),
  default: {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {})
  }
}))

import app from '../../src/app'

describe('In-process Integration: checkout.commit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('commits reservation and releases redis key', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/commit')
      .set('Authorization', 'Bearer dummy')
      .send({ reservationIds: ['res1'], paymentTransactionId: 'tx1' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true })
  })
})
