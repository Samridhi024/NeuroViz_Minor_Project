import request from 'supertest'
import { describe, it, expect, vi } from 'vitest'

// Mock prisma to avoid requiring generated client in tests
vi.mock('../../src/lib/prisma', () => ({ default: {} }))

// Mock redis to avoid network calls
vi.mock('../../src/lib/redis', () => ({ default: { connect: vi.fn(), disconnect: vi.fn() } }))

import app from '../../src/app'

describe('Security: Rate Limiting', () => {
  it('returns 429 when exceeding global limit', async () => {
    // globalLimiter allows 100 requests per minute; fire 110 quickly
    const attempts = 110
    let got429 = 0

    for (let i = 0; i < attempts; i++) {
      // call health endpoint (no auth)
      const res = await request(app).get('/health')
      if (res.status === 429) got429++
    }

    expect(got429).toBeGreaterThan(0)
  })
})
