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

export type RazorpayOrder = {
  id: string
  amount: number
  currency: string
}

export async function createRazorpayOrder(
  credentials: NonNullable<ReturnType<typeof getRazorpayCredentials>>,
  input: { amountPaise: number; receipt: string; notes: Record<string, string> },
): Promise<{ response: Response; order: RazorpayOrder | null }> {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: credentials.authorization,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    }),
    cache: "no-store",
  })
  const order = await response.json().catch(() => null) as RazorpayOrder | null
  return { response, order }
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
