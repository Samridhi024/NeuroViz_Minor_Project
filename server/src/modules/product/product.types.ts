export interface CreateProductInput {
  name: string;
  description?: string;
  category: string;
  imageUrl?: string;
  unit: string;
  variants: { weightGrams: number; price: number; discountPrice?: number }[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  unit?: string;
  isActive?: boolean;
}

export interface ProductListQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
