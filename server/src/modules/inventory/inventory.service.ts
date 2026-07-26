import { CreateBatchInput, ExtendBatchInput } from './inventory.types.js';

export class InventoryService {
  async listBatches(productId?: string) {
    // TODO: List batches with filters
    throw new Error('Not implemented');
  }

  async createBatch(input: CreateBatchInput) {
    // TODO: Create inventory batch
    throw new Error('Not implemented');
  }

  async extendBatch(batchId: string, input: ExtendBatchInput) {
    // TODO: Extend batch grace period (FLAGGED → EXTENDED)
    throw new Error('Not implemented');
  }

  async markPerished(batchId: string, adminId: string, reason: string) {
    // TODO: Mark batch as perished, record wastage
    throw new Error('Not implemented');
  }
}

export const inventoryService = new InventoryService();
