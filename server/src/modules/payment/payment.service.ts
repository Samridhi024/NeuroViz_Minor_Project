import { InitiatePaymentInput } from './payment.types.js';

export class PaymentService {
  async initiatePayment(input: InitiatePaymentInput) {
    // TODO: Create Razorpay order for UPI, or mark as COD
    throw new Error('Not implemented');
  }

  async handleWebhook(payload: any, signature: string) {
    // TODO: Verify Razorpay webhook signature, update payment status
    throw new Error('Not implemented');
  }

  async getPaymentStatus(orderId: string) {
    // TODO: Get payment/transaction status for an order
    throw new Error('Not implemented');
  }
}

export const paymentService = new PaymentService();
