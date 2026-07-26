import cron from 'node-cron'
import prisma from '../lib/prisma'
import redis from '../lib/redis'
import { Logger } from '../lib/logger'

// Runs every minute
cron.schedule('* * * * *', async () => {
  try {
    // 1) Find allocations marked RESERVED in DB
    const reserved = await prisma.inventoryAllocation.findMany({ where: { status: 'RESERVED' } })
    for (const alloc of reserved) {
      const key = `reservation:${alloc.reservationId}`
      const exists = await redis.exists(key)
      if (!exists) {
        // reservation missing in Redis -> release allocation and increment batch
        await prisma.$transaction(async (tx) => {
          await tx.inventoryAllocation.update({ where: { id: alloc.id }, data: { status: 'RELEASED' } })
          await tx.batch.update({ where: { id: alloc.batchId }, data: { remainingQtyKg: { increment: alloc.quantityKg } } })
        })
        Logger.info(`Reconciled missing reservation ${alloc.reservationId} for allocation ${alloc.id}`)
      }
    }

    // 2) Find reservation keys without DB allocations
    const keys = await redis.keys('reservation:*')
    for (const k of keys) {
      const val = await redis.get(k)
      if (!val) continue
      // parse reservationId from key
      const reservationId = k.split(':')[1]
      const alloc = await prisma.inventoryAllocation.findFirst({ where: { reservationId } })
      if (!alloc) {
        // no DB allocation -> remove Redis key
        await redis.del(k)
        Logger.info(`Removed orphaned reservation key ${k}`)
      }
    }
  } catch (err) {
    Logger.error('Reconciliation job failed', err)
  }
})
