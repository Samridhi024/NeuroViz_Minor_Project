import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import RedisMock from 'ioredis-mock'
import { reserveBatchAtomic, loadBatchAvailability } from '../src/lib/reservationLua'
import { randomUUID } from 'crypto'

describe('reservation Lua script', () => {
  beforeAll(async () => {
    // ensure redis connection
    // redis is connected via lib/redis import
  })

  afterAll(async () => {
    // nothing
  })

  it('reserves when enough availability', async () => {
    const batchId = 'test-batch-1'
    const mock = new RedisMock()
    await loadBatchAvailability(batchId, 10, mock)
    const reservationId = randomUUID()
    const ok = await reserveBatchAtomic(batchId, 5, reservationId, 60, mock)
    expect(ok).toBe(true)
    const remain = await mock.get(`batch:${batchId}:available`)
    expect(Number(remain)).toBeCloseTo(5)
    const resKey = await mock.get(`reservation:${reservationId}`)
    expect(resKey).toBeTruthy()
  })

  it('does not reserve when insufficient', async () => {
    const batchId = 'test-batch-2'
    const mock = new RedisMock()
    await loadBatchAvailability(batchId, 2, mock)
    const reservationId = randomUUID()
    const ok = await reserveBatchAtomic(batchId, 5, reservationId, 60, mock)
    expect(ok).toBe(false)
  })
})
