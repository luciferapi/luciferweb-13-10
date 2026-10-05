import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOwnerAccess } from "@/lib/owner-access"
import { getReferralProgram, listAllReferrals, updateReferralProgram, updateReferralStatus } from "@/lib/referral-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "active", "rejected"]),
})
const rewardSchema = z.object({
  type: z.enum(["fixed", "percentage"]),
  amount: z.number().min(0).max(1_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
}).refine((reward) => reward.type !== "percentage" || reward.amount <= 100, {
  message: "Percentage rewards cannot exceed 100.",
})
const programSchema = z.object({
  referrerReward: rewardSchema,
  refereeReward: rewardSchema,
  conditions: z.object({
    minPurchaseAmount: z.number().min(0).max(1_000_000).nullable(),
    validUntil: z.string().datetime().nullable(),
    maxReferrals: z.number().int().min(1).max(1_000_000).nullable(),
  }),
})
const patchSchema = z.discriminatedUnion("action", [
  updateSchema.extend({ action: z.literal("update-status") }),
  z.object({ action: z.literal("update-program"), program: programSchema }),
])

export async function GET() {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  try {
    const [referrals, program] = await Promise.all([listAllReferrals(), getReferralProgram()])
    return NextResponse.json({ referrals, program }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load referral records for owner review.", error)
    return NextResponse.json({ error: "Could not load referral records." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireOwnerAccess()
  if (unauthorized) return unauthorized

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the referral update and try again." }, { status: 400 })

  try {
    if (parsed.data.action === "update-program") {
      await updateReferralProgram(parsed.data.program)
      return NextResponse.json({ success: true })
    }
    const updated = await updateReferralStatus(parsed.data.id, parsed.data.status)
    if (!updated) return NextResponse.json({ error: "Referral not found." }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Could not update referral status.", error)
    return NextResponse.json({ error: "Could not update the referral status." }, { status: 500 })
  }
}
