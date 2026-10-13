import { NextResponse } from "next/server"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { getOwnerWalletDashboard } from "@/features/owner/server/owner-wallet"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const unauthorized = await requireOwnerAccess("wallet")
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json(await getOwnerWalletDashboard(), {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    console.error("Could not load owner wallet management data.", error)
    return NextResponse.json({ error: "Could not load wallet management data." }, { status: 500 })
  }
}
