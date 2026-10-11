import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import {
  getWithdrawalMethod,
} from "@/features/wallet/server/withdrawal-method-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireUser() {
  const user = await getSignedInUser()
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Sign in to manage withdrawal methods." }, { status: 401 }),
    }
  }
  return { user, response: null }
}

export async function GET() {
  try {
    const { user, response } = await requireUser()
    if (response || !user) return response

    const withdrawalMethod = await getWithdrawalMethod(user.id)
    return NextResponse.json(
      { withdrawalMethod },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("Could not load the saved withdrawal method.", error)
    const message = error instanceof Error && error.message.includes("PAYOUT_DATA_ENCRYPTION_KEY")
      ? "Withdrawal details are not enabled because secure storage is not configured."
      : "Could not load your withdrawal method right now."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT() {
  return NextResponse.json(
    { error: "Cash withdrawals are coming soon. Payout methods cannot be saved yet." },
    { status: 410 },
  )
}

export async function DELETE() {
  try {
    const { response } = await requireUser()
    if (response) return response

    return NextResponse.json(
      {
        error: "Withdrawal methods cannot be removed from Settings. Contact customer support to request a change.",
        supportUrl: "/contact",
      },
      { status: 405, headers: { Allow: "GET, PUT" } },
    )
  } catch (error) {
    console.error("Could not validate the withdrawal-method change request.", error)
    return NextResponse.json(
      { error: "Could not process your request right now." },
      { status: 500 },
    )
  }
}
