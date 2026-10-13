import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/features/auth/server/auth-store"
import { fetchRazorpayOrder, getRazorpayCredentials } from "@/features/payments/server/razorpay-server"
import {
  listPendingProjectPurchases,
  listUserProjectPurchases,
  markProjectPurchaseCancelled,
  markProjectPurchaseExpired,
  markProjectPurchaseFailed,
} from "@/features/purchases/server/purchase-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to view your transaction history." }, { status: 401 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in to view your transaction history." }, { status: 401 })

    const credentials = getRazorpayCredentials()
    if (credentials) {
      const pendingOrders = await listPendingProjectPurchases(user.id)
      await Promise.all(pendingOrders.map(async (orderId) => {
        try {
          const response = await fetchRazorpayOrder(orderId, credentials.authorization)
          if (!response.ok) {
            console.error(`Could not refresh Razorpay status for order ${orderId}.`, response.status)
            return
          }
          const order: unknown = await response.json()
          if (
            typeof order === "object" &&
            order !== null &&
            "id" in order &&
            order.id === orderId &&
            "status" in order &&
            order.status === "expired"
          ) {
            await markProjectPurchaseExpired(orderId, user.id)
          }
        } catch (error) {
          console.error(`Could not refresh Razorpay status for order ${orderId}.`, error)
        }
      }))
    }

    const transactions = await listUserProjectPurchases(user.id)
    return NextResponse.json({ transactions }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load transaction history.", error)
    return NextResponse.json({ error: "Could not load transaction history right now." }, { status: 500 })
  }
}

const cancellationSchema = z.object({
  order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  status: z.enum(["cancelled", "failed"]),
})

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to update transaction history." }, { status: 401 })

  const parsed = cancellationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "A valid order_id is required." }, { status: 400 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in to update transaction history." }, { status: 401 })

    const updated = parsed.data.status === "cancelled"
      ? await markProjectPurchaseCancelled(parsed.data.order_id, user.id)
      : await markProjectPurchaseFailed(parsed.data.order_id, user.id)
    if (!updated) {
      return NextResponse.json({ error: "This transaction is not pending or does not belong to your account." }, { status: 409 })
    }
    return NextResponse.json({ success: true, status: parsed.data.status })
  } catch (error) {
    console.error("Could not cancel the pending project order.", error)
    return NextResponse.json({ error: "Could not update this transaction right now." }, { status: 500 })
  }
}
