import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/features/auth/server/auth-store"
import {
  hasPaidApiEndpointAccess,
  savePendingApiEndpointPurchase,
} from "@/features/api-endpoints/server/api-purchases"
import { listApiEndpoints } from "@/features/api-endpoints/server/api-endpoints"
import { createRazorpayOrder, getRazorpayCredentials } from "@/features/payments/server/razorpay-server"
import { readLimitedJson } from "@/lib/server/read-limited-json"
import { enforceRateLimit } from "@/lib/server/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  endpointId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
})

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in before purchasing API access." }, { status: 401 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in before purchasing API access." }, { status: 401 })

    const rateLimitResponse = await enforceRateLimit(request, "api-access-order", {
      capacity: 10,
      refillSeconds: 60 * 60,
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
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid API endpoint." }, { status: 400 })

    const endpoint = (await listApiEndpoints()).find((item) => item.id === parsed.data.endpointId)
    if (!endpoint) return NextResponse.json({ error: "API endpoint not found." }, { status: 404 })
    if (endpoint.pricePaise < 100) {
      return NextResponse.json({ error: "This API is free and does not need checkout." }, { status: 400 })
    }
    if (await hasPaidApiEndpointAccess(user.id, endpoint.id)) {
      return NextResponse.json({ error: "You already have access to this API." }, { status: 409 })
    }

    const credentials = getRazorpayCredentials()
    if (!credentials) return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 })

    const { response, order } = await createRazorpayOrder(credentials, {
      amountPaise: endpoint.pricePaise,
      receipt: `api_${randomUUID().replace(/-/g, "")}`,
      notes: { product_type: "api_endpoint", api_endpoint_id: endpoint.id, user_id: user.id },
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
      order.amount !== endpoint.pricePaise ||
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
      amountPaise: endpoint.pricePaise,
    })
    if (!recorded) {
      return NextResponse.json({ error: "Could not record the pending API payment." }, { status: 500 })
    }

    return NextResponse.json({
      order_id: order.id,
      amount: endpoint.pricePaise,
      currency: "INR",
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not create an API access order.", error)
    return NextResponse.json({ error: "Could not create the API access order." }, { status: 500 })
  }
}
