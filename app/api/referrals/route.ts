import { NextResponse } from "next/server"
import { getSignedInUser } from "@/lib/auth-session"
import { getReferralProgram, getUserReferralTree } from "@/lib/referral-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getSignedInUser()
    if (!user) return NextResponse.json({ error: "Sign in to view your referrals." }, { status: 401 })

    const [referralData, program] = await Promise.all([
      getUserReferralTree(user.id),
      getReferralProgram(),
    ])
    return NextResponse.json({ ...referralData, program }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load referral data.", error)
    return NextResponse.json({ error: "Could not load your referrals right now." }, { status: 500 })
  }
}
