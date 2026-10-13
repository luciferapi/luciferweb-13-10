import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/features/auth/server/auth-store"
import {
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayCredentials,
} from "@/features/payments/server/razorpay-server"
import {
  getWalletDepositForOrder,
  markWalletDepositPaid,
  type WalletDepositPaymentDetails,
} from "@/features/wallet/server/wallet-deposit-store"

export const runtime = "nodejs"

const requestSchema = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
})

const optionalText = z.string().nullable().optional()
const razorpayPaymentSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number().int().nonnegative(),
  currency: z.string(),
  status: z.string(),
  captured: z.boolean(),
  method: optionalText,
  international: z.boolean().nullable().optional(),
  bank: optionalText,
  wallet: optionalText,
  vpa: optionalText,
  email: optionalText,
  contact: optionalText,
  fee: z.number().int().nonnegative().nullable().optional(),
  tax: z.number().int().nonnegative().nullable().optional(),
  created_at: z.number().int().nonnegative().optional(),
  description: optionalText,
  acquirer_data: z.record(z.string(), z.unknown()).nullable().optional(),
  card: z.object({
    network: optionalText,
    last4: optionalText,
  }).nullable().optional(),
})

function optionalString(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null
  return value.slice(0, maxLength)
}

function firstAcquirerReference(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null
  for (const key of ["rrn", "upi_transaction_id", "bank_transaction_id", "auth_code"]) {
    const value = data[key]
    if (typeof value === "string" && value.length > 0) return value.slice(0, 128)
  }
  return null
}

function toPaymentDetails(payment: z.infer<typeof razorpayPaymentSchema>): WalletDepositPaymentDetails {
  return {
    method: optionalString(payment.method, 32),
    status: payment.status.slice(0, 32),
    captured: payment.captured,
    international: payment.international ?? null,
    bank: optionalString(payment.bank, 64),
    wallet: optionalString(payment.wallet, 64),
    vpa: optionalString(payment.vpa, 255),
    email: optionalString(payment.email, 255),
    contact: optionalString(payment.contact, 32),
    feePaise: payment.fee ?? null,
    taxPaise: payment.tax ?? null,
    providerCreatedAt: payment.created_at
      ? new Date(payment.created_at * 1000).toISOString()
      : null,
    description: optionalString(payment.description, 255),
    reference: firstAcquirerReference(payment.acquirer_data),
    cardNetwork: optionalString(payment.card?.network, 32),
    cardLast4: payment.card?.last4 && /^\d{4}$/.test(payment.card.last4)
      ? payment.card.last4
      : null,
  }
}

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to verify your wallet deposit." }, { status: 401 })

  let user
  try {
    user = await findUserBySession(token)
  } catch (error) {
    console.error("Could not verify the wallet deposit session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "Sign in to verify your wallet deposit." }, { status: 401 })

  const credentials = getRazorpayCredentials()
  if (!credentials) {
    return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Required Razorpay verification fields are missing or invalid." }, { status: 400 })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data
  const expectedSignature = createHmac("sha256", credentials.keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest()
  const receivedSignature = Buffer.from(razorpay_signature, "hex")
  if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 })
  }

  try {
    const deposit = await getWalletDepositForOrder(razorpay_order_id, user.id)
    if (!deposit || !["pending", "paid"].includes(deposit.status)) {
      return NextResponse.json({ error: "This deposit order does not belong to your account or is no longer payable." }, { status: 400 })
    }
    if (deposit.status === "paid" && deposit.paymentId !== razorpay_payment_id) {
      return NextResponse.json({ error: "This deposit order has already been credited." }, { status: 409 })
    }

    const orderResponse = await fetchRazorpayOrder(razorpay_order_id, credentials.authorization)
    const order = await orderResponse.json().catch(() => null)
    if (orderResponse.status === 401) {
      return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 502 })
    }
    if (!orderResponse.ok) {
      return NextResponse.json({ error: "Could not verify the Razorpay order." }, { status: 500 })
    }
    if (
      order?.id !== razorpay_order_id ||
      order?.notes?.type !== "wallet_deposit" ||
      order?.notes?.user_id !== user.id ||
      order?.amount !== deposit.amountPaise ||
      order?.currency !== "INR" ||
      order?.status !== "paid"
    ) {
      return NextResponse.json({ error: "The payment does not match this wallet deposit." }, { status: 400 })
    }

    const paymentResponse = await fetchRazorpayPayment(razorpay_payment_id, credentials.authorization)
    const paymentData: unknown = await paymentResponse.json().catch(() => null)
    if (paymentResponse.status === 401) {
      return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 502 })
    }
    if (!paymentResponse.ok) {
      return NextResponse.json({ error: "Could not retrieve the Razorpay payment details." }, { status: 502 })
    }

    const parsedPayment = razorpayPaymentSchema.safeParse(paymentData)
    if (
      !parsedPayment.success ||
      parsedPayment.data.id !== razorpay_payment_id ||
      parsedPayment.data.order_id !== razorpay_order_id ||
      parsedPayment.data.amount !== deposit.amountPaise ||
      parsedPayment.data.currency !== "INR" ||
      parsedPayment.data.status !== "captured" ||
      !parsedPayment.data.captured
    ) {
      return NextResponse.json({ error: "The Razorpay payment details do not match this wallet deposit." }, { status: 400 })
    }
    const paymentDetails = toPaymentDetails(parsedPayment.data)

    const recorded = await markWalletDepositPaid({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      userId: user.id,
      amountPaise: deposit.amountPaise,
      paymentDetails,
    })
    if (!recorded) {
      return NextResponse.json({ error: "The verified payment could not be added to your wallet. Contact support with your payment ID." }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      deposit_id: deposit.depositId,
      amount_paise: deposit.amountPaise,
      payment_details: paymentDetails,
    })
  } catch (error) {
    console.error("Could not verify or record the wallet deposit.", error)
    return NextResponse.json({ error: "Could not verify this wallet deposit." }, { status: 500 })
  }
}
