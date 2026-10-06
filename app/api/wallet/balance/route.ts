import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { findUserBySession } from "@/lib/auth-store"
import { getAvailableWalletBalancePaise } from "@/lib/wallet-withdrawal-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return NextResponse.json({ error: "Sign in to view your wallet balance." }, { status: 401 })

  try {
    const user = await findUserBySession(token)
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
