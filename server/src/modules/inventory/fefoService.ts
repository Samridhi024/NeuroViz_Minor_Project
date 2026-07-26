import prisma from '../../lib/prisma'
import redis from '../../lib/redis'
import { reserveBatchAtomic } from '../../lib/reservationLua'
import { randomUUID } from 'crypto'

/**
 * FEFO allocation: select batches ordered by bestBeforeDate asc
 * Reserve inventory by creating InventoryAllocation rows in a transaction
 */
export async function allocateFEFO(orderId: string, orderItems: {id: string, productVariantId: string, quantityKg: number}[]) {
  const allocations: any[] = []

  // First phase: attempt Redis-first reservations for all items/batches
  const tentativeReservations: { batchId: string; qty: number; reservationId: string; orderItemId: string }[] = []

  for (const item of orderItems) {
    // load productVariant and candidate batches from DB (read-only)
    const productVariant = await prisma.productVariant.findUnique({ where: { id: item.productVariantId } })
    if (!productVariant) throw new Error('ProductVariant not found')
    const productId = productVariant.productId

    let qtyLeft = item.quantityKg
    const batches = await prisma.batch.findMany({
      where: { productId, status: 'ACTIVE', remainingQtyKg: { gt: 0 } },
      orderBy: { bestBeforeDate: 'asc' }
    })

    for (const batch of batches) {
      if (qtyLeft <= 0) break
      const candidate = Math.min(Number(batch.remainingQtyKg.toString()), qtyLeft)
      if (candidate <= 0) continue

      const reservationId = randomUUID()
      const ok = await reserveBatchAtomic(batch.id, candidate, reservationId, 600)
      if (!ok) {
        // this batch cannot fulfill candidate (concurrent reservations); try next batch
        continue
      }
      tentativeReservations.push({ batchId: batch.id, qty: candidate, reservationId, orderItemId: item.id })
      qtyLeft -= candidate
    }

    if (qtyLeft > 0) {
      // rollback tentative reservations for this order
      for (const r of tentativeReservations) {
        await redis.incrbyfloat(`batch:${r.batchId}:available`, r.qty)
        await redis.del(`reservation:${r.reservationId}`)
      }
      throw new Error('Insufficient inventory for item ' + item.id)
    }
  }

  // Second phase: persist allocations in DB within a transaction. If DB transaction fails, compensate Redis.
  try {
    return await prisma.$transaction(async (tx) => {
      for (const r of tentativeReservations) {
        const reservedUntil = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        const ia = await tx.inventoryAllocation.create({
          data: {
            orderId,
            orderItemId: r.orderItemId,
            batchId: r.batchId,
            quantityKg: r.qty,
            status: 'RESERVED',
            reservationId: r.reservationId,
            reservedUntil
          }
        })

        // decrement DB batch remainingQtyKg
        await tx.batch.update({ where: { id: r.batchId }, data: { remainingQtyKg: { decrement: r.qty } } })

        allocations.push(ia)
      }

      // Map orderItemId for allocations based on product batches (best-effort); caller may adjust
      return allocations
    })
  } catch (err) {
    // Compensation: restore Redis availability and delete reservation keys
    for (const r of tentativeReservations) {
      try {
        await redis.incrbyfloat(`batch:${r.batchId}:available`, r.qty)
        await redis.del(`reservation:${r.reservationId}`)
      } catch (e) {
        // log and continue; reconciliation job will detect and repair
        // eslint-disable-next-line no-console
        console.error('Compensation failed for reservation', r.reservationId, e)
      }
    }
    throw err
  }
}
