import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { findUserBySession } from "@/lib/auth-store"
import { sendWithdrawalRequestNotification } from "@/lib/email"
import {
  getWithdrawalMethod,
  getWithdrawalPayoutDetails,
} from "@/lib/withdrawal-method-store"
import {
  createWalletWithdrawalRequest,
  getAvailableWalletBalancePaise,
  getDailyWithdrawalRequestCount,
  listUserWalletWithdrawalRequests,
  MAX_DAILY_WITHDRAWAL_REQUESTS,
  MAX_WITHDRAWAL_PAISE,
  MIN_WITHDRAWAL_PAISE,
  WithdrawalAmountExceedsBalanceError,
  WithdrawalRequestLimitError,
} from "@/lib/wallet-withdrawal-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestSchema = z.object({
  amount: z.number().int().min(MIN_WITHDRAWAL_PAISE / 100).max(MAX_WITHDRAWAL_PAISE / 100),
})

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

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a whole-rupee amount from ₹50 to ₹1,500." }, { status: 400 })
  }

  let user
  try {
    user = await signedInUser()
  } catch (error) {
    console.error("Could not verify the withdrawal request session.", error)
    return NextResponse.json({ error: "Could not verify your sign-in right now." }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "Sign in before submitting a withdrawal request." }, { status: 401 })

  try {
    const [withdrawalMethod, payoutDetails] = await Promise.all([
      getWithdrawalMethod(user.id),
      getWithdrawalPayoutDetails(user.id),
    ])
    if (!withdrawalMethod || !payoutDetails) {
      return NextResponse.json(
        { error: "Save a UPI ID or bank account in Settings before requesting a withdrawal.", settingsUrl: "/settings" },
        { status: 409 },
      )
    }

    const created = await createWalletWithdrawalRequest({
      userId: user.id,
      amountPaise: parsed.data.amount * 100,
      method: payoutDetails.method,
      destination: withdrawalMethod.destination,
    })

    try {
      await sendWithdrawalRequestNotification({
        withdrawalId: created.withdrawalId,
        userName: user.name,
        userEmail: user.email,
        publicUid: user.publicUid,
        amountPaise: parsed.data.amount * 100,
        payoutDetails,
      })
    } catch (notificationError) {
      console.error(`Withdrawal request ${created.withdrawalId} was saved, but owner notification failed.`, notificationError)
      return NextResponse.json(
        {
          error: `Request ${created.withdrawalId} was saved, but the owner email notification failed. Contact support and include this withdrawal ID.`,
          withdrawal_id: created.withdrawalId,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      withdrawal_id: created.withdrawalId,
      remaining_requests: created.remainingRequests,
    })
  } catch (error) {
    if (error instanceof WithdrawalRequestLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 })
    }
    if (error instanceof WithdrawalAmountExceedsBalanceError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Could not save the wallet withdrawal request.", error)
    const message = error instanceof Error && error.message.includes("PAYOUT_DATA_ENCRYPTION_KEY")
      ? "Withdrawal details are not enabled because secure storage is not configured."
      : "Could not submit this withdrawal request right now."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
