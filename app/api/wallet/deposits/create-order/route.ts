import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/lib/auth-store"
import { getRazorpayCredentials } from "@/lib/razorpay-server"
import { savePendingWalletDeposit } from "@/lib/wallet-deposit-store"

export const runtime = "nodejs"

const requestSchema = z.object({
  amount: z.number().int().min(50).max(1000),
})

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in before adding money to your wallet." }, { status: 401 })

  let user
  try {
    user = await findUserBySession(token)
  } catch (error) {
    console.error("Could not verify the wallet deposit session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "Sign in before adding money to your wallet." }, { status: 401 })

  const credentials = getRazorpayCredentials()
  if (!credentials) {
    return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a whole-rupee deposit amount from ₹50 to ₹1,000." }, { status: 400 })
  }

  const amountPaise = parsed.data.amount * 100
  const receiptId = randomUUID().replace(/-/g, "")
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: credentials.authorization,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `wallet_${receiptId}`,
        notes: { type: "wallet_deposit", user_id: user.id },
      }),
      cache: "no-store",
    })

    const order = await response.json().catch(() => null)
    if (response.status === 401) {
      return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 502 })
    }
    if (!response.ok || typeof order?.id !== "string" || order.amount !== amountPaise || order.currency !== "INR") {
      return NextResponse.json({ error: "Razorpay could not create the deposit order." }, { status: 500 })
    }

    await savePendingWalletDeposit({
      orderId: order.id,
      userId: user.id,
      amountPaise,
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: credentials.keyId,
    })
  } catch (error) {
    console.error("Could not create or record the wallet deposit order.", error)
    return NextResponse.json({ error: "Could not start this wallet deposit." }, { status: 500 })
  }
}
