export interface InitiatePaymentInput {
  orderId: string;
  paymentMethod: 'UPI' | 'COD';
}

export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        status: string;
        amount: number;
      };
    };
  };
}
