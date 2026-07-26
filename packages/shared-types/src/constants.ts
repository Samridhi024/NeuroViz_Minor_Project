export const SERVICE_RADIUS_KM = 15;

export const PRICING = {
  FREE_DELIVERY_THRESHOLD: 100,
  DISCOUNT_THRESHOLD: 500,
  DISCOUNT_PERCENTAGE: 5,
  DEFAULT_DELIVERY_CHARGE: 30,
} as const;

export const OTP = {
  LENGTH: 6,
  EXPIRY_SECONDS: 300,
  MAX_ATTEMPTS: 5,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
} as const;

export const BATCH_GRACE_DAYS = {
  MIN: 1,
  MAX: 2,
} as const;

export const WEIGHT_VARIANTS = [250, 500, 1000, 2000] as const;
