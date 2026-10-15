import { NextResponse } from "next/server"
import { z } from "zod"
import { getOwnerWorkspaceAccess, requireOwnerAccess } from "@/features/auth/server/owner-access"
import {
  listPaidProjectRequests,
  reviewPaidProjectRequest,
} from "@/features/projects/server/project-request-store"
import { projectRequestReviewSchemaError } from "@/features/projects/server/project-request-schema-error"
import { readLimitedJson } from "@/lib/server/read-limited-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const reviewInput = z.object({
  requestRef: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  ownerMessage: z.string().trim().max(2000).optional().default(""),
})

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
    const migrationError = projectRequestReviewSchemaError(error)
    if (migrationError) return migrationError
    return NextResponse.json({ error: "Could not load project requests." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireOwnerAccess("project-requests")
  if (unauthorized) return unauthorized

  const body = await readLimitedJson(request, 8 * 1024)
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? "The review message is too large." : "Send a valid request decision." },
      { status: body.status },
    )
  }

  const parsed = reviewInput.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: "Select a valid request and decision." }, { status: 400 })
  }
  if (parsed.data.decision === "accepted" && !parsed.data.ownerMessage) {
    return NextResponse.json({ error: "Add a message for the user before accepting this request." }, { status: 400 })
  }

  const access = await getOwnerWorkspaceAccess()
  if (!access) {
    return NextResponse.json({ error: "Sign in with an authorized owner or staff account." }, { status: 401 })
  }

  try {
    const result = await reviewPaidProjectRequest({
      requestRef: parsed.data.requestRef,
      decision: parsed.data.decision,
      ownerMessage: parsed.data.ownerMessage || null,
      reviewedBy: access.user.id,
    })
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409
      const error = result.reason === "not_found"
        ? "This project request could not be found."
        : result.reason === "not_paid"
          ? "Only payment-verified requests can be reviewed."
          : "This request has already been reviewed. Refresh the page to see its latest status."
      return NextResponse.json({ error }, { status })
    }

    return NextResponse.json({
      ok: true,
      requestRef: parsed.data.requestRef,
      reviewStatus: parsed.data.decision,
      ownerMessage: parsed.data.ownerMessage || null,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Could not save project request decision.", error)
    const migrationError = projectRequestReviewSchemaError(error)
    if (migrationError) return migrationError
    return NextResponse.json({ error: "Could not save the request decision. Try again." }, { status: 500 })
  }
}
