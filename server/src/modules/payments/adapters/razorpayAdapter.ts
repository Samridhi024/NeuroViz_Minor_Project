export async function refundRazorpay(transactionId: string, amount: number, idempotencyKey?: string) {
  // Sandbox-aware adapter: if `RAZORPAY_SANDBOX_KEY` is set, perform a real HTTP call
  // Otherwise simulate success for local/dev.
  try {
    const sandboxKey = process.env.RAZORPAY_SANDBOX_KEY
    if (!sandboxKey) {
      return { success: true, providerRef: `razorpay_sim_${transactionId}` }
    }

    // Minimal example HTTP call using fetch; caller must set RAZORPAY_BASE_URL and key
    const base = process.env.RAZORPAY_BASE_URL || 'https://api.razorpay.com'
    const url = `${base}/v1/payments/${transactionId}/refund`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(sandboxKey + ':').toString('base64')}`
      },
      body: JSON.stringify({ amount })
    })
    const json = await resp.json()
    if (!resp.ok) return { success: false, error: JSON.stringify(json) }
    return { success: true, providerRef: json.id || json.entity || `razorpay_${transactionId}` }
  } catch (e: any) {
    return { success: false, error: e?.message || 'razorpay_error' }
  }
}
