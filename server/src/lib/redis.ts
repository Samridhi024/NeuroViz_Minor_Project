import Redis from 'ioredis'
import { logger } from './logger.js'

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000)
  },
  lazyConnect: true,
})

redis.on('connect', () => logger.info('Redis connected'))
redis.on('error', (err) => logger.error('Redis error:', err))
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'))

// Helper to create reservation with SET NX EX semantics
export async function createReservation(key: string, value: string, ttlSeconds = 600) {
  const res = await redis.set(key, value, 'NX', 'EX', ttlSeconds)
  return res === 'OK'
}

export async function releaseReservation(key: string) {
  return await redis.del(key)
}

export default redis
