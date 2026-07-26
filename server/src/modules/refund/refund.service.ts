import { CreateRefundInput, ResolveRefundInput } from './refund.types.js';

export class RefundService {
  async create(userId: string, input: CreateRefundInput) {
    // TODO: Create refund/replacement request
    throw new Error('Not implemented');
  }

  async listByUser(userId: string) {
    // TODO: List user's refund requests
    throw new Error('Not implemented');
  }

  async listAll(query: any) {
    // TODO: List all refund requests (admin)
    throw new Error('Not implemented');
  }

  async resolve(refundId: string, adminId: string, input: ResolveRefundInput) {
    // TODO: Resolve refund request (admin)
    throw new Error('Not implemented');
  }
}

export const refundService = new RefundService();
