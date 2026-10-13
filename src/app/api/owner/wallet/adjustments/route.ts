import { NextResponse } from "next/server"
import { z } from "zod"
import { getOwnerWorkspaceAccess, requireOwnerAccess } from "@/features/auth/server/owner-access"
import { adjustOwnerUserWallet } from "@/features/owner/server/owner-users"

export const runtime = "nodejs"

const adjustmentSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["credit", "debit"]),
  amountPaise: z.number().int().min(1).max(1_000_000_000),
  reason: z.string().trim().min(3).max(500),
})

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess("wallet")
  if (unauthorized) return unauthorized

  const parsed = adjustmentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Check the wallet adjustment details and try again." }, { status: 400 })

  const actor = await getOwnerWorkspaceAccess()
  if (!actor) return NextResponse.json({ error: "Sign in to adjust user wallets." }, { status: 401 })

  try {
    const result = await adjustOwnerUserWallet({
      actorUserId: actor.user.id,
      targetUserId: parsed.data.id,
      direction: parsed.data.direction,
      amountPaise: parsed.data.amountPaise,
      reason: parsed.data.reason,
    })
    if (result.status === "adjusted" && result.balancePaise !== undefined) {
      return NextResponse.json({ success: true, balancePaise: result.balancePaise })
    }
    if (result.status === "user_not_found") return NextResponse.json({ error: "User not found." }, { status: 404 })
    if (result.status === "insufficient_balance") return NextResponse.json({ error: "Debit amount exceeds the user's available wallet balance." }, { status: 409 })
    if (result.status === "unauthorized") return NextResponse.json({ error: "You are not authorized to adjust user wallets." }, { status: 403 })
    if (result.status === "invalid_adjustment") return NextResponse.json({ error: "The wallet adjustment is invalid." }, { status: 400 })
    throw new Error(`Unexpected wallet adjustment result: ${result.status}`)
  } catch (error) {
    console.error("Could not adjust owner-managed user wallet.", error)
    return NextResponse.json({ error: "Could not adjust the user's wallet." }, { status: 500 })
  }
}
