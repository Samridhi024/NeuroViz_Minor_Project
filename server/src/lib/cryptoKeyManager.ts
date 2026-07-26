import crypto from 'crypto'
import { getSecretValue, setSecretValue } from './keyVault'

// Envelope data key manager: stores base64-encoded 32-byte data key in Key Vault secret
export async function getOrCreateDataKey(secretName: string) {
  const existing = await getSecretValue(secretName)
  if (existing) return Buffer.from(existing, 'base64')

  // generate 32-byte key for AES-256-GCM
  const key = crypto.randomBytes(32)
  const b64 = key.toString('base64')
  await setSecretValue(secretName, b64)
  return key
}

export async function rotateDataKey(secretName: string) {
  const key = crypto.randomBytes(32)
  const b64 = key.toString('base64')
  await setSecretValue(secretName, b64)
  return key
}
