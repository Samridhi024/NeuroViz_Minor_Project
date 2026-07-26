import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../src/lib/keyVault', () => ({
  getSecretValue: vi.fn(async (name: string) => null),
  setSecretValue: vi.fn(async (name: string, val: string) => val)
}))

import { getOrCreateDataKey } from '../src/lib/cryptoKeyManager'

describe('cryptoKeyManager', () => {
  it('generates a new data key when missing', async () => {
    const key = await getOrCreateDataKey('test-key')
    expect(key).toBeInstanceOf(Buffer)
    expect(key.length).toBe(32)
  })
})
