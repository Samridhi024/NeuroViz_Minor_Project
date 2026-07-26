export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  DELIVERY_PARTNER = 'DELIVERY_PARTNER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum OrderStatus {
  PLACED = 'PLACED',
  PACKED = 'PACKED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum PaymentMethod {
  UPI = 'UPI',
  COD = 'COD',
}

export enum BatchStatus {
  ACTIVE = 'ACTIVE',
  FLAGGED = 'FLAGGED',
  EXTENDED = 'EXTENDED',
  PERISHED = 'PERISHED',
}

export enum KycStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum OfferType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

export enum RefundType {
  REFUND = 'REFUND',
  REPLACEMENT = 'REPLACEMENT',
}

export enum RefundStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSED = 'PROCESSED',
}

export enum NotificationType {
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_PACKED = 'ORDER_PACKED',
  ORDER_OUT_FOR_DELIVERY = 'ORDER_OUT_FOR_DELIVERY',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  REFUND_UPDATE = 'REFUND_UPDATE',
  INVENTORY_ALERT = 'INVENTORY_ALERT',
  DELIVERY_ASSIGNED = 'DELIVERY_ASSIGNED',
}

export enum PricingRuleType {
  FREE_DELIVERY = 'FREE_DELIVERY',
  DISCOUNT = 'DISCOUNT',
  DELIVERY_CHARGE = 'DELIVERY_CHARGE',
}

export enum ProductCategory {
  FRUITS = 'Fruits',
  VEGETABLES = 'Vegetables',
  LEAFY_GREENS = 'Leafy Greens',
  FARM_PRODUCE = 'Farm Produce',
}
