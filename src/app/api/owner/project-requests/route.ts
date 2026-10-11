import { NextResponse } from "next/server"
import { requireOwnerAccess } from "@/features/auth/server/owner-access"
import { listPaidProjectRequests } from "@/features/projects/server/project-request-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const unauthorized = await requireOwnerAccess("project-requests")
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json(
      { requests: await listPaidProjectRequests() },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("Could not load paid project requests.", error)
    return NextResponse.json({ error: "Could not load project requests." }, { status: 500 })
  }
}
