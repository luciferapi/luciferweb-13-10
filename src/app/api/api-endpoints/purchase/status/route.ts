import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/features/auth/server/auth-store"
import { markApiEndpointPurchaseStopped } from "@/features/api-endpoints/server/api-purchases"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  status: z.enum(["cancelled", "failed"]),
})

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to update this API payment." }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "A valid API payment order is required." }, { status: 400 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in to update this API payment." }, { status: 401 })
    const updated = await markApiEndpointPurchaseStopped(parsed.data.order_id, user.id, parsed.data.status)
    if (!updated) return NextResponse.json({ error: "This API payment is not pending or does not belong to your account." }, { status: 409 })
    return NextResponse.json({ success: true, status: parsed.data.status })
  } catch (error) {
    console.error("Could not update the pending API payment.", error)
    return NextResponse.json({ error: "Could not update this API payment." }, { status: 500 })
  }
}
