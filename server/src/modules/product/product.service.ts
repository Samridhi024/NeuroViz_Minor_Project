import { CreateProductInput, UpdateProductInput, ProductListQuery } from './product.types.js';

export class ProductService {
  async list(query: ProductListQuery) {
    // TODO: Fetch products with pagination, filtering, search, sorting
    throw new Error('Not implemented');
  }

  async getById(id: string) {
    // TODO: Fetch product by ID with variants and active batches
    throw new Error('Not implemented');
  }

  async create(input: CreateProductInput) {
    // TODO: Create product with variants
    throw new Error('Not implemented');
  }

  async update(id: string, input: UpdateProductInput) {
    // TODO: Update product fields
    throw new Error('Not implemented');
  }

  async delete(id: string) {
    // TODO: Soft delete (set isActive = false) or hard delete
    throw new Error('Not implemented');
  }
}

export const productService = new ProductService();
