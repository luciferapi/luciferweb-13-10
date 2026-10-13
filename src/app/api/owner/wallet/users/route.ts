import { NextResponse } from "next/server"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { listOwnerWalletUsers } from "@/features/owner/server/owner-wallet"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const unauthorized = await requireOwnerAccess("wallet")
  if (unauthorized) return unauthorized

  const params = new URL(request.url).searchParams
  const page = Number(params.get("page") ?? "1")
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json({ error: "Invalid wallet user page." }, { status: 400 })
  }

  try {
    const result = await listOwnerWalletUsers(page, params.get("search") ?? "")
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load owner wallet users.", error)
    return NextResponse.json({ error: "Could not load wallet user balances." }, { status: 500 })
  }
}
