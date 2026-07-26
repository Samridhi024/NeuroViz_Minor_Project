import redis from './redis'
import type RedisType from 'ioredis'

const RESERVE_LUA = `
-- KEYS[1] = batch_available_key
-- ARGV[1] = qty (string number)
-- ARGV[2] = reservation_key
-- ARGV[3] = reservation_value
-- ARGV[4] = ttl_seconds

local avail = redis.call('GET', KEYS[1])
if not avail then
  return {err='MISSING_KEY'}
end
local availNum = tonumber(avail)
local qty = tonumber(ARGV[1])
if availNum < qty then
  return 0
end
local newVal = redis.call('INCRBYFLOAT', KEYS[1], '-' .. ARGV[1])
if not newVal then
  return {err='DECREMENT_FAILED'}
end
local ok = redis.call('SET', ARGV[2], ARGV[3], 'NX', 'EX', ARGV[4])
if not ok then
  -- rollback
  redis.call('INCRBYFLOAT', KEYS[1], ARGV[1])
  return {err='RESERVATION_EXISTS'}
end
return 1
`

// Reserve from a batch atomically. Returns true on success, false if insufficient, throws on error.
export async function reserveBatchAtomic(batchId: string, qty: number, reservationId: string, ttlSeconds = 600, client?: RedisType) {
  const cli = client || redis
  const batchKey = `batch:${batchId}:available`
  const reservationKey = `reservation:${reservationId}`
  const reservationValue = JSON.stringify({ batchId, qty })
  const res = await cli.eval(RESERVE_LUA, 1, batchKey, qty.toString(), reservationKey, reservationValue, ttlSeconds)
  if (res === 1) return true
  if (res === 0) return false
  // LUA error table
  throw new Error('Reserve failed: ' + JSON.stringify(res))
}

export async function loadBatchAvailability(batchId: string, qty: number, client?: RedisType) {
  const cli = client || redis
  const batchKey = `batch:${batchId}:available`
  return await cli.set(batchKey, qty.toString())
}
