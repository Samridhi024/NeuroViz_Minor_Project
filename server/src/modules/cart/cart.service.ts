import { AddToCartInput, UpdateCartItemInput } from './cart.types.js';

export class CartService {
  async getCart(userId: string) {
    // TODO: Get user's cart with items, product details, and calculated totals
    throw new Error('Not implemented');
  }

  async addItem(userId: string, input: AddToCartInput) {
    // TODO: Add item to cart (create cart if not exists)
    throw new Error('Not implemented');
  }

  async updateItem(userId: string, itemId: string, input: UpdateCartItemInput) {
    // TODO: Update cart item quantity
    throw new Error('Not implemented');
  }

  async removeItem(userId: string, itemId: string) {
    // TODO: Remove item from cart
    throw new Error('Not implemented');
  }

  async clearCart(userId: string) {
    // TODO: Clear all items from cart
    throw new Error('Not implemented');
  }
}

export const cartService = new CartService();
