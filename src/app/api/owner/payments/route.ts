import { NextResponse } from "next/server"
import { z } from "zod"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { listOwnerPayoutRequests, setOwnerPayoutStatus } from "@/features/owner/server/owner-payments"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const statusFilter = z.enum(["pending", "all"]).catch("pending")
const updateSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["paid", "rejected"]),
  externalPaymentConfirmed: z.boolean().optional().default(false),
  ownerResponse: z.string().trim().min(3).max(1000),
  paymentReference: z.union([z.string().trim().min(3).max(120), z.literal("")]).optional().default(""),
  ownerNote: z.union([z.string().trim().min(3).max(1000), z.literal("")]).optional().default(""),
})

export async function GET(request: Request) {
  const unauthorized = await requireOwnerAccess("payments")
  if (unauthorized) return unauthorized

  try {
    const filter = statusFilter.parse(new URL(request.url).searchParams.get("status"))
    const result = await listOwnerPayoutRequests(filter)
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load owner payout requests.", error)
    return NextResponse.json({ error: "Could not load payout requests." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireOwnerAccess("payments")
  if (unauthorized) return unauthorized

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payout status update." }, { status: 400 })
  if (parsed.data.status === "paid" && !parsed.data.externalPaymentConfirmed) {
    return NextResponse.json({ error: "Confirm that the payout was sent outside the app before marking it paid." }, { status: 400 })
  }
  if (parsed.data.status === "paid" && !parsed.data.paymentReference) {
    return NextResponse.json({ error: "Enter the payment transfer reference or UTR before marking this request paid." }, { status: 400 })
  }
  if (parsed.data.status === "rejected" && parsed.data.paymentReference) {
    return NextResponse.json({ error: "A payment reference can only be recorded for a paid withdrawal." }, { status: 400 })
  }

  const actor = await getSignedInUser()
  if (!actor) return NextResponse.json({ error: "Sign in to manage payout requests." }, { status: 401 })

  try {
    const result = await setOwnerPayoutStatus({
      actorUserId: actor.id,
      requestId: parsed.data.requestId,
      status: parsed.data.status,
      externalPaymentConfirmed: parsed.data.externalPaymentConfirmed,
      ownerResponse: parsed.data.ownerResponse,
      paymentReference: parsed.data.paymentReference || null,
      ownerNote: parsed.data.ownerNote || null,
    })
    if (result === "updated") return NextResponse.json({ success: true })
    if (result === "unauthorized") return NextResponse.json({ error: "You are not authorized to manage payout requests." }, { status: 403 })
    if (result === "not_pending") return NextResponse.json({ error: "This request is no longer pending. Refresh the payout queue." }, { status: 409 })
    if (result === "payment_confirmation_required") return NextResponse.json({ error: "Confirm the external payment before marking this request paid." }, { status: 400 })
    if (result === "invalid_response") return NextResponse.json({ error: "Write a response of 3 to 1,000 characters for the user." }, { status: 400 })
    if (result === "invalid_payment_reference") return NextResponse.json({ error: "Enter a valid transfer reference for a paid withdrawal only." }, { status: 400 })
    if (result === "invalid_owner_note") return NextResponse.json({ error: "The private owner note is too long." }, { status: 400 })
    if (result === "invalid_status") return NextResponse.json({ error: "Invalid payout status." }, { status: 400 })
    throw new Error(`Unexpected payout status result: ${result}`)
  } catch (error) {
    console.error("Could not update owner payout request.", error)
    return NextResponse.json({ error: "Could not update the payout request." }, { status: 500 })
  }
}
