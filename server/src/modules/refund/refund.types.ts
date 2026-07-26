export interface CreateRefundInput {
  orderId: string;
  type: 'REFUND' | 'REPLACEMENT';
  reason: string;
  photoUrl?: string;
}

export interface ResolveRefundInput {
  status: 'APPROVED' | 'REJECTED';
  resolutionNote: string;
}
