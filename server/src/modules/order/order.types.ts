export interface PlaceOrderInput {
  addressId: string;
  paymentMethod: 'UPI' | 'COD';
}

export type OrderStatus = 'PLACED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  cancellationReason?: string;
}
