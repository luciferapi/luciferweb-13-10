import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/lib/auth-store"
import { listUserWalletDeposits, updatePendingWalletDepositStatus } from "@/lib/wallet-deposit-store"
import { getAvailableWalletBalancePaise } from "@/lib/wallet-withdrawal-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const statusSchema = z.object({
  order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  status: z.enum(["cancelled", "failed"]),
})

export async function GET() {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to view your wallet deposits." }, { status: 401 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in to view your wallet deposits." }, { status: 401 })
    const [balancePaise, deposits] = await Promise.all([
      getAvailableWalletBalancePaise(user.id),
      listUserWalletDeposits(user.id),
    ])
    return NextResponse.json(
      { balancePaise, deposits },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("Could not load the wallet deposits.", error)
    return NextResponse.json({ error: "Could not load wallet deposits right now." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to update deposit history." }, { status: 401 })
  const parsed = statusSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "A valid deposit order and status are required." }, { status: 400 })

  try {
    const user = await findUserBySession(token)
    if (!user) return NextResponse.json({ error: "Sign in to update deposit history." }, { status: 401 })
    const updated = await updatePendingWalletDepositStatus(
      parsed.data.order_id,
      user.id,
      parsed.data.status,
    )
    if (!updated) {
      return NextResponse.json({ error: "This deposit is not pending or does not belong to your account." }, { status: 409 })
    }
    return NextResponse.json({ success: true, status: parsed.data.status })
  } catch (error) {
    console.error("Could not update wallet deposit status.", error)
    return NextResponse.json({ error: "Could not update deposit history right now." }, { status: 500 })
  }
}
