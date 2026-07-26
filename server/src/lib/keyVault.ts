import { DefaultAzureCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'

let client: SecretClient | null = null

function getClient() {
  if (client) return client
  const vaultName = process.env.AZURE_KEY_VAULT_NAME
  if (!vaultName) throw new Error('AZURE_KEY_VAULT_NAME not set')
  const url = `https://${vaultName}.vault.azure.net`
  const cred = new DefaultAzureCredential()
  client = new SecretClient(url, cred)
  return client
}

export async function getSecretValue(name: string) {
  const c = getClient()
  const sec = await c.getSecret(name)
  return sec.value || null
}

export async function setSecretValue(name: string, value: string) {
  const c = getClient()
  const res = await c.setSecret(name, value)
  return res.value || null
}
