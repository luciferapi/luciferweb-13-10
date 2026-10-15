import { NextResponse } from "next/server"
import { getSignedInUser } from "@/features/auth/server/auth-session"
import { listUserProjectRequests } from "@/features/projects/server/project-request-store"
import { projectRequestReviewSchemaError } from "@/features/projects/server/project-request-schema-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getSignedInUser()
    if (!user) return NextResponse.json({ error: "Sign in to view your previous project requests." }, { status: 401 })

    const requests = await listUserProjectRequests(user.id)
    return NextResponse.json({ requests }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not load the signed-in user project request history.", error)
    const migrationError = projectRequestReviewSchemaError(error)
    if (migrationError) return migrationError
    return NextResponse.json({ error: "Could not load your previous project requests right now." }, { status: 500 })
  }
}
