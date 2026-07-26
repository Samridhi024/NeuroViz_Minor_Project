export interface CreateBatchInput {
  productId: string;
  quantityKg: number;
  harvestDate: string;
  bestBeforeDate: string;
}

export interface ExtendBatchInput {
  graceDays: number; // 1-2 days
}
