export async function refundPhonePe(transactionId: string, amount: number, idempotencyKey?: string) {
  // Sandbox-aware adapter: simulate locally unless PHONEPE_SANDBOX_KEY provided
  try {
    const sandboxKey = process.env.PHONEPE_SANDBOX_KEY
    if (!sandboxKey) {
      return { success: true, providerRef: `phonepe_sim_${transactionId}` }
    }
    const base = process.env.PHONEPE_BASE_URL || 'https://sandbox.phonepe.com'
    const url = `${base}/v3/refund`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': sandboxKey
      },
      body: JSON.stringify({ transactionId, amount, idempotencyKey })
    })
    const json = await resp.json()
    if (!resp.ok) return { success: false, error: JSON.stringify(json) }
    return { success: true, providerRef: json.ref || `phonepe_${transactionId}` }
  } catch (e: any) {
    return { success: false, error: e?.message || 'phonepe_error' }
  }
}
