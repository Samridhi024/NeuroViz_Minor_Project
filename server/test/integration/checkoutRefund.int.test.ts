import request from 'supertest'
import { describe, it, expect } from 'vitest'

// Integration tests expect the server to be running at localhost:3000 (via docker-compose.test)
const runner = process.env.RUN_INTEGRATION === '1' ? describe : describe.skip

runner('Integration: checkout & refund', () => {
  it('health check', async () => {
    const res = await request('http://localhost:3000').get('/health')
    expect(res.status).toBe(200)
  })

  // Additional integration tests would exercise /checkout, /payments/refund endpoints
  // These require a running DB and Redis; run via `docker-compose -f ../docker-compose.test.yml up --build` and set RUN_INTEGRATION=1
})
