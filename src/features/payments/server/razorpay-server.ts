function firstPaymentEnvironmentValue(name: string): string | undefined {
  return [name, `${name}_2`, `${name}_3`, `${name}_4`]
    .map((key) => process.env[key]?.trim())
    .find(Boolean)
}

export function getRazorpayCredentials() {
  const keyId = firstPaymentEnvironmentValue("RAZORPAY_KEY_ID")
  const keySecret = firstPaymentEnvironmentValue("RAZORPAY_KEY_SECRET")
  if (!keyId || !keySecret) return null

  return {
    keyId,
    keySecret,
    authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
  }
}

export async function fetchRazorpayOrder(orderId: string, authorization: string) {
  return fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: authorization, Accept: "application/json" },
    cache: "no-store",
  })
}

export async function fetchRazorpayPayment(paymentId: string, authorization: string) {
  return fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authorization, Accept: "application/json" },
    cache: "no-store",
  })
}
