import "server-only"

function getPaymentEnvironmentValue(name: string, suffix: string): string | undefined {
  const value = process.env[`${name}${suffix}`]?.trim()
  if (!value) return undefined
  // Hosting dashboards sometimes preserve quotes copied from .env files.
  // Strip one matching pair so Basic auth receives the actual key and secret.
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1).trim()
  }
  return value
}
export function getRazorpayCredentials() {
  const keyId = getPaymentEnvironmentValue("RAZORPAY_KEY_ID", "")
  const keySecret = getPaymentEnvironmentValue("RAZORPAY_KEY_SECRET", "")
  if (!keyId || !keySecret) return null

  return {
    keyId,
    keySecret,
    authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
  }
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
