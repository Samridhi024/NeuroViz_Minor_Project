export async function upiPayout(partnerId: string, vpa: string, amount: number, idempotencyKey?: string) {
  // Sandbox-aware UPI payout: simulate unless UPI_SANDBOX_KEY provided
  try {
    const sandboxKey = process.env.UPI_SANDBOX_KEY
    if (!sandboxKey) {
      return { success: true, providerRef: `upi_sim_${partnerId}_${Date.now()}` }
    }
    const base = process.env.UPI_BASE_URL || 'https://sandbox.upi.example'
    const url = `${base}/payouts`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sandboxKey}`
      },
      body: JSON.stringify({ partnerId, vpa, amount, idempotencyKey })
    })
    const json = await resp.json()
    if (!resp.ok) return { success: false, error: JSON.stringify(json) }
    return { success: true, providerRef: json.reference || `upi_${partnerId}_${Date.now()}` }
  } catch (e: any) {
    return { success: false, error: e?.message || 'upi_error' }
  }
}
