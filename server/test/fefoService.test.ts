import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock prisma client used by fefoService
const mockBatches = [
  { id: 'batch1', productId: 'prod1', remainingQtyKg: 10, status: 'ACTIVE', bestBeforeDate: new Date() }
]

vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      productVariant: {
        findUnique: vi.fn(async ({ where: { id } }) => {
          return { id: 'pv1', productId: 'prod1' }
        })
      },
      batch: {
        findMany: vi.fn(async () => mockBatches)
      },
      $transaction: vi.fn(async (fn: any) => {
        // provide a fake tx with inventoryAllocation.create and batch.update
        const tx = {
          inventoryAllocation: {
            create: vi.fn(async ({ data }) => ({ id: 'ia-' + Math.random().toString(36).slice(2), ...data }))
          },
          batch: {
            update: vi.fn(async ({ where: { id }, data: { remainingQtyKg } }) => {
              // decrement mock batch
              const b = mockBatches.find((x) => x.id === id)
              if (b) b.remainingQtyKg = Number(b.remainingQtyKg) - Number((remainingQtyKg as any).decrement || 0)
              return b
            })
          }
        }
        return await fn(tx)
      })
    }
  }
})

vi.mock('../src/lib/reservationLua', () => ({
  reserveBatchAtomic: vi.fn(),
  loadBatchAvailability: vi.fn()
}))

vi.mock('../src/lib/redis', () => ({
  default: {
    incrbyfloat: vi.fn(async () => {}),
    del: vi.fn(async () => {})
  }
}))

import { allocateFEFO } from '../src/modules/inventory/fefoService'
import { reserveBatchAtomic as mockReserve } from '../src/lib/reservationLua'

describe('FEFO allocation', () => {
  beforeEach(() => {
    mockBatches[0].remainingQtyKg = 10
    vi.clearAllMocks()
  })

  it('allocates when enough inventory exists', async () => {
    ;(mockReserve as any).mockResolvedValue(true)
    const allocations = await allocateFEFO('order1', [{ id: 'oi1', productVariantId: 'pv1', quantityKg: 5 }])
    expect(allocations.length).toBeGreaterThan(0)
  })

  it('throws when insufficient inventory', async () => {
    ;(mockReserve as any).mockResolvedValue(false)
    await expect(allocateFEFO('order2', [{ id: 'oi2', productVariantId: 'pv1', quantityKg: 20 }])).rejects.toThrow()
  })
})
