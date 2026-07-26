export interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  weightGrams: number;
  price: number;
  discountPrice: number | null;
  isActive: boolean;
}

export interface Batch {
  id: string;
  productId: string;
  quantityKg: number;
  remainingQtyKg: number;
  harvestDate: string;
  bestBeforeDate: string;
  extendedUntil: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  cartId: string;
  productVariantId: string;
  quantity: number;
  createdAt: string;
  productVariant?: ProductVariant & { product?: Product };
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  addressId: string;
  deliveryPartnerId: string | null;
  subtotal: number;
  discountAmount: number;
  deliveryCharge: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  placedAt: string;
  packedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  batchId: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface DeliveryPartner {
  id: string;
  phone: string;
  name: string;
  aadhaarLast4: string;
  panLast4: string;
  kycDocumentUrl: string | null;
  drivingLicense: string;
  vehicleType: string;
  vehicleNumber: string;
  kycStatus: string;
  isActive: boolean;
  isAvailable: boolean;
  currentLat: number | null;
  currentLng: number | null;
}

export interface Offer {
  id: string;
  title: string;
  description: string | null;
  type: string;
  value: number;
  minOrderValue: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  orderId: string;
  paymentMethod: string;
  status: string;
  gatewayRefId: string | null;
  amount: number;
  createdAt: string;
}

export interface Rating {
  id: string;
  userId: string;
  orderId: string;
  productId: string;
  rating: number;
  review: string | null;
  createdAt: string;
}

export interface RefundRequest {
  id: string;
  orderId: string;
  userId: string;
  type: string;
  reason: string;
  photoUrl: string | null;
  status: string;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}
