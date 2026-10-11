import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { findUserBySession } from "@/features/auth/server/auth-store"
import { getWithdrawalMethod } from "@/features/wallet/server/withdrawal-method-store"
import {
  getAvailableWalletBalancePaise,
  getDailyWithdrawalRequestCount,
  listUserWalletWithdrawalRequests,
  MAX_DAILY_WITHDRAWAL_REQUESTS,
} from "@/features/wallet/server/wallet-withdrawal-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function signedInUser() {
  const token = (await cookies()).get("lucifer_session")?.value
  if (!token) return null
  return findUserBySession(token)
}

export async function GET() {
  try {
    const user = await signedInUser()
    if (!user) return NextResponse.json({ error: "Sign in to view your withdrawal requests." }, { status: 401 })
    const [availableBalancePaise, requestCount, withdrawalMethod, requests] = await Promise.all([
      getAvailableWalletBalancePaise(user.id),
      getDailyWithdrawalRequestCount(user.id),
      getWithdrawalMethod(user.id),
      listUserWalletWithdrawalRequests(user.id),
    ])
    return NextResponse.json(
      {
        availableBalancePaise,
        requestCount,
        remainingRequests: Math.max(0, MAX_DAILY_WITHDRAWAL_REQUESTS - requestCount),
        withdrawalMethod,
        requests,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("Could not load wallet withdrawal requests.", error)
    const message = error instanceof Error && error.message.includes("PAYOUT_DATA_ENCRYPTION_KEY")
      ? "Withdrawal details are not enabled because secure storage is not configured."
      : "Could not load withdrawal requests right now."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Cash withdrawals are coming soon. Wallet balances can be used for project and paid API purchases." },
    { status: 410 },
  )
}
