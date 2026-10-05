export function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null

  return {
    keyId,
    authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
  }
}

export async function fetchRazorpayOrder(orderId: string, authorization: string) {
  return fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: authorization, Accept: "application/json" },
    cache: "no-store",
  })
}