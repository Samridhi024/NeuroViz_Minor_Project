import { describe, it, expect } from 'vitest'
import { encryptPII, decryptPII } from '../src/lib/crypto'
import crypto from 'crypto'

describe('crypto encrypt/decrypt', () => {
  it('roundtrips plaintext with AES-256-GCM', () => {
    const key = crypto.randomBytes(32)
    const plaintext = 'Sensitive phone + address'
    const enc = encryptPII(plaintext, key)
    const dec = decryptPII(enc.ciphertext, enc.iv, enc.tag, key)
    expect(dec).toBe(plaintext)
  })
})
