import { NextResponse } from "next/server"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { getOwnerAnalytics } from "@/features/owner/server/owner-analytics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const unauthorized = await requireOwnerAccess("analytics")
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json(await getOwnerAnalytics(), {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    console.error("Could not load owner system analytics.", error)
    return NextResponse.json({ error: "Could not load system analytics." }, { status: 500 })
  }
}
