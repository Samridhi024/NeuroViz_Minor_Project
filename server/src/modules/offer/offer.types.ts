export interface CreateOfferInput {
  title: string;
  description?: string;
  type: 'PERCENTAGE' | 'FLAT';
  value: number;
  minOrderValue?: number;
  startDate: string;
  endDate: string;
}

export interface UpdateOfferInput {
  title?: string;
  description?: string;
  type?: 'PERCENTAGE' | 'FLAT';
  value?: number;
  minOrderValue?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}
