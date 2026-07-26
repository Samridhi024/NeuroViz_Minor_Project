import redis from '../lib/redis'
import prisma from '../lib/prisma'

let worker: any = null
let reservationQueue: any = null

try {
  // Only attempt to require and start bullmq when not running tests
  if (process.env.NODE_ENV !== 'test') {
    // dynamic require so tests or environments without bullmq don't crash on import
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Worker, Queue } = require('bullmq')
    const connection = { connection: redis }
    reservationQueue = new Queue('reservation-expiry', connection)

    // Worker checks expired reservations and reverts allocations
    worker = new Worker('reservation-expiry', async (job: any) => {
      const { reservationId } = job.data
      // check redis
      const key = `reservation:${reservationId}`
      const val = await redis.get(key)
      if (val) return

      // reservation expired, revert allocation and increment batch
      const allocation = await prisma.inventoryAllocation.findFirst({ where: { reservationId } })
      if (!allocation) return

      await prisma.$transaction(async (tx) => {
        await tx.inventoryAllocation.update({ where: { id: allocation.id }, data: { status: 'RELEASED' } })
        await tx.batch.update({ where: { id: allocation.batchId }, data: { remainingQtyKg: { increment: allocation.quantityKg } } })
      })

    }, connection)
  }
} catch (e) {
  // bullmq not available or failed to start — tests and environments should continue
  // eslint-disable-next-line no-console
  console.warn('reservationExpiryWorker not started:', e && e.message ? e.message : e)
}

export default worker
