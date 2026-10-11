import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { getAvailableWalletBalancePaise } from "@/features/wallet/server/wallet-withdrawal-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getSignedInUser()
    if (!user) return NextResponse.json({ error: "Sign in to view your wallet balance." }, { status: 401 })

    const balancePaise = await getAvailableWalletBalancePaise(user.id)
    return NextResponse.json(
      { balancePaise },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("Could not load the profile wallet balance.", error)
    return NextResponse.json({ error: "Could not load your wallet balance right now." }, { status: 500 })
  }
}
