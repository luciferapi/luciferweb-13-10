function getPaymentEnvironmentValue(name: string, suffix: string): string | undefined {
  return process.env[`${name}${suffix}`]?.trim()
}

export function getRazorpayCredentials() {
  const suffixes = ["_2", "", "_3", "_4"]
  for (const suffix of suffixes) {
    const keyId = getPaymentEnvironmentValue("RAZORPAY_KEY_ID", suffix)
    const keySecret = getPaymentEnvironmentValue("RAZORPAY_KEY_SECRET", suffix)
    if (!keyId || !keySecret) continue

    return {
      keyId,
      keySecret,
      authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    }
  }

  return null
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
