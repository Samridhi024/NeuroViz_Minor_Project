import { CreateOfferInput, UpdateOfferInput } from './offer.types.js';

export class OfferService {
  async listActive() {
    // TODO: List active offers (within date range)
    throw new Error('Not implemented');
  }

  async listAll() {
    // TODO: List all offers (admin)
    throw new Error('Not implemented');
  }

  async create(input: CreateOfferInput) {
    // TODO: Create offer
    throw new Error('Not implemented');
  }

  async update(id: string, input: UpdateOfferInput) {
    // TODO: Update offer
    throw new Error('Not implemented');
  }

  async delete(id: string) {
    // TODO: Delete offer
    throw new Error('Not implemented');
  }
}

export const offerService = new OfferService();
