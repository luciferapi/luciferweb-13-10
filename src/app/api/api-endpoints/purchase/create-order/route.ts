import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/features/auth/server/auth-store"
import {
  hasPaidApiEndpointAccess,
  markApiEndpointPurchaseStopped,
  savePendingApiEndpointPurchase,
  saveWalletOnlyApiEndpointPurchase,
} from "@/features/api-endpoints/server/api-purchases"
import { listApiEndpoints } from "@/features/api-endpoints/server/api-endpoints"
import { createRazorpayOrder, getRazorpayCredentials } from "@/features/payments/server/razorpay-server"
import {
  releaseWalletPurchaseDebit,
  reserveWalletPurchaseDebit,
} from "@/features/wallet/server/wallet-purchase-store"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  endpointId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,127}$/),
  wallet_amount_paise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional().default(0),
})

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in before purchasing API access." }, { status: 401 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in before purchasing API access." }, { status: 401 })

    const rateLimitResponse = await enforceRateLimit(request, "api-access-order", {
      capacity: 10,
      refillSeconds: 10 * 60,
      identifiers: [user.id],
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await readLimitedJson(request, 4 * 1024)
    if (!body.ok) {
      return NextResponse.json(
        { error: body.status === 413 ? "The request is too large." : "Send a valid JSON request body." },
        { status: body.status },
      )
    }
    const parsed = requestSchema.safeParse(body.value)
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid API endpoint and wallet amount." }, { status: 400 })

    const endpoint = (await listApiEndpoints()).find((item) => item.id === parsed.data.endpointId)
    if (!endpoint) return NextResponse.json({ error: "API endpoint not found." }, { status: 404 })
    if (endpoint.pricePaise < 100) {
      return NextResponse.json({ error: "This API is free or below Razorpay's ₹1.00 minimum and does not need checkout." }, { status: 400 })
    }
    if (await hasPaidApiEndpointAccess(user.id, endpoint.id)) {
      return NextResponse.json({ error: "You already have access to this API." }, { status: 409 })
    }

    const totalAmountPaise = endpoint.pricePaise
    const walletAmountPaise = parsed.data.wallet_amount_paise
    if (walletAmountPaise > totalAmountPaise) {
      return NextResponse.json({ error: "The selected wallet amount cannot exceed the API access price." }, { status: 400 })
    }

    const remainingPaise = totalAmountPaise - walletAmountPaise
    if (remainingPaise > 0 && remainingPaise < 100) {
      return NextResponse.json({ error: "Leave at least ₹1.00 for Razorpay, or use your wallet for the full API access price." }, { status: 400 })
    }

    if (remainingPaise === 0) {
      const orderId = `wallet_${randomUUID().replace(/-/g, "")}`
      const recorded = await saveWalletOnlyApiEndpointPurchase({
        orderId,
        userId: user.id,
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        amountPaise: totalAmountPaise,
      })
      if (!recorded) return NextResponse.json({ error: "Your wallet balance changed. Refresh it and try again." }, { status: 409 })

      return NextResponse.json({
        wallet_only: true,
        endpoint_id: endpoint.id,
        wallet_applied_paise: walletAmountPaise,
      }, { headers: { "Cache-Control": "private, no-store" } })
    }

    const credentials = getRazorpayCredentials()
    if (!credentials) return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })

    const { response, order } = await createRazorpayOrder(credentials, {
      amountPaise: remainingPaise,
      receipt: `api_${randomUUID().replace(/-/g, "")}`,
      notes: {
        product_type: "api_endpoint",
        api_endpoint_id: endpoint.id,
        user_id: user.id,
        total_amount_paise: String(totalAmountPaise),
        wallet_applied_paise: String(walletAmountPaise),
      },
    })
    if (response.status === 401) {
      return NextResponse.json({ error: "Razorpay rejected the server credentials." }, { status: 502 })
    }
    if (
      !response.ok ||
      typeof order !== "object" ||
      order === null ||
      !("id" in order) ||
      typeof order.id !== "string" ||
      !("amount" in order) ||
      order.amount !== remainingPaise ||
      !("currency" in order) ||
      order.currency !== "INR"
    ) {
      return NextResponse.json({ error: "Razorpay could not create the API access order." }, { status: 502 })
    }

    const recorded = await savePendingApiEndpointPurchase({
      orderId: order.id,
      userId: user.id,
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      amountPaise: totalAmountPaise,
    })
    if (!recorded) return NextResponse.json({ error: "Could not record the pending API payment." }, { status: 500 })

    if (walletAmountPaise > 0) {
      try {
        const reserved = await reserveWalletPurchaseDebit({
          userId: user.id,
          purchaseKey: order.id,
          amountPaise: walletAmountPaise,
        })
        if (!reserved) {
          await markApiEndpointPurchaseStopped(order.id, user.id, "cancelled")
          return NextResponse.json({ error: "Your wallet balance changed. Refresh it and choose a smaller amount." }, { status: 409 })
        }
      } catch (error) {
        await markApiEndpointPurchaseStopped(order.id, user.id, "cancelled").catch(() => false)
        await releaseWalletPurchaseDebit(order.id, user.id).catch(() => undefined)
        throw error
      }
    }

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: "INR",
      wallet_applied_paise: walletAmountPaise,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not create an API access order.", error)
    return NextResponse.json({ error: "Could not create the API access order." }, { status: 500 })
  }
}
