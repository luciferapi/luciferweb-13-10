import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/features/auth/server/auth-store"
import {
  getApiEndpointPurchase,
  savePaidApiEndpointPurchase,
} from "@/features/api-endpoints/server/api-purchases"
import {
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayCredentials,
} from "@/features/payments/server/razorpay-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
})

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to verify API access payment." }, { status: 401 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in to verify API access payment." }, { status: 401 })

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Required Razorpay verification fields are invalid." }, { status: 400 })

    const credentials = getRazorpayCredentials()
    if (!credentials) return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })

    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data
    const expectedSignature = createHmac("sha256", credentials.keySecret).update(`${orderId}|${paymentId}`).digest()
    const receivedSignature = Buffer.from(signature, "hex")
    if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) {
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 })
    }

    const purchase = await getApiEndpointPurchase(orderId, user.id)
    if (!purchase) return NextResponse.json({ error: "API purchase order not found for this account." }, { status: 404 })

    const orderResponse = await fetchRazorpayOrder(orderId, credentials.authorization)
    const order: unknown = await orderResponse.json().catch(() => null)
    if (orderResponse.status === 401) {
      return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 502 })
    }
    if (!orderResponse.ok) return NextResponse.json({ error: "Could not verify the Razorpay order." }, { status: 502 })

    if (
      typeof order !== "object" ||
      order === null ||
      !("id" in order) || order.id !== orderId ||
      !("amount" in order) || order.amount !== purchase.amountPaise ||
      !("currency" in order) || order.currency !== "INR" ||
      !("status" in order) || order.status !== "paid" ||
      !("notes" in order) ||
      typeof order.notes !== "object" ||
      order.notes === null ||
      !("product_type" in order.notes) || order.notes.product_type !== "api_endpoint" ||
      !("api_endpoint_id" in order.notes) || order.notes.api_endpoint_id !== purchase.endpointId ||
      !("user_id" in order.notes) || order.notes.user_id !== user.id
    ) {
      return NextResponse.json({ error: "The payment does not match this API access order." }, { status: 400 })
    }

    const paymentResponse = await fetchRazorpayPayment(paymentId, credentials.authorization)
    const payment: unknown = await paymentResponse.json().catch(() => null)
    if (paymentResponse.status === 401) {
      return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 502 })
    }
    if (!paymentResponse.ok) {
      return NextResponse.json({ error: "Could not verify the Razorpay payment details." }, { status: 502 })
    }
    if (
      typeof payment !== "object" ||
      payment === null ||
      !("id" in payment) || payment.id !== paymentId ||
      !("order_id" in payment) || payment.order_id !== orderId ||
      !("amount" in payment) || payment.amount !== purchase.amountPaise ||
      !("currency" in payment) || payment.currency !== "INR" ||
      !("status" in payment) || payment.status !== "captured"
    ) {
      return NextResponse.json({ error: "The Razorpay payment details do not match this API access purchase." }, { status: 400 })
    }

    const recorded = await savePaidApiEndpointPurchase({
      paymentId,
      orderId,
      userId: user.id,
      endpointId: purchase.endpointId,
      amountPaise: purchase.amountPaise,
    })
    if (!recorded) {
      return NextResponse.json({ error: "Payment succeeded, but API access could not be recorded. Contact support." }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      endpointId: purchase.endpointId,
      access: "explorer",
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not verify the API access payment.", error)
    return NextResponse.json({ error: "Could not verify the API access payment." }, { status: 500 })
  }
}
