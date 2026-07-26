import crypto from 'crypto'
import { getSecretValue } from './keyVault'
import { getOrCreateDataKey } from './cryptoKeyManager'

const ALGORITHM = 'aes-256-gcm'

export function encryptPII(plaintext: string, key: Buffer) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  }
}

export function decryptPII(ciphertextB64: string, ivB64: string, tagB64: string, key: Buffer) {
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()])
  return decrypted.toString('utf8')
}

// Fetch base64-encoded data key from Key Vault and return Buffer
export async function getDataKeyFromKeyVault(secretName: string) {
  // prefer getOrCreateDataKey which will create the secret if missing
  const key = await getOrCreateDataKey(secretName)
  return key
}
